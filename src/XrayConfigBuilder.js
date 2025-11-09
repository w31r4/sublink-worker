import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { toIR } from './ir/convert.js';
import { downgradeByCaps } from './ir/core.js';
import { mapIRToXray } from './ir/maps/xray.js';

export class XrayConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent, groupByCountry = false) {
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
  }

  getProxies() {
    return (this.config.outbounds || []).filter(o => o?.protocol && o?.server);
  }

  getProxyName(proxy) {
    return proxy.tag;
  }

  convertProxy(proxy) {
    try {
      const ir = toIR(proxy);
      const mapped = mapIRToXray(downgradeByCaps(ir, 'xray'), proxy);
      if (mapped) return mapped;
    } catch (_) {}
    return null;
  }

  addProxyToConfig(proxy) {
    if (!proxy) return;
    this.config.outbounds = this.config.outbounds || [];
    const similar = this.config.outbounds.filter(p => p.tag && p.tag.includes(proxy.tag));
    if (similar.some(p => JSON.stringify({ ...p, tag: undefined }) === JSON.stringify({ ...proxy, tag: undefined }))) {
      return;
    }
    if (similar.length > 0) {
      proxy.tag = `${proxy.tag} ${similar.length + 1}`;
    }
    this.config.outbounds.push(proxy);
  }

  addAutoSelectGroup() {}
  addNodeSelectGroup() {}
  addOutboundGroups() {}
  addCustomRuleGroups() {}
  addFallBackGroup() {}

  formatConfig() {
    return this.config;
  }
}

