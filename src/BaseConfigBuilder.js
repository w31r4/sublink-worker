import { parse as parseProxyLink } from './parsers/index.js';
import { DeepCopy, tryDecodeSubscriptionLines, decodeBase64, parseCountryFromNodeName } from './utils.js';
import yaml from 'js-yaml';
import { t, setLanguage } from './i18n/index.js';
import { generateRules, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';

import { convertYamlProxyToObject } from './parsers/yamlHelper.js';

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

        // 尝试将内容解析为 YAML 文档
        const tryParseYamlDocument = (content) => {
            if (!content) return null;
            try {
                const obj = yaml.load(content);
                if (obj && typeof obj === 'object' && Array.isArray(obj.proxies)) {
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
            } catch (e) {
                // 忽略 YAML 解析错误，继续尝试其他方法
            }
            return null;
        };

        // 1) 尝试直接解析为 YAML
        const directYamlItems = tryParseYamlDocument(trimmedInput);
        if (directYamlItems) {
            return directYamlItems;
        }

        // 2) 如果输入看起来像 Base64，则解码后再次尝试解析为 YAML
        const sanitized = input.replace(/\s+/g, '');
        const maybeBase64 =
            sanitized.length > 0 &&
            sanitized.length % 4 === 0 &&
            /^[A-Za-z0-9+/=]+$/.test(sanitized);
        if (maybeBase64) {
            try {
                const decoded = decodeBase64(sanitized);
                if (typeof decoded === 'string') {
                    const decodedYamlItems = tryParseYamlDocument(decoded.trim());
                    if (decodedYamlItems) {
                        return decodedYamlItems;
                    }
                }
            } catch (e) {
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
                        const remoteYamlItems = tryParseYamlDocument(text?.trim());
                        if (remoteYamlItems) {
                            parsedItems.push(...remoteYamlItems);
                            continue;
                        }
                        let subLines = tryDecodeSubscriptionLines(text);
                        if (!Array.isArray(subLines)) subLines = [subLines];
                        for (const subLine of subLines) {
                            const proxy = await parseProxyLink(subLine, this.userAgent);
                            if (proxy) parsedItems.push(proxy);
                        }
                    } catch (e) {
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
