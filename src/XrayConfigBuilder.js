import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { downgradeByCaps } from './ir/core.js';
import { mapIRToXray } from './ir/maps/xray.js';
import { generateRules } from './config.js';
import { parseCountryFromNodeName } from './utils.js';

const RESERVED_OUTBOUND_TAGS = new Set(['DIRECT', 'REJECT']);
const RESERVED_OUTBOUND_PROTOCOLS = new Set(['freedom', 'blackhole']);

// Xray 配置生成器
export class XrayConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent, groupByCountry = false, opts = {}) {
    // 默认的基础配置
    const defaultBase = {
      log: { loglevel: 'warning' },
      outbounds: [
        { protocol: 'freedom', tag: 'DIRECT' },
        { protocol: 'blackhole', tag: 'REJECT' }
      ],
      routing: { rules: [] }
    };
    super(inputString, baseConfig || defaultBase, lang, userAgent, groupByCountry);
    this.selectedRules = selectedRules;
    this.customRules = customRules;
    this.useBalancer = !!opts?.useBalancer; // 是否使用负载均衡
  }

  // 获取所有代理出站
  getProxies() {
    return (this.config.outbounds || []).filter(o => {
      const tag = typeof o?.tag === 'string' ? o.tag : '';
      if (!tag) return false;
      if (RESERVED_OUTBOUND_TAGS.has(tag)) return false;
      if (RESERVED_OUTBOUND_PROTOCOLS.has(o?.protocol)) return false;
      return true;
    });
  }

  // 获取代理的名称 (tag)
  getProxyName(proxy) {
    return proxy.tag;
  }

  // 将中间表示 (IR) 转换为 Xray 的代理格式
  convertProxy(proxy) {
    try {
      const downgraded = downgradeByCaps(proxy, 'xray');
      const mapped = mapIRToXray(downgraded, proxy);
      if (mapped) return mapped;
    } catch (e) {
      console.error(`将 IR 映射到 Xray 配置失败: ${proxy.tags?.[0]}`, e);
    }
    return null;
  }

  // 添加代理到配置中，并处理重名问题
  addProxyToConfig(proxy) {
      if (!proxy) return;
      this.config.outbounds = this.config.outbounds || [];
      
      const existingNames = new Set(this.config.outbounds.map(p => p.tag));
      let finalTag = proxy.tag;
      let counter = 2;
      while (existingNames.has(finalTag)) {
          finalTag = `${proxy.tag} ${counter++}`;
      }
      proxy.tag = finalTag;

      this.config.outbounds.push(proxy);
  }

  // Xray 不支持复杂的代理组，这些方法为空
  addAutoSelectGroup() {}
  addNodeSelectGroup() {}
  addOutboundGroups() {}
  addCustomRuleGroups() {}
  addFallBackGroup() {}
  addCountryGroups() {}

  // 格式化最终的 Xray 配置
  formatConfig() {
    const cfg = this.config;
    cfg.routing = cfg.routing || {};
    cfg.routing.rules = cfg.routing.rules || [];

    const outbounds = this.getProxies();
    const allTags = outbounds.map(o => o.tag).filter(Boolean);

    const wantsBalancer = this.useBalancer || this.groupByCountry;
    const enableBalancer = wantsBalancer && allTags.length > 0;

    if (enableBalancer) {
      // 如果启用，则创建基于国家/地区的负载均衡器
      const countryGroups = {};
      outbounds.forEach(o => {
        const info = parseCountryFromNodeName(o.tag || '');
        if (info) {
          const { name } = info;
          if (!countryGroups[name]) countryGroups[name] = [];
          countryGroups[name].push(o.tag);
        }
      });

      const balancers = [{ tag: 'auto_select', selector: allTags, strategy: { type: 'leastPing' } }];
      Object.entries(countryGroups).forEach(([name, tags]) => {
        if (tags.length > 0) balancers.push({ tag: `country_${name}`, selector: tags, strategy: { type: 'leastPing' } });
      });
      cfg.routing.balancers = balancers;
    }

    const routeTarget = enableBalancer
      ? { balancerTag: 'auto_select' }
      : { outboundTag: allTags[0] || 'DIRECT' };

    // 根据选择的规则生成路由规则
    const rules = generateRules(this.selectedRules, this.customRules);

    rules.filter(r => Array.isArray(r.domain_suffix) || Array.isArray(r.domain_keyword) || (Array.isArray(r.site_rules) && r.site_rules[0] !== ''))
      .forEach(r => {
        const domain = [];
        (r.domain_suffix || []).forEach(s => domain.push(`domain:${s}`));
        (r.site_rules || []).forEach(s => { if (s) domain.push(`geosite:${s}`); });
        cfg.routing.rules.push({ type: 'field', ...(domain.length ? { domain } : {}), ...routeTarget });
      });
    rules.filter(r => Array.isArray(r.ip_rules) && r.ip_rules[0] !== '').forEach(r => {
      const ip = r.ip_rules.map(ipr => `geoip:${ipr}`);
      cfg.routing.rules.push({ type: 'field', ip, ...routeTarget });
    });
    rules.filter(r => Array.isArray(r.ip_cidr)).forEach(r => {
      const ip = r.ip_cidr;
      cfg.routing.rules.push({ type: 'field', ip, ...routeTarget });
    });

    // 添加默认规则，将中国大陆流量直连
    cfg.routing.rules.unshift({ type: 'field', domain: ['geosite:cn'], outboundTag: 'DIRECT' });
    cfg.routing.rules.unshift({ type: 'field', ip: ['geoip:cn'], outboundTag: 'DIRECT' });

    // 最终的回退规则
    cfg.routing.rules.push({ type: 'field', ...routeTarget });

    return cfg;
  }
}
