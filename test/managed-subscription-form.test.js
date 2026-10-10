import { describe, it, expect, vi } from 'vitest';
import { managedSubscriptionLogic } from '../src/components/managedSubscriptionLogic.js';
import { formLogicFn } from '../src/components/formLogic.js';
import { translations } from '../src/i18n/index.js';

function form(fetch) {
    const fakeWindow = {
        location: new URL('https://sub.example/'),
        history: { replaceState: vi.fn() }, dispatchEvent: vi.fn(),
        APP_LANG: 'zh-CN', APP_TRANSLATIONS: { ...translations['zh-CN'], nodeSelectName: '🚀 节点选择' },
        PREDEFINED_RULE_SETS: { balanced: ['AI', 'Domestic'] }
    };
    fakeWindow.managedSubscriptionData = new Function('window', 'fetch', `return (${managedSubscriptionLogic.toString()})();`).bind(null, fakeWindow, fetch);
    const document = { querySelector: () => ({ value: '[]' }) };
    const Event = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
    new Function('window', 'document', 'CustomEvent', `(${formLogicFn.toString()})();`)(fakeWindow, document, Event);
    const data = fakeWindow.formData();
    data.managedToken = 'test-only-token';
    data.input = 'trojan://test@one.example:443?security=tls#one';
    return { data, fakeWindow };
}

describe('stable subscription form', () => {
    it('creates once, then updates the same code with the loaded revision', async () => {
        const fetch = vi.fn()
            .mockResolvedValueOnce(Response.json({ code: 'stable', revision: 'one', updateIntervalHours: 1 }))
            .mockResolvedValueOnce(Response.json({ code: 'stable', revision: 'two', updateIntervalHours: 2 }));
        const { data } = form(fetch);
        await data.saveManagedSubscription();
        const firstLinks = { ...data.managedLinks };
        data.input = 'trojan://test@two.example:443?security=tls#two';
        data.managedInterval = 2;
        await data.saveManagedSubscription();
        expect(fetch.mock.calls[0][0]).toBe('/api/subscriptions');
        expect(fetch.mock.calls[1][0]).toBe('/api/subscriptions/stable');
        expect(fetch.mock.calls[1][1].headers['If-Match']).toBe('"one"');
        expect(JSON.parse(fetch.mock.calls[1][1].body).query).toContain('two.example');
        expect(data.managedLinks).toEqual(firstLinks);
        expect(data.managedRevision).toBe('two');
        expect(JSON.parse(fetch.mock.calls[0][1].body).query).not.toContain('test-only-token');
    });

    it('loads legacy presets and clears stale form settings', async () => {
        const fetch = vi.fn().mockResolvedValue(Response.json({ code: 'old', legacy: true, revision: 'old-rev',
            query: '?config=source&selectedRules=balanced', baseConfig: null, clashOverrides: {}, updateIntervalHours: 1 }));
        const { data, fakeWindow } = form(fetch);
        data.managedCode = 'https://sub.example/c/old';
        data.externalController = 'stale:9090';
        data.currentConfigId = 'clash_old';
        data.customUA = 'stale-UA';
        data.configEditor = 'stale';
        await data.loadManagedSubscription();
        expect(data.managedError).toBe(false);
        expect(data.input).toBe('source');
        expect(data.selectedRules).toEqual(['AI', 'Domestic']);
        expect(data.externalController).toBe('');
        expect(data.currentConfigId).toBe('');
        expect(data.customUA).toBe('');
        expect(data.configEditor).toBe('');
        expect(fakeWindow.dispatchEvent.mock.calls[0][0].detail.rules).toEqual([]);
    });

    it('requires loading existing codes and never sends tokens to a foreign origin', async () => {
        const fetch = vi.fn();
        const { data } = form(fetch);
        data.managedCode = 'another-link';
        await data.saveManagedSubscription();
        expect(data.managedError).toBe(true);
        data.managedCode = 'https://other.example/c/link';
        await data.loadManagedSubscription();
        expect(data.managedError).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('reuses domestic domain providers and defaults all other DNS queries to the translated proxy', () => {
        const { data } = form(vi.fn());
        data.fillSplitDnsTemplate();
        const { dns } = JSON.parse(data.managedOverrides);
        expect(dns['nameserver-policy']['rule-set:cn,geolocation-cn']).toEqual(['https://dns.alidns.com/dns-query']);
        expect(data.selectedRules).toContain('Location:CN');
        expect(dns.nameserver.every(value => value.endsWith('#🚀 节点选择'))).toBe(true);
        expect(dns['nameserver-policy']['geosite:cn,private']).toBeNull();
        expect(dns['nameserver-policy']['geosite:geolocation-!cn']).toBeNull();
        expect(Object.keys(dns['nameserver-policy']).some(key => key.includes('openai'))).toBe(false);
        expect(dns['direct-nameserver']).toEqual([]);
        expect(dns.fallback).toEqual([]);
    });
});
