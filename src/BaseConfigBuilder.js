import { parse as parseProxyLink } from './parsers/index.js';
import { DeepCopy, tryDecodeSubscriptionLines, decodeBase64, parseCountryFromNodeName } from './utils.js';
import yaml from 'js-yaml';
import { t, setLanguage } from './i18n/index.js';
import { generateRules, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { convertSingboxOutboundToIR, SINGBOX_REAL_NODE_TYPES } from './parsers/singboxHelper.js';

import {
    createShadowsocksNode,
    createVmessNode,
    createVlessNode,
    createTrojanNode,
    createHysteria2Node,
    createTuicNode,
    createAnytlsNode,
    createHttpNode,
} from './ir/factory.js';

import { convertYamlProxyToObject } from './parsers/yamlHelper.js';

class InputValidationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'InputValidationError';
        this.details = details;
        this.status = 400;
    }
}

function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

function formatNodeFieldError(index, field, reason) {
    const prefix = typeof index === 'number' ? `nodes[${index}].${field}` : field;
    return `${prefix}: ${reason}`;
}

function normalizeKind(kind) {
    if (!kind) return '';
    const k = String(kind).trim().toLowerCase();
    if (k === 'ss') return 'shadowsocks';
    if (k === 'hy2') return 'hysteria2';
    return k;
}

function normalizeTagsForNode(n) {
    if (!n) return [];
    if (Array.isArray(n.tags)) return n.tags;
    if (typeof n.tag === 'string' && n.tag.trim()) return [n.tag.trim()];
    if (typeof n.name === 'string' && n.name.trim()) return [n.name.trim()];
    return [];
}

function normalizeInputNodeToIR(node, index) {
    if (!isPlainObject(node)) {
        throw new InputValidationError(formatNodeFieldError(index, 'node', 'must be an object'), { index, field: 'node' });
    }

    const kind = normalizeKind(node.kind ?? node.type);
    if (!kind) {
        throw new InputValidationError(formatNodeFieldError(index, 'kind', 'is required'), { index, field: 'kind' });
    }

    const host = (node.host ?? node.server ?? node.address ?? '').toString().trim();
    if (!host) {
        throw new InputValidationError(formatNodeFieldError(index, 'host', 'is required'), { index, field: 'host' });
    }

    const portValue = node.port ?? node.server_port;
    const port = Number(portValue);
    if (!Number.isFinite(port) || port <= 0) {
        throw new InputValidationError(formatNodeFieldError(index, 'port', 'must be a positive number'), { index, field: 'port' });
    }

    const tags = normalizeTagsForNode(node);
    if (!Array.isArray(tags) || tags.length === 0) {
        throw new InputValidationError(formatNodeFieldError(index, 'tag', 'tag or tags is required'), { index, field: 'tag' });
    }

    const common = {
        host,
        port,
        tags,
        udp: typeof node.udp !== 'undefined' ? node.udp : undefined,
        network: node.network,
        transport: node.transport,
        tls: node.tls,
        ext: node.ext,
    };

    try {
        switch (kind) {
            case 'vmess':
                return createVmessNode({
                    ...common,
                    uuid: node.uuid ?? node.auth?.uuid,
                    alter_id: node.alter_id ?? node.alterId,
                    security: node.security ?? node.method ?? node.auth?.method,
                });
            case 'vless':
                return createVlessNode({
                    ...common,
                    uuid: node.uuid ?? node.auth?.uuid,
                    flow: node.flow,
                    packet_encoding: node.packet_encoding ?? node.packetEncoding,
                });
            case 'trojan':
                return createTrojanNode({
                    ...common,
                    password: node.password ?? node.auth?.password,
                    flow: node.flow,
                });
            case 'shadowsocks':
                return createShadowsocksNode({
                    ...common,
                    password: node.password ?? node.auth?.password,
                    method: node.method ?? node.cipher ?? node.auth?.method,
                });
            case 'hysteria2':
                return createHysteria2Node({
                    ...common,
                    password: node.password ?? node.auth?.password,
                    tls: node.tls,
                    obfs: node.obfs,
                    auth: node.authPayload ?? node.auth,
                    up: node.up,
                    down: node.down,
                    recv_window_conn: node.recv_window_conn,
                    ports: node.ports,
                    hop_interval: node.hop_interval,
                    fast_open: node.fast_open,
                    alpn: node.alpn,
                });
            case 'tuic':
                return createTuicNode({
                    ...common,
                    uuid: node.uuid ?? node.auth?.uuid,
                    password: node.password ?? node.auth?.password,
                    congestion_control: node.congestion_control,
                    udp_relay_mode: node.udp_relay_mode,
                    zero_rtt: node.zero_rtt,
                    reduce_rtt: node.reduce_rtt,
                    fast_open: node.fast_open,
                    disable_sni: node.disable_sni,
                });
            case 'anytls':
                return createAnytlsNode({
                    ...common,
                    password: node.password ?? node.auth?.password,
                    idle_session_check_interval: node.idle_session_check_interval,
                    idle_session_timeout: node.idle_session_timeout,
                    min_idle_session: node.min_idle_session,
                });
            case 'http':
            case 'https':
                return createHttpNode({
                    ...common,
                    kind,
                    username: node.username ?? node.auth?.username,
                    password: node.password ?? node.auth?.password,
                });
            default:
                throw new InputValidationError(formatNodeFieldError(index, 'kind', `unsupported kind: ${kind}`), { index, field: 'kind' });
        }
    } catch (e) {
        // 将工厂函数的错误包装为可定位错误
        if (e instanceof InputValidationError) {
            throw e;
        }
        throw new InputValidationError(formatNodeFieldError(index, kind, e?.message || 'invalid node'), { index, field: kind });
    }
}

function parseNormalizedInputObject(obj) {
    if (!isPlainObject(obj)) return null;

    const hasVersion = Object.prototype.hasOwnProperty.call(obj, 'version');
    const hasNodes = Object.prototype.hasOwnProperty.call(obj, 'nodes');
    if (!hasVersion || !hasNodes) return null;

    const version = obj.version;
    if (typeof version !== 'string' || !version.trim()) {
        throw new InputValidationError('version: must be a non-empty string', { field: 'version' });
    }

    const nodes = obj.nodes;
    if (!Array.isArray(nodes)) {
        throw new InputValidationError('nodes: must be an array', { field: 'nodes' });
    }
    if (nodes.length === 0) {
        throw new InputValidationError('nodes: must not be empty', { field: 'nodes' });
    }
    if (nodes.length > 500) {
        throw new InputValidationError('nodes: too many nodes (max 500)', { field: 'nodes' });
    }

    const irNodes = nodes.map((n, i) => normalizeInputNodeToIR(n, i)).filter(Boolean);
    if (irNodes.length === 0) {
        throw new InputValidationError('nodes: no valid nodes found', { field: 'nodes' });
    }
    return irNodes;
}

// 配置生成器的基类，定义了通用的构建流程和方法
export class BaseConfigBuilder {
    // 构造函数
    constructor(inputString, baseConfig, lang, userAgent, groupByCountry = false) {
        this.inputString = inputString; // 输入的代理链接或订阅内容
        this.config = DeepCopy(baseConfig); // 基础配置
        this.customRules = []; // 自定义规则
        this.selectedRules = []; // 选择的规则
        setLanguage(lang); // 设置语言
        this.userAgent = userAgent; // User-Agent
        this.appliedOverrideKeys = new Set(); // 已应用的配置覆盖项
        this.groupByCountry = groupByCountry; // 是否按国家分组
    }

    // 构建配置的主方法
    async build() {
        const customItems = await this.parseCustomItems(); // 解析自定义项目
        this.addCustomItems(customItems); // 添加自定义项目到配置
        this.addSelectors(); // 添加选择器（代理组）
        return this.formatConfig(); // 格式化最终配置
    }

    // 解析输入的字符串，获取代理节点信息
    async parseCustomItems() {
        const input = this.inputString || '';
        const trimmedInput = input.trim();
        let parsedItems = [];

        // 尝试将内容解析为 YAML/JSON 对象（js-yaml 也可解析 JSON）
        const tryParseStructuredDocument = (content) => {
            if (!content) return null;
            try {
                const obj = yaml.load(content);
                if (!obj || typeof obj !== 'object') return null;

                // 0) 优先：规范化输入对象 { version, nodes }
                const normalized = parseNormalizedInputObject(obj);
                if (normalized) {
                    return normalized;
                }

                // 1) Clash: proxies
                if (Array.isArray(obj.proxies)) {
                    const overrides = DeepCopy(obj);
                    delete overrides.proxies;
                    if (Object.keys(overrides).length > 0) {
                        this.applyConfigOverrides(overrides);
                    }
                    const proxies = obj.proxies
                        .map(p => convertYamlProxyToObject(p))
                        .filter(Boolean);
                    if (proxies.length > 0) {
                        return proxies;
                    }
                }

                // 2) Sing-box: outbounds
                if (Array.isArray(obj.outbounds)) {
                    const outbounds = obj.outbounds
                        .filter(o => o && typeof o === 'object')
                        .filter(o => SINGBOX_REAL_NODE_TYPES.has(String(o.type || '').toLowerCase()))
                        .map(o => convertSingboxOutboundToIR(o))
                        .filter(Boolean);
                    if (outbounds.length > 0) {
                        return outbounds;
                    }
                }

                return null;
            } catch (e) {
                // 如果是我们认可的结构化输入形态，但校验失败，则应直接报错，不回退到按行解析
                if (e instanceof InputValidationError) {
                    throw e;
                }
                // 其他解析错误：忽略，继续尝试其他方法
            }
            return null;
        };

        // 1) 尝试直接解析为 YAML/JSON 对象
        const directStructuredItems = tryParseStructuredDocument(trimmedInput);
        if (directStructuredItems) {
            return directStructuredItems;
        }

        // 2) 如果输入看起来像 Base64，则解码后再次尝试解析为 YAML/JSON 对象
        const sanitized = input.replace(/\s+/g, '');
        const maybeBase64 =
            sanitized.length > 0 &&
            sanitized.length % 4 === 0 &&
            /^[A-Za-z0-9+/=]+$/.test(sanitized);
        if (maybeBase64) {
            try {
                const decoded = decodeBase64(sanitized);
                if (typeof decoded === 'string') {
                    const decodedStructuredItems = tryParseStructuredDocument(decoded.trim());
                    if (decodedStructuredItems) {
                        return decodedStructuredItems;
                    }
                }
            } catch (e) {
                // 如果是结构化输入校验错误，直接抛出
                if (e instanceof InputValidationError) {
                    throw e;
                }
                // 忽略解码错误
            }
        }

        // 3) 回退到按行解析代理链接或订阅链接
        const lines = input.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
            let decodedLines = tryDecodeSubscriptionLines(line);
            if (!Array.isArray(decodedLines)) {
                decodedLines = [decodedLines];
            }

            for (const decodedLine of decodedLines) {
                if (decodedLine.startsWith('http')) { // 订阅链接
                    try {
                        const response = await fetch(decodedLine, { headers: { 'User-Agent': this.userAgent } });
                        const text = await response.text();

                        // 远程内容也尝试结构化解析（Clash proxies / 规范化输入对象 / 未来的 sing-box outbounds）
                        const remoteStructuredItems = tryParseStructuredDocument(text?.trim());
                        if (remoteStructuredItems) {
                            parsedItems.push(...remoteStructuredItems);
                            continue;
                        }

                        let subLines = tryDecodeSubscriptionLines(text);
                        if (!Array.isArray(subLines)) subLines = [subLines];
                        for (const subLine of subLines) {
                            const proxy = await parseProxyLink(subLine, this.userAgent);
                            if (proxy) parsedItems.push(proxy);
                        }
                    } catch (e) {
                        // 结构化输入校验错误应直接暴露给调用方
                        if (e instanceof InputValidationError) {
                            throw e;
                        }
                        console.warn(`获取或处理订阅失败: ${decodedLine}`, e);
                    }
                } else { // 单个代理链接
                    const proxy = await parseProxyLink(decodedLine, this.userAgent);
                    if (proxy) parsedItems.push(proxy);
                }
            }
        }

        return parsedItems.flat().filter(Boolean);
    }

    // 应用从 YAML 中解析出的配置覆盖
    applyConfigOverrides(overrides) {
        if (!overrides || typeof overrides !== 'object') {
            return;
        }

        // 黑名单，防止覆盖由我们自己逻辑生成的字段
        const blacklistedKeys = new Set(['proxies', 'rules', 'rule-providers']);

        Object.entries(overrides).forEach(([key, value]) => {
            if (blacklistedKeys.has(key)) {
                return;
            }
            if (value === undefined) {
                delete this.config[key];
                this.appliedOverrideKeys.add(key);
            } else {
                this.config[key] = DeepCopy(value);
                this.appliedOverrideKeys.add(key);
            }
        });
    }

    // 检查某个配置项是否被覆盖
    hasConfigOverride(key) {
        return this.appliedOverrideKeys?.has(key);
    }

    // 获取出站策略列表
    getOutboundsList() {
        let outbounds;
        if (typeof this.selectedRules === 'string' && PREDEFINED_RULE_SETS[this.selectedRules]) {
            outbounds = getOutbounds(PREDEFINED_RULE_SETS[this.selectedRules]);
        } else if (this.selectedRules && Object.keys(this.selectedRules).length > 0) {
            outbounds = getOutbounds(this.selectedRules);
        } else {
            outbounds = getOutbounds(PREDEFINED_RULE_SETS.minimal);
        }
        return outbounds;
    }

    // 获取代理名称列表
    getProxyList() {
        return this.getProxies().map(proxy => this.getProxyName(proxy));
    }

    // 获取代理列表 (需在子类中实现)
    getProxies() {
        throw new Error('getProxies 必须在子类中实现');
    }

    // 获取代理名称 (需在子类中实现)
    getProxyName(proxy) {
        throw new Error('getProxyName 必须在子类中实现');
    }

    // 转换代理格式 (需在子类中实现)
    convertProxy(proxy) {
        throw new Error('convertProxy 必须在子类中实现');
    }

    // 添加代理到配置 (需在子类中实现)
    addProxyToConfig(proxy) {
        throw new Error('addProxyToConfig 必须在子类中实现');
    }

    // 添加自动选择组 (需在子类中实现)
    addAutoSelectGroup(proxyList) {
        throw new Error('addAutoSelectGroup 必须在子类中实现');
    }

    // 添加节点选择组 (需在子类中实现)
    addNodeSelectGroup(proxyList) {
        throw new Error('addNodeSelectGroup 必须在子类中实现');
    }

    // 添加出站策略组 (需在子类中实现)
    addOutboundGroups(outbounds, proxyList) {
        throw new Error('addOutboundGroups 必须在子类中实现');
    }

    // 添加自定义规则组 (需在子类中实现)
    addCustomRuleGroups(proxyList) {
        throw new Error('addCustomRuleGroups 必须在子类中实现');
    }

    // 添加回退组 (需在子类中实现)
    addFallBackGroup(proxyList) {
        throw new Error('addFallBackGroup 必须在子类中实现');
    }

    // 添加按国家分组 (需在子类中实现)
    addCountryGroups() {
        throw new Error('addCountryGroups 必须在子类中实现');
    }

    // 将解析出的自定义项目添加到配置中
    addCustomItems(customItems) {
        const validItems = (customItems || []).filter(Boolean);
        validItems.forEach(item => {
            const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
            if (tags.length === 0 && item.tag) {
                item.tags = [item.tag];
            }
            if (Array.isArray(item.tags) && item.tags.length > 0 && !item.tag) {
                item.tag = item.tags[0];
            }
            const convertedProxy = this.convertProxy(item);
            if (convertedProxy) {
                this.addProxyToConfig(convertedProxy);
            }
        });
    }

    // 添加所有选择器 (代理组)
    addSelectors() {
        const outbounds = this.getOutboundsList();
        const proxyList = this.getProxyList();

        this.addAutoSelectGroup(proxyList);
        this.addNodeSelectGroup(proxyList);
        if (this.groupByCountry) {
            this.addCountryGroups();
        }
        this.addOutboundGroups(outbounds, proxyList);
        this.addCustomRuleGroups(proxyList);
        this.addFallBackGroup(proxyList);
    }

    // 生成规则
    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    // 格式化最终配置 (需在子类中实现)
    formatConfig() {
        throw new Error('formatConfig 必须在子类中实现');
    }
}
