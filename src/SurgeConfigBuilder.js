import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { parseCountryFromNodeName } from './utils.js';
import { SURGE_CONFIG, SURGE_SITE_RULE_SET_BASEURL, SURGE_IP_RULE_SET_BASEURL, generateRules, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { t } from './i18n/index.js';
import { buildAggregatedMembers, buildNodeSelectMembers } from './groupHelpers.js';

// Surge 配置生成器
export class SurgeConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent, groupByCountry) {
        // 当前固定使用默认的 Surge 配置
        baseConfig = SURGE_CONFIG;
        super(inputString, baseConfig, lang, userAgent, groupByCountry);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
        this.subscriptionUrl = null;
        this.countryGroupNames = [];
        this.manualGroupName = null;
    }

    // 设置订阅 URL
    setSubscriptionUrl(url) {
        this.subscriptionUrl = url;
        return this;
    }

    // 获取所有代理
    getProxies() {
        return this.config.proxies || [];
    }

    // 从代理字符串中获取代理名称
    getProxyName(proxy) {
        return proxy.split('=')[0].trim();
    }

    // 将中间表示 (IR) 转换为 Surge 的代理格式
    convertProxy(proxy) {
        const tag = proxy.tags?.[0] || proxy.tag || 'proxy';
        const server = proxy.host;
        const port = proxy.port;
        const tls = proxy.tls || {};
        const transport = proxy.transport;
        const getAlpn = () => (Array.isArray(tls.alpn) && tls.alpn.length > 0 ? `, alpn=${tls.alpn.join(',')}` : '');

        let surgeProxy;
        switch (proxy.kind) {
            case 'shadowsocks': {
                const method = proxy.auth?.method;
                const password = proxy.auth?.password;
                surgeProxy = `${tag} = ss, ${server}, ${port}, encrypt-method=${method}, password=${password}`;
                break;
            }
            case 'vmess': {
                const uuid = proxy.auth?.uuid;
                const alterId = typeof proxy.alterId !== 'undefined'
                    ? proxy.alterId
                    : proxy.ext?.clash?.alterId;
                surgeProxy = `${tag} = vmess, ${server}, ${port}, username=${uuid}`;
                if (alterId === 0) {
                    surgeProxy += ', vmess-aead=true';
                }
                if (tls?.enabled) {
                    surgeProxy += ', tls=true';
                    if (tls.sni) {
                        surgeProxy += `, sni=${tls.sni}`;
                    }
                    if (tls.insecure) {
                        surgeProxy += ', skip-cert-verify=true';
                    }
                    surgeProxy += getAlpn();
                }
                if (transport?.type === 'ws') {
                    surgeProxy += `, ws=true, ws-path=${transport.path || '/'}`;
                    if (transport.headers?.Host) {
                        surgeProxy += `, ws-headers=Host:${transport.headers.Host}`;
                    }
                } else if (transport?.type === 'grpc') {
                    surgeProxy += `, grpc-service-name=${transport.service_name}`;
                }
                break;
            }
            case 'trojan': {
                const password = proxy.auth?.password;
                surgeProxy = `${tag} = trojan, ${server}, ${port}, password=${password}`;
                if (tls?.sni) {
                    surgeProxy += `, sni=${tls.sni}`;
                }
                if (tls?.insecure) {
                    surgeProxy += ', skip-cert-verify=true';
                }
                surgeProxy += getAlpn();
                if (transport?.type === 'ws') {
                    surgeProxy += `, ws=true, ws-path=${transport.path || '/'}`;
                    if (transport.headers?.Host) {
                        surgeProxy += `, ws-headers=Host:${transport.headers.Host}`;
                    }
                } else if (transport?.type === 'grpc') {
                    surgeProxy += `, grpc-service-name=${transport.service_name}`;
                }
                break;
            }
            case 'hysteria2': {
                const password = proxy.auth?.password;
                surgeProxy = `${tag} = hysteria2, ${server}, ${port}, password=${password}`;
                if (tls?.sni) {
                    surgeProxy += `, sni=${tls.sni}`;
                }
                if (tls?.insecure) {
                    surgeProxy += ', skip-cert-verify=true';
                }
                surgeProxy += getAlpn();
                break;
            }
            case 'tuic': {
                const password = proxy.auth?.password;
                const uuid = proxy.auth?.uuid;
                surgeProxy = `${tag} = tuic, ${server}, ${port}, password=${password}, uuid=${uuid}`;
                if (tls?.sni) {
                    surgeProxy += `, sni=${tls.sni}`;
                }
                surgeProxy += getAlpn();
                if (tls?.insecure) {
                    surgeProxy += ', skip-cert-verify=true';
                }
                const tuic = proxy.proto?.tuic || {};
                if (tuic.congestion_control) {
                    surgeProxy += `, congestion-controller=${tuic.congestion_control}`;
                }
                if (tuic.udp_relay_mode) {
                    surgeProxy += `, udp-relay-mode=${tuic.udp_relay_mode}`;
                }
                break;
            }
            default:
                surgeProxy = `# ${tag} - 不支持的代理类型: ${proxy.kind}`;
        }
        return surgeProxy;
    }

    // 添加代理到配置中，并处理重名问题
    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];

        const proxyName = this.getProxyName(proxy);
        const existingNames = new Set(this.config.proxies.map(p => this.getProxyName(p)));
        
        let finalName = proxyName;
        let counter = 2;
        while (existingNames.has(finalName)) {
            finalName = `${proxyName} ${counter++}`;
        }

        if (finalName !== proxyName) {
            const equalsPos = proxy.indexOf('=');
            if (equalsPos > 0) {
                proxy = `${finalName} ${proxy.substring(equalsPos)}`;
            }
        }
        
        this.config.proxies.push(proxy);
    }

    // 创建代理组字符串
    createProxyGroup(name, type, options = [], extraConfig = '') {
        const sanitized = this.sanitizeOptions(options);
        const optionsPart = sanitized.length > 0 ? `, ${sanitized.join(', ')}` : '';
        return `${name} = ${type}${optionsPart}${extraConfig}`;
    }

    // 清理和去重代理组选项
    sanitizeOptions(options = []) {
        const normalize = (s) => typeof s === 'string' ? s.trim() : s;
        const seen = new Set();
        return options
            .map(normalize)
            .filter(option => typeof option === 'string' && option.length > 0)
            .filter(option => {
                if (seen.has(option)) return false;
                seen.add(option);
                return true;
            });
    }

    // 构建节点选择组的选项
    buildNodeSelectOptions(proxyList = []) {
        const members = buildNodeSelectMembers({
            groupByCountry: this.groupByCountry,
            manualGroupName: this.manualGroupName,
            countryGroupNames: this.countryGroupNames,
            proxyList
        });
        return this.sanitizeOptions(members);
    }

    // 构建聚合的代理组选项
    buildAggregatedOptions(proxyList = []) {
        const members = buildAggregatedMembers({
            groupByCountry: this.groupByCountry,
            manualGroupName: this.manualGroupName,
            countryGroupNames: this.countryGroupNames,
            proxyList
        });
        return this.sanitizeOptions(members);
    }

    withDirectReject(options = []) { return this.sanitizeOptions(options); }

    // 添加自动选择组 (URL Test)
    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push(
            this.createProxyGroup(
                t('outboundNames.Auto Select'),
                'url-test',
                this.sanitizeOptions(proxyList),
                ', url=http://www.gstatic.com/generate_204, interval=300'
            )
        );
    }

    // 添加节点选择组 (Select)
    addNodeSelectGroup(proxyList) {
        const options = this.buildNodeSelectOptions(proxyList);
        this.config['proxy-groups'].push(
            this.createProxyGroup(t('outboundNames.Node Select'), 'select', options)
        );
    }

    // 添加各种出站策略组
    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound !== t('outboundNames.Node Select')) {
                const options = this.buildAggregatedOptions(proxyList);
                this.config['proxy-groups'].push(
                    this.createProxyGroup(t(`outboundNames.${outbound}`), 'select', options)
                );
            }
        });
    }

    // 添加自定义规则对应的出站组
    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                const options = this.buildAggregatedOptions(proxyList);
                this.config['proxy-groups'].push(
                    this.createProxyGroup(rule.name, 'select', options)
                );
            });
        }
    }

    // 添加回退组
    addFallBackGroup(proxyList) {
        const options = this.buildAggregatedOptions(proxyList);
        this.config['proxy-groups'].push(
            this.createProxyGroup(t('outboundNames.Fall Back'), 'select', options)
        );
    }

    // 添加按国家/地区分组
    addCountryGroups() {
        const proxies = this.getProxies();
        const countryGroups = {};

        proxies.forEach(proxy => {
            const proxyName = this.getProxyName(proxy);
            const countryInfo = parseCountryFromNodeName(proxyName);
            if (countryInfo) {
                const { name } = countryInfo;
                if (!countryGroups[name]) {
                    countryGroups[name] = { ...countryInfo, proxies: [] };
                }
                countryGroups[name].proxies.push(proxyName);
            }
        });

        const existing = new Set((this.config['proxy-groups'] || [])
            .map(g => this.getProxyName(g)?.trim())
            .filter(Boolean));

        const manualProxyNames = proxies.map(p => this.getProxyName(p)).filter(Boolean);
        const manualGroupName = manualProxyNames.length > 0 ? t('outboundNames.Manual Switch') : null;
        if (manualGroupName) {
            const manualNorm = manualGroupName.trim();
            if (!existing.has(manualNorm)) {
                this.config['proxy-groups'].push(
                    this.createProxyGroup(manualGroupName, 'select', this.sanitizeOptions(manualProxyNames))
                );
                existing.add(manualNorm);
            }
        }

        const countryGroupNames = [];
        const countries = Object.keys(countryGroups).sort((a, b) => a.localeCompare(b));

        countries.forEach(country => {
            const { emoji, name, proxies } = countryGroups[country];
            const groupName = `${emoji} ${name}`;
            countryGroupNames.push(groupName);
            if (!existing.has(groupName.trim())) {
                this.config['proxy-groups'].push(
                    this.createProxyGroup(groupName, 'url-test', proxies, ', url=https://www.gstatic.com/generate_204, interval=300')
                );
                existing.add(groupName.trim());
            }
        });

        const nodeSelectGroupIndex = this.config['proxy-groups'].findIndex(g => this.getProxyName(g) === t('outboundNames.Node Select'));
        if (nodeSelectGroupIndex > -1) {
            const newOptions = this.withDirectReject([
                t('outboundNames.Auto Select'),
                ...(manualGroupName ? [manualGroupName] : []),
                ...countryGroupNames
            ]);
            const newGroup = this.createProxyGroup(t('outboundNames.Node Select'), 'select', newOptions);
            this.config['proxy-groups'][nodeSelectGroupIndex] = newGroup;
        }
        this.countryGroupNames = countryGroupNames;
        this.manualGroupName = manualGroupName;
    }

    // 格式化最终的 Surge 配置
    formatConfig() {
        const rules = generateRules(this.selectedRules, this.customRules);
        let finalConfig = [];

        // 如果有订阅 URL，则添加托管配置头
        if (this.subscriptionUrl) {
            finalConfig.push(`#!MANAGED-CONFIG ${this.subscriptionUrl} interval=43200 strict=false`);
            finalConfig.push('');
        }

        // 添加 [General] 部分
        finalConfig.push('[General]');
        if (this.config.general) {
            Object.entries(this.config.general).forEach(([key, value]) => {
                finalConfig.push(`${key} = ${value}`);
            });
        }

        // 添加 [Replica] 部分
        if (this.config.replica) {
            finalConfig.push('\n[Replica]');
            Object.entries(this.config.replica).forEach(([key, value]) => {
                finalConfig.push(`${key} = ${value}`);
            });
        }

        // 添加 [Proxy] 部分
        finalConfig.push('\n[Proxy]');
        finalConfig.push('DIRECT = direct');
        if (this.config.proxies) {
            finalConfig.push(...this.config.proxies);
        }

        // 添加 [Proxy Group] 部分
        finalConfig.push('\n[Proxy Group]');
        if (this.config['proxy-groups']) {
            finalConfig.push(...this.config['proxy-groups']);
        }

        // 添加 [Rule] 部分
        finalConfig.push('\n[Rule]');

        // 添加域名和 IP 规则
        rules.filter(rule => !!rule.domain_suffix).map(rule => {
            rule.domain_suffix.forEach(suffix => {
                finalConfig.push(`DOMAIN-SUFFIX,${suffix},${t('outboundNames.'+ rule.outbound)}`);
            });
        });

        rules.filter(rule => !!rule.domain_keyword).map(rule => {
            rule.domain_keyword.forEach(keyword => {
                finalConfig.push(`DOMAIN-KEYWORD,${keyword},${t('outboundNames.'+ rule.outbound)}`);
            });
        });

        rules.filter(rule => rule.site_rules[0] !== '').map(rule => {
            rule.site_rules.forEach(site => {
                finalConfig.push(`RULE-SET,${SURGE_SITE_RULE_SET_BASEURL}${site}.conf,${t('outboundNames.'+ rule.outbound)}`);
            });
        });

        rules.filter(rule => rule.ip_rules[0] !== '').map(rule => {
            rule.ip_rules.forEach(ip => {
                finalConfig.push(`RULE-SET,${SURGE_IP_RULE_SET_BASEURL}${ip}.txt,${t('outboundNames.'+ rule.outbound)},no-resolve`);
            });
        });

        rules.filter(rule => !!rule.ip_cidr).map(rule => {
            rule.ip_cidr.forEach(cidr => {
                finalConfig.push(`IP-CIDR,${cidr},${t('outboundNames.'+ rule.outbound)},no-resolve`);
            });
        });

        // 添加最终的 FINAL 规则
        finalConfig.push('FINAL,' + t('outboundNames.Fall Back'));

        return finalConfig.join('\n');
    }

    // 获取当前 URL (在 Worker 环境中可能不可用)
    getCurrentUrl() {
        try {
            if (typeof self !== 'undefined' && self.location) {
                return self.location.href;
            }
            return null;
        } catch (error) {
            console.error('获取当前 URL 出错:', error);
            return null;
        }
    }
}
