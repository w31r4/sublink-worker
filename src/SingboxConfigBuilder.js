import { SING_BOX_CONFIG, generateRuleSets, generateRules, getOutbounds, PREDEFINED_RULE_SETS} from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy, parseCountryFromNodeName } from './utils.js';
import { mapIRToSingbox } from './ir/maps/singbox.js';
import { downgradeByCaps } from './ir/core.js';
import { buildAggregatedMembers, buildNodeSelectMembers } from './groupHelpers.js';
import { t } from './i18n/index.js';

// Sing-box 配置生成器
export class SingboxConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent, groupByCountry = false) {
        // 如果没有提供基础配置，则使用默认的 Sing-box 配置
        if (baseConfig === undefined) {
            baseConfig = SING_BOX_CONFIG;
            if (baseConfig.dns && baseConfig.dns.servers) {
                // 更新 DNS 配置中的绕过选项
                baseConfig.dns.servers[0].detour = t('outboundNames.Node Select');
            }
        }
        super(inputString, baseConfig, lang, userAgent, groupByCountry);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
        this.countryGroupNames = [];
        this.manualGroupName = null;
    }

    // 获取所有代理出站
    getProxies() {
        return this.config.outbounds.filter(outbound => outbound?.server != undefined);
    }

    // 获取代理的名称 (tag)
    getProxyName(proxy) {
        return proxy.tag;
    }

    // 将中间表示 (IR) 转换为 Sing-box 的代理格式
    convertProxy(proxy) {
        try {
            const downgraded = downgradeByCaps(proxy, 'singbox');
            const mapped = mapIRToSingbox(downgraded, proxy);
            if (mapped) return mapped;
        } catch (e) {
            console.error(`将 IR 映射到 Sing-box 配置失败: ${proxy.tags?.[0]}`, e);
        }
        return null;
    }

    // 添加代理到配置中，并处理重名问题
    addProxyToConfig(proxy) {
        this.config.outbounds = this.config.outbounds || [];

        const existingTags = new Set(this.config.outbounds.map(o => o.tag));
        let finalTag = proxy.tag;
        let counter = 2;
        while (existingTags.has(finalTag)) {
            finalTag = `${proxy.tag} ${counter++}`;
        }
        proxy.tag = finalTag;

        this.config.outbounds.push(proxy);
    }

    // 添加自动选择组 (URL Test)
    addAutoSelectGroup(proxyList) {
        this.config.outbounds.unshift({
            type: "urltest",
            tag: t('outboundNames.Auto Select'),
            outbounds: DeepCopy(proxyList),
        });
    }

    // 添加节点选择组 (Selector)
    addNodeSelectGroup(proxyList) {
        const members = buildNodeSelectMembers({
            groupByCountry: this.groupByCountry,
            manualGroupName: this.manualGroupName,
            countryGroupNames: this.countryGroupNames,
            proxyList
        });
        this.config.outbounds.unshift({
            type: 'selector',
            tag: t('outboundNames.Node Select'),
            outbounds: members
        });
    }

    // 构建选择器组的成员列表
    buildSelectorMembers(proxyList = []) {
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
                const selectorMembers = this.buildSelectorMembers(proxyList);
                this.config.outbounds.push({
                    type: "selector",
                    tag: t(`outboundNames.${outbound}`),
                    outbounds: selectorMembers
                });
            }
        });
    }

    // 添加自定义规则对应的出站组
    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                const selectorMembers = this.buildSelectorMembers(proxyList);
                this.config.outbounds.push({
                    type: "selector",
                    tag: rule.name,
                    outbounds: selectorMembers
                });
            });
        }
    }

    // 添加回退组
    addFallBackGroup(proxyList) {
        const selectorMembers = this.buildSelectorMembers(proxyList);
        this.config.outbounds.push({
            type: "selector",
            tag: t('outboundNames.Fall Back'),
            outbounds: selectorMembers
        });
    }

    // 添加按国家/地区分组
    addCountryGroups() {
        const proxies = this.getProxies();
        const countryGroups = {};

        proxies.forEach(proxy => {
            const countryInfo = parseCountryFromNodeName(proxy?.tag || '');
            if (countryInfo) {
                const { name } = countryInfo;
                if (!countryGroups[name]) {
                    countryGroups[name] = { ...countryInfo, proxies: [] };
                }
                countryGroups[name].proxies.push(proxy.tag);
            }
        });

        const normalize = (s) => typeof s === 'string' ? s.trim() : s;
        const existingTags = new Set((this.config.outbounds || []).map(o => normalize(o?.tag)).filter(Boolean));

        const manualProxyNames = proxies.map(p => p?.tag).filter(Boolean);
        const manualGroupName = manualProxyNames.length > 0 ? t('outboundNames.Manual Switch') : null;
        if (manualGroupName) {
            const manualNorm = normalize(manualGroupName);
            if (!existingTags.has(manualNorm)) {
                this.config.outbounds.push({
                    type: 'selector',
                    tag: manualGroupName,
                    outbounds: manualProxyNames
                });
                existingTags.add(manualNorm);
            }
        }

        const countries = Object.keys(countryGroups).sort((a, b) => a.localeCompare(b));
        const countryGroupNames = [];

        countries.forEach(country => {
            const { emoji, name, proxies: countryProxies } = countryGroups[country];
            if (!countryProxies || countryProxies.length === 0) {
                return;
            }
            const groupName = `${emoji} ${name}`;
            const norm = normalize(groupName);
            if (!existingTags.has(norm)) {
                this.config.outbounds.push({
                    tag: groupName,
                    type: 'urltest',
                    outbounds: countryProxies
                });
                existingTags.add(norm);
            }
            countryGroupNames.push(groupName);
        });

        const nodeSelectTag = t('outboundNames.Node Select');
        const nodeSelectGroup = this.config.outbounds.find(o => normalize(o?.tag) === normalize(nodeSelectTag));
        if (nodeSelectGroup && Array.isArray(nodeSelectGroup.outbounds)) {
            nodeSelectGroup.outbounds = buildNodeSelectMembers({
                groupByCountry: this.groupByCountry,
                manualGroupName,
                countryGroupNames,
                proxyList: this.getProxyList()
            });
        }

        this.countryGroupNames = countryGroupNames;
        this.manualGroupName = manualGroupName;
    }

    // 格式化最终的 Sing-box 配置
    formatConfig() {
        const rules = generateRules(this.selectedRules, this.customRules);
        const { site_rule_sets, ip_rule_sets } = generateRuleSets(this.selectedRules,this.customRules);

        this.config.route.rule_set = [...site_rule_sets, ...ip_rule_sets];

        // 根据规则生成路由条目
        rules.filter(rule => !!rule.domain_suffix || !!rule.domain_keyword).map(rule => {
            this.config.route.rules.push({
                domain_suffix: rule.domain_suffix,
                domain_keyword: rule.domain_keyword,
                protocol: rule.protocol,
                outbound: t(`outboundNames.${rule.outbound}`)
            });
        });

        rules.filter(rule => !!rule.site_rules[0]).map(rule => {
            this.config.route.rules.push({
                rule_set: [
                ...(rule.site_rules.length > 0 && rule.site_rules[0] !== '' ? rule.site_rules : []),
                ],
                protocol: rule.protocol,
                outbound: t(`outboundNames.${rule.outbound}`)
            });
        });

        rules.filter(rule => !!rule.ip_rules[0]).map(rule => {
            this.config.route.rules.push({
                rule_set: [
                ...(rule.ip_rules.filter(ip => ip.trim() !== '').map(ip => `${ip}-ip`))
                ],
                protocol: rule.protocol,
                outbound: t(`outboundNames.${rule.outbound}`)
          });
        });

        rules.filter(rule => !!rule.ip_cidr).map(rule => {
            this.config.route.rules.push({
                ip_cidr: rule.ip_cidr,
                protocol: rule.protocol,
                outbound: t(`outboundNames.${rule.outbound}`)
            });
        });

        // 添加一些内置的规则
        this.config.route.rules.unshift(
            { clash_mode: 'direct', outbound: 'DIRECT' },
            { clash_mode: 'global', outbound: t('outboundNames.Node Select') },
            { action: 'sniff' },
            { protocol: 'dns', action: 'hijack-dns' }
        );

        this.config.route.auto_detect_interface = true;
        this.config.route.final = t('outboundNames.Fall Back');

        return this.config;
    }
}
