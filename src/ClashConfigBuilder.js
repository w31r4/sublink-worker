import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy, parseCountryFromNodeName } from './utils.js';
import { mapIRToClash } from './ir/maps/clash.js';
import { downgradeByCaps } from './ir/core.js';
import { t } from './i18n/index.js';
import { buildAggregatedMembers, buildNodeSelectMembers } from './groupHelpers.js';

// Clash 配置生成器
export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent, groupByCountry) {
        // 如果没有提供基础配置，则使用默认的 Clash 配置
        if (!baseConfig) {
            baseConfig = CLASH_CONFIG;
        }
        super(inputString, baseConfig, lang, userAgent, groupByCountry);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
        this.countryGroupNames = [];
        this.manualGroupName = null;
    }

    // 获取所有代理
    getProxies() {
        return this.config.proxies || [];
    }

    // 获取代理的名称
    getProxyName(proxy) {
        return proxy.name;
    }

    // 将中间表示 (IR) 转换为 Clash 的代理格式
    convertProxy(proxy) {
        try {
            const downgraded = downgradeByCaps(proxy, 'clash');
            const mapped = mapIRToClash(downgraded, proxy);
            if (mapped) return mapped;
        } catch (e) {
            console.error(`将 IR 映射到 Clash 配置失败: ${proxy.tags?.[0]}`, e);
        }
        return null;
    }

    // 添加代理到配置中，并处理重名问题
    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];

        const existingNames = new Set(this.config.proxies.map(p => p.name));
        let finalName = proxy.name;
        let counter = 2;
        while (existingNames.has(finalName)) {
            finalName = `${proxy.name} ${counter++}`;
        }
        proxy.name = finalName;

        this.config.proxies.push(proxy);
    }

    // 添加自动选择组 (URL Test)
    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        const normalize = (s) => typeof s === 'string' ? s.trim() : s;
        const autoName = t('outboundNames.Auto Select');
        const exists = this.config['proxy-groups'].some(g => g && normalize(g.name) === normalize(autoName));
        if (exists) return;
        this.config['proxy-groups'].push({
            name: autoName,
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://www.gstatic.com/generate_204',
            interval: 300,
            lazy: false
        });
    }

    // 添加节点选择组 (Select)
    addNodeSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        const normalize = (s) => typeof s === 'string' ? s.trim() : s;
        const nodeName = t('outboundNames.Node Select');
        const exists = this.config['proxy-groups'].some(g => g && normalize(g.name) === normalize(nodeName));
        if (exists) return;
        const members = buildNodeSelectMembers({
            groupByCountry: this.groupByCountry,
            manualGroupName: this.manualGroupName,
            countryGroupNames: this.countryGroupNames,
            proxyList
        });
        this.config['proxy-groups'].unshift({
            type: 'select',
            name: nodeName,
            proxies: members
        });
    }

    // 构建选择器组的成员列表
    buildSelectGroupMembers(proxyList = []) {
        return buildAggregatedMembers({
            groupByCountry: this.groupByCountry,
            manualGroupName: this.manualGroupName,
            countryGroupNames: this.countryGroupNames,
            proxyList
        });
    }

    // 添加各种出站策略组
    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound !== t('outboundNames.Node Select')) {
                const normalize = (s) => typeof s === 'string' ? s.trim() : s;
                const name = t(`outboundNames.${outbound}`);
                const exists = this.config['proxy-groups'].some(g => g && normalize(g.name) === normalize(name));
                if (!exists) {
                    const proxies = this.buildSelectGroupMembers(proxyList);
                    this.config['proxy-groups'].push({
                        type: "select",
                        name,
                        proxies
                    });
                }
            }
        });
    }

    // 添加自定义规则对应的出站组
    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                const normalize = (s) => typeof s === 'string' ? s.trim() : s;
                const name = t(`outboundNames.${rule.name}`);
                const exists = this.config['proxy-groups'].some(g => g && normalize(g.name) === normalize(name));
                if (!exists) {
                    const proxies = this.buildSelectGroupMembers(proxyList);
                    this.config['proxy-groups'].push({
                        type: "select",
                        name,
                        proxies
                    });
                }
            });
        }
    }

    // 添加回退组
    addFallBackGroup(proxyList) {
        const normalize = (s) => typeof s === 'string' ? s.trim() : s;
        const name = t('outboundNames.Fall Back');
        const exists = this.config['proxy-groups'].some(g => g && normalize(g.name) === normalize(name));
        if (exists) return;
        const proxies = this.buildSelectGroupMembers(proxyList);
        this.config['proxy-groups'].push({
            type: "select",
            name,
            proxies
        });
    }

    // 添加按国家/地区分组
    addCountryGroups() {
        const proxies = this.getProxies();
        const countryGroups = {};

        proxies.forEach(proxy => {
            const countryInfo = parseCountryFromNodeName(proxy.name);
            if (countryInfo) {
                const { name } = countryInfo;
                if (!countryGroups[name]) {
                    countryGroups[name] = { ...countryInfo, proxies: [] };
                }
                countryGroups[name].proxies.push(proxy.name);
            }
        });

        const normalize = (s) => typeof s === 'string' ? s.trim() : s;
        const existingNames = new Set((this.config['proxy-groups'] || []).map(g => normalize(g?.name)).filter(Boolean));
        
        const manualProxyNames = proxies.map(p => p?.name).filter(Boolean);
        const manualGroupName = manualProxyNames.length > 0 ? t('outboundNames.Manual Switch') : null;
        if (manualGroupName) {
            const manualNorm = normalize(manualGroupName);
            if (!existingNames.has(manualNorm)) {
                this.config['proxy-groups'].push({
                    name: manualGroupName,
                    type: 'select',
                    proxies: manualProxyNames
                });
                existingNames.add(manualNorm);
            }
        }

        const countries = Object.keys(countryGroups).sort((a, b) => a.localeCompare(b));
        const countryGroupNames = [];

        countries.forEach(country => {
            const { emoji, name, proxies } = countryGroups[country];
            const groupName = `${emoji} ${name}`;
            const norm = normalize(groupName);
            if (!existingNames.has(norm)) {
                this.config['proxy-groups'].push({
                    name: groupName,
                    type: 'url-test',
                    proxies: proxies,
                    url: 'https://www.gstatic.com/generate_204',
                    interval: 300,
                    lazy: false
                });
                existingNames.add(norm);
            }
            countryGroupNames.push(groupName);
        });

        const nodeSelectGroup = this.config['proxy-groups'].find(g => g && g.name === t('outboundNames.Node Select'));
        if (nodeSelectGroup && Array.isArray(nodeSelectGroup.proxies)) {
            nodeSelectGroup.proxies = buildNodeSelectMembers({
                groupByCountry: this.groupByCountry,
                manualGroupName,
                countryGroupNames,
                proxyList: this.getProxyList()
            });
        }
        this.countryGroupNames = countryGroupNames;
        this.manualGroupName = manualGroupName;
    }

    // 生成规则
    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    // 格式化最终的 Clash 配置
    formatConfig() {
        const rules = this.generateRules();
        const ruleResults = [];

        // 生成规则提供者
        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = {
            ...site_rule_providers,
            ...ip_rule_providers
        };

        // 生成规则
        rules.filter(rule => !!rule.domain_suffix || !!rule.domain_keyword).map(rule => {
            rule.domain_suffix.forEach(suffix => {
                ruleResults.push(`DOMAIN-SUFFIX,${suffix},${t('outboundNames.'+ rule.outbound)}`);
            });
            rule.domain_keyword.forEach(keyword => {
                ruleResults.push(`DOMAIN-KEYWORD,${keyword},${t('outboundNames.'+ rule.outbound)}`);
            });
        });

        rules.filter(rule => !!rule.site_rules[0]).map(rule => {
            rule.site_rules.forEach(site => {
                ruleResults.push(`RULE-SET,${site},${t('outboundNames.'+ rule.outbound)}`);
            });
        });

        rules.filter(rule => !!rule.ip_rules[0]).map(rule => {
            rule.ip_rules.forEach(ip => {
                ruleResults.push(`RULE-SET,${ip},${t('outboundNames.'+ rule.outbound)},no-resolve`);
            });
        });

        rules.filter(rule => !!rule.ip_cidr).map(rule => {
            rule.ip_cidr.forEach(cidr => {
                ruleResults.push(`IP-CIDR,${cidr},${t('outboundNames.'+ rule.outbound)},no-resolve`);
            });
        });

        // 清理代理组，确保引用的代理或组存在
        const normalize = (s) => typeof s === 'string' ? s.trim() : s;
        const groups = this.config['proxy-groups'] || [];
        if (Array.isArray(groups) && groups.length > 0) {
            const proxyNames = new Set((this.config.proxies || []).map(p => normalize(p?.name)).filter(Boolean));
            const groupNames = new Set(groups.map(g => normalize(g?.name)).filter(Boolean));
            const validNames = new Set(['DIRECT', 'REJECT'].map(normalize));
            proxyNames.forEach(n => validNames.add(n));
            groupNames.forEach(n => validNames.add(n));

            this.config['proxy-groups'] = groups.map(g => {
                if (!g || !Array.isArray(g.proxies)) return g;
                const filtered = g.proxies
                    .map(x => typeof x === 'string' ? x.trim() : x)
                    .filter(x => typeof x === 'string' && validNames.has(x));
                // 去重并保持顺序
                const seen = new Set();
                const deduped = filtered.filter(x => (seen.has(x) ? false : (seen.add(x), true)));
                return { ...g, proxies: deduped };
            });
        }

        this.config.rules = [...ruleResults];
        this.config.rules.push(`MATCH,${t('outboundNames.Fall Back')}`);

        // 将最终配置转换为 YAML 格式
        return yaml.dump(this.config);
    }
}
