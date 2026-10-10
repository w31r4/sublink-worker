import { describe, it, expect, vi } from 'vitest';
import yaml from 'js-yaml';
import { createApp } from '../src/app/createApp.jsx';
import { MemoryKVAdapter } from '../src/adapters/kv/memoryKv.js';
import { mergeClashOverrides } from '../src/services/managedSubscriptionService.js';
import { createCloudflareRuntime } from '../src/runtime/cloudflare.js';
import { createNodeRuntime } from '../src/runtime/node.js';
import { createVercelRuntime } from '../src/runtime/vercel.js';

vi.mock('ioredis', () => ({ default: vi.fn() }));

const TOKEN = 'local-test-management-token-not-a-real-secret';
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const payload = (name = 'first') => ({
    query: `?${new URLSearchParams({ config: `trojan://test-password@${name}.example.com:443?security=tls#${name}`, selectedRules: 'balanced' })}`,
    clashOverrides: { dns: { nameserver: ['https://dns.example/dns-query'] } }
});
const setup = (config = {}) => {
    const kv = new MemoryKVAdapter();
    const app = createApp({ kv, config: { adminToken: TOKEN, ...config }, logger: { error() {} } });
    const request = (path, options) => app.request(`https://sub.example${path}`, options);
    const create = async (body = payload()) => {
        const res = await request('/api/subscriptions', { method: 'POST', headers: auth, body: JSON.stringify(body) });
        expect(res.status).toBe(201);
        return res.json();
    };
    const update = (record, body) => request(`/api/subscriptions/${record.code}`, {
        method: 'PUT', headers: { ...auth, 'If-Match': `"${record.revision}"` }, body: JSON.stringify(body)
    });
    return { kv, app, request, create, update };
};

describe('managed subscriptions', () => {
    it('keeps the same public URL while nodes and DNS change, with no redirect', async () => {
        const { create, update, request } = setup();
        const saved = await create();
        const path = `/c/${saved.code}`;
        const first = await request(path);
        expect(first.status).toBe(200);
        expect(first.headers.get('Location')).toBeNull();
        expect(first.headers.get('Cache-Control')).toBe('no-store');
        expect(first.headers.get('profile-update-interval')).toBe('1');
        expect(yaml.load(await first.text()).proxies[0].server).toBe('first.example.com');
        const changed = payload('second');
        changed.clashOverrides.dns.nameserver = ['https://new-dns.example/dns-query'];
        changed.clashOverrides.dns['nameserver-policy'] = { '+.example.cn': ['https://dns.alidns.com/dns-query'] };
        const response = await update(saved, changed);
        expect(response.status).toBe(200);
        const second = await request(path);
        const config = yaml.load(await second.text());
        expect(config.proxies[0].server).toBe('second.example.com');
        expect(config.dns.nameserver).toEqual(['https://new-dns.example/dns-query']);
        expect(config.dns['nameserver-policy']['+.example.cn']).toEqual(['https://dns.alidns.com/dns-query']);
        expect(config.dns['nameserver-policy']['geosite:cn,private']).toBeDefined();
        expect(second.headers.get('X-Subscription-Revision')).not.toBe(saved.revision);
    });

    it('requires authentication for creation, loading and update, including root POST', async () => {
        const { request, create } = setup();
        const saved = await create();
        for (const [path, method] of [['/api/subscriptions', 'POST'], [`/api/subscriptions/${saved.code}`, 'GET'], [`/api/subscriptions/${saved.code}`, 'PUT']]) {
            const res = await request(path, { method });
            expect(res.status).toBe(401);
            expect(res.headers.get('Cache-Control')).toBe('no-store');
        }
        const { request: disabled } = setup({ adminToken: null });
        expect((await disabled('/api/subscriptions', { method: 'POST', headers: auth, body: JSON.stringify(payload()) })).status).toBe(503);
    });

    it('migrates an old short code without changing any of its four URLs', async () => {
        const { kv, request, update } = setup();
        await kv.put('old-link', payload().query);
        const legacy = await request('/c/old-link');
        expect(legacy.status).toBe(302);
        expect(legacy.headers.get('Cache-Control')).toBe('no-store');
        const loaded = await (await request('/api/subscriptions/old-link', { headers: auth })).json();
        expect(loaded.legacy).toBe(true);
        expect((await update(loaded, payload('migrated'))).status).toBe(200);
        for (const prefix of ['c', 'b', 's', 'x']) {
            const res = await request(`/${prefix}/old-link`);
            expect(res.status).toBe(200);
            expect(res.headers.get('Location')).toBeNull();
            const text = await res.text();
            if (prefix === 's') {
                expect(text).toContain('https://sub.example/s/old-link');
                expect(text).toContain('interval=3600');
                expect(text).not.toContain('/surge?');
            }
        }
    });

    it('protects managed records from the legacy shortening endpoint even with admin auth', async () => {
        const { request, create } = setup();
        const saved = await create();
        const path = `/shorten-v2?${new URLSearchParams({ url: `https://sub.example/clash${payload('evil').query}`, shortCode: saved.code })}`;
        expect((await request(path)).status).toBe(409);
        expect((await request(path, { headers: auth })).status).toBe(409);
        const config = yaml.load(await (await request(`/c/${saved.code}`)).text());
        expect(config.proxies[0].server).toBe('first.example.com');
    });

    it('requires auth to overwrite a legacy record when management is enabled', async () => {
        const { kv, request } = setup();
        await kv.put('legacy', payload().query);
        const path = `/shorten-v2?${new URLSearchParams({ url: `https://sub.example/clash${payload('changed').query}`, shortCode: 'legacy' })}`;
        expect((await request(path)).status).toBe(401);
        expect((await request(path, { headers: auth })).status).toBe(200);
    });

    it('rejects stale editor saves, missing revisions and malformed JSON', async () => {
        const { create, request, update } = setup();
        const saved = await create();
        expect((await request(`/api/subscriptions/${saved.code}`, { method: 'PUT', headers: auth, body: '{}' })).status).toBe(428);
        expect((await update(saved, payload('second'))).status).toBe(200);
        expect((await update(saved, payload('third'))).status).toBe(409);
        expect((await request('/api/subscriptions', { method: 'POST', headers: auth, body: '{' })).status).toBe(400);
    });

    it('snapshots expiring base configs and does not assign a TTL to managed records', async () => {
        const { kv, request, create } = setup({ shortLinkTtlSeconds: 60, configTtlSeconds: 60 });
        const response = await request('/config', { method: 'POST', headers: auth,
            body: JSON.stringify({ type: 'clash', content: { 'mixed-port': 17777, dns: { enable: true } } }) });
        const configId = await response.text();
        const saved = await create({ ...payload(), query: `${payload().query}&configId=${configId}`, clashOverrides: {} });
        expect(saved.baseConfig.type).toBe('clash');
        expect(saved.query).not.toContain('configId');
        expect(kv.expirations.has(saved.code)).toBe(false);
        await kv.delete(configId);
        const config = yaml.load(await (await request(`/c/${saved.code}`)).text());
        expect(config['mixed-port']).toBe(17777);
        expect((await request(`/b/${saved.code}`)).status).toBe(200);
    });

    it('rejects an expired base config instead of silently losing it during migration', async () => {
        const { kv, request } = setup();
        await kv.put('expired', `${payload().query}&configId=clash_missing`);
        expect((await request('/api/subscriptions/expired', { headers: auth })).status).toBe(404);
        expect(await kv.get('expired')).toContain('configId=clash_missing');
    });

    it('rejects bad content without changing the previously working subscription', async () => {
        const { create, update, request } = setup();
        const saved = await create();
        for (const overrides of ['dns: [', 'null', '[]', 'proxies: []', 'dns: false',
            'dns: { nameserver: invalid }', 'dns: { nameserver-policy: [] }',
            'dns: { nameserver-policy: { example.com: 123 } }',
            'dns: { __proto__: { polluted: true } }', 'dns: &loop { value: *loop }']) {
            expect((await update(saved, { ...payload('bad'), clashOverrides: overrides })).status).toBe(400);
        }
        expect((await update(saved, { ...payload(), updateIntervalHours: 0 })).status).toBe(400);
        const config = yaml.load(await (await request(`/c/${saved.code}`)).text());
        expect(config.proxies[0].server).toBe('first.example.com');
        expect({}.polluted).toBeUndefined();
    });

    it('rejects oversized management bodies before storing a record', async () => {
        const { request } = setup();
        const response = await request('/api/subscriptions', { method: 'POST', headers: auth,
            body: JSON.stringify({ ...payload(), padding: 'x'.repeat(512 * 1024) }) });
        expect(response.status).toBe(413);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('forwards the client UA and upstream subscription metadata through the stable endpoint', async () => {
        const { create, request } = setup();
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('trojan://pass@upstream.example:443?security=tls#remote', {
            headers: { 'subscription-userinfo': 'upload=1; download=2; total=999' }
        }));
        try {
            const saved = await create({ query: '?config=https%3A%2F%2Fupstream.example%2Fsub' });
            const res = await request(`/c/${saved.code}`, { headers: { 'User-Agent': 'Clash/1.0' } });
            expect(res.status).toBe(200);
            expect(res.headers.get('subscription-userinfo')).toBe('upload=1; download=2; total=999');
            const config = yaml.load(await res.text());
            expect(Object.values(config['rule-providers']).every(provider => provider.format !== 'mrs')).toBe(true);
            expect(fetchMock).toHaveBeenCalled();
        } finally { fetchMock.mockRestore(); }
    });

    it('does not expose managed editing state via the public resolve endpoint', async () => {
        const { request, create } = setup();
        const saved = await create();
        const path = `/resolve?url=${encodeURIComponent(`https://sub.example/c/${saved.code}`)}`;
        expect((await request(path)).status).toBe(401);
        expect(await (await request(path, { headers: auth })).json()).toEqual({ managed: true, code: saved.code });
    });

    it('does not overwrite config IDs through custom short codes', async () => {
        const { kv, request } = setup();
        await kv.put('clash_keep', '{"port":1234}');
        const path = `/shorten-v2?${new URLSearchParams({ url: `https://sub.example/clash${payload().query}`, shortCode: 'clash_keep' })}`;
        expect((await request(path, { headers: auth })).status).toBe(400);
        expect(await kv.get('clash_keep')).toBe('{"port":1234}');
    });

    it('merges DNS maps but replaces nameserver arrays without mutating the base', () => {
        const base = { dns: { nameserver: ['old'], 'nameserver-policy': { '+.corp.example': ['system'] } } };
        const result = mergeClashOverrides(base, { dns: { nameserver: ['new'], 'nameserver-policy': { 'geosite:cn': ['domestic'] } } });
        expect(result.dns.nameserver).toEqual(['new']);
        expect(result.dns['nameserver-policy']['+.corp.example']).toEqual(['system']);
        expect(base.dns.nameserver).toEqual(['old']);
    });

    it('wires the management secret through every runtime', () => {
        const env = { SUBLINK_ADMIN_TOKEN: TOKEN };
        for (const factory of [createCloudflareRuntime, createNodeRuntime, createVercelRuntime]) {
            expect(factory(env).config.adminToken).toBe(TOKEN);
        }
    });
});
