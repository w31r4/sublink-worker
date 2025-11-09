import { parse as parseProxyLink } from './parsers/index.js';
import { DeepCopy, tryDecodeSubscriptionLines, decodeBase64, parseCountryFromNodeName } from './utils.js';
import yaml from 'js-yaml';
import { t, setLanguage } from './i18n/index.js';
import { generateRules, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';

import { convertYamlProxyToObject } from './parsers/yamlHelper.js';

export class BaseConfigBuilder {
    constructor(inputString, baseConfig, lang, userAgent, groupByCountry = false) {
        this.inputString = inputString;
        this.config = DeepCopy(baseConfig);
        this.customRules = [];
        this.selectedRules = [];
        setLanguage(lang);
        this.userAgent = userAgent;
        this.appliedOverrideKeys = new Set();
        this.groupByCountry = groupByCountry;
    }

    async build() {
        const customItems = await this.parseCustomItems();
        this.addCustomItems(customItems);
        this.addSelectors();
        return this.formatConfig();
    }

    async parseCustomItems() {
        const input = this.inputString || '';
        const trimmedInput = input.trim();
        let parsedItems = [];

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
                // Ignore YAML errors here and fall back to other strategies
            }
            return null;
        };

        // 1) Try parsing as-is (plain YAML, proxies block can be anywhere)
        const directYamlItems = tryParseYamlDocument(trimmedInput);
        if (directYamlItems) {
            return directYamlItems;
        }

        // 2) If the whole input looks like base64, decode once and try YAML again
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
                // Ignore decoding errors and fall back to line processing
            }
        }

        // 3) Fallback to line-by-line parsing for proxy links or subscriptions
        const lines = input.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
            let decodedLines = tryDecodeSubscriptionLines(line);
            if (!Array.isArray(decodedLines)) {
                decodedLines = [decodedLines];
            }

            for (const decodedLine of decodedLines) {
                if (decodedLine.startsWith('http')) { // It's a subscription link
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
                        console.warn(`Failed to fetch or process subscription: ${decodedLine}`, e);
                    }
                } else { // It's a direct proxy link
                    const proxy = await parseProxyLink(decodedLine, this.userAgent);
                    if (proxy) parsedItems.push(proxy);
                }
            }
        }

        return parsedItems.flat().filter(Boolean);
    }

    applyConfigOverrides(overrides) {
        if (!overrides || typeof overrides !== 'object') {
            return;
        }

        // Allow incoming Clash YAML to override most fields, including 'proxy-groups'.
        // Still block 'proxies' (handled by dedicated parser), and keep ignoring
        // 'rules' and 'rule-providers' which are generated by our own logic.
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

    hasConfigOverride(key) {
        return this.appliedOverrideKeys?.has(key);
    }

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

    getProxyList() {
        return this.getProxies().map(proxy => this.getProxyName(proxy));
    }

    getProxies() {
        throw new Error('getProxies must be implemented in child class');
    }

    getProxyName(proxy) {
        throw new Error('getProxyName must be implemented in child class');
    }

    convertProxy(proxy) {
        throw new Error('convertProxy must be implemented in child class');
    }

    addProxyToConfig(proxy) {
        throw new Error('addProxyToConfig must be implemented in child class');
    }

    addAutoSelectGroup(proxyList) {
        throw new Error('addAutoSelectGroup must be implemented in child class');
    }

    addNodeSelectGroup(proxyList) {
        throw new Error('addNodeSelectGroup must be implemented in child class');
    }

    addOutboundGroups(outbounds, proxyList) {
        throw new Error('addOutboundGroups must be implemented in child class');
    }

    addCustomRuleGroups(proxyList) {
        throw new Error('addCustomRuleGroups must be implemented in child class');
    }

    addFallBackGroup(proxyList) {
        throw new Error('addFallBackGroup must be implemented in child class');
    }

    addCountryGroups() {
        throw new Error('addCountryGroups must be implemented in child class');
    }

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

    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    formatConfig() {
        throw new Error('formatConfig must be implemented in child class');
    }
}
