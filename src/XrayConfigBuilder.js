import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { downgradeByCaps } from './ir/core.js';
import { mapIRToXray } from './ir/maps/xray.js';
import { generateRules } from './config.js';
import { parseCountryFromNodeName } from './utils.js';

export class XrayConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent, groupByCountry = false, opts = {}) {
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
    this.useBalancer = !!opts?.useBalancer;
  }

  getProxies() {
    // For Xray, outbounds don't expose server directly; just return tagged outbounds
    return (this.config.outbounds || []).filter(o => typeof o?.tag === 'string');
  }

  getProxyName(proxy) {
    return proxy.tag;
  }

  convertProxy(proxy) {
    try {
      const downgraded = downgradeByCaps(proxy, 'xray');
      const mapped = mapIRToXray(downgraded, proxy);
      if (mapped) return mapped;
    } catch (e) {
      console.error(`Failed to map IR to Xray config for proxy: ${proxy.tags?.[0]}`, e);
    }
    return null;
  }

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

  addAutoSelectGroup() {}
  addNodeSelectGroup() {}
  addOutboundGroups() {}
  addCustomRuleGroups() {}
  addFallBackGroup() {}

  formatConfig() {
    const cfg = this.config;
    cfg.routing = cfg.routing || {};
    cfg.routing.rules = cfg.routing.rules || [];

    // Country-based balancers (leastPing)
    const outbounds = this.getProxies();
    const countryGroups = {};
    outbounds.forEach(o => {
      const info = parseCountryFromNodeName(o.tag || '');
      if (info) {
        const { name } = info;
        if (!countryGroups[name]) countryGroups[name] = [];
        countryGroups[name].push(o.tag);
      }
    });
    const balancers = [];
    const allTags = outbounds.map(o => o.tag).filter(Boolean);
    if (this.useBalancer || this.groupByCountry) {
      if (allTags.length > 0) {
        balancers.push({ tag: 'auto_select', selector: allTags, strategy: { type: 'leastPing' } });
      }
      Object.entries(countryGroups).forEach(([name, tags]) => {
        if (tags.length > 0) balancers.push({ tag: `country_${name}`, selector: tags, strategy: { type: 'leastPing' } });
      });
      if (balancers.length > 0) cfg.routing.balancers = balancers;
    }

    // Rules from selected/custom rules → map to geosite/geoip
    const rules = generateRules(this.selectedRules, this.customRules);
    const defaultOutbound = (this.useBalancer || this.groupByCountry) ? 'auto_select' : (allTags[0] || 'DIRECT');

    rules.filter(r => Array.isArray(r.domain_suffix) || Array.isArray(r.domain_keyword) || (Array.isArray(r.site_rules) && r.site_rules[0] !== ''))
      .forEach(r => {
        const domain = [];
        (r.domain_suffix || []).forEach(s => domain.push(`domain:${s}`));
        // For site rules, use geosite
        (r.site_rules || []).forEach(s => { if (s) domain.push(`geosite:${s}`); });
        cfg.routing.rules.push({ type: 'field', ...(domain.length ? { domain } : {}), outboundTag: defaultOutbound });
      });
    rules.filter(r => Array.isArray(r.ip_rules) && r.ip_rules[0] !== '').forEach(r => {
      const ip = r.ip_rules.map(ipr => `geoip:${ipr}`);
      cfg.routing.rules.push({ type: 'field', ip, outboundTag: defaultOutbound });
    });
    rules.filter(r => Array.isArray(r.ip_cidr)).forEach(r => {
      const ip = r.ip_cidr;
      cfg.routing.rules.push({ type: 'field', ip, outboundTag: defaultOutbound });
    });

    // Default: CN to DIRECT (common-sense)
    cfg.routing.rules.unshift({ type: 'field', domain: ['geosite:cn'], outboundTag: 'DIRECT' });
    cfg.routing.rules.unshift({ type: 'field', ip: ['geoip:cn'], outboundTag: 'DIRECT' });

    // Final: auto_select
    cfg.routing.rules.push({ type: 'field', outboundTag: defaultOutbound });

    return cfg;
  }
}
