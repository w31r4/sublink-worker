import yaml from 'js-yaml';
import { InvalidPayloadError, ServiceError } from './errors.js';

const KIND = 'sublink-managed-v1';
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const GENERATED_KEYS = new Set(['proxies', 'proxy-groups', 'proxy-providers', 'rules', 'rule-providers']);

export function validateShortCode(code) {
    if (typeof code !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(code) || /^(clash|singbox|surge)_/.test(code)) {
        throw new InvalidPayloadError('Use 1–64 letters, numbers, underscores or hyphens; config ID prefixes are reserved');
    }
    return code;
}

export function decodeShortLink(value) {
    if (!value) return null;
    if (value.startsWith('?')) return { query: value, legacy: true };
    try {
        const record = JSON.parse(value);
        if (record.kind === KIND && typeof record.query === 'string' && record.query.startsWith('?')) {
            return record;
        }
    } catch { /* Existing non-subscription KV entries must not become editable links. */ }
    throw new InvalidPayloadError('Stored value is not a subscription');
}

function assertSafe(value) {
    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            if (BLOCKED_KEYS.has(key)) throw new InvalidPayloadError('Unsupported object key');
            assertSafe(child);
        }
    }
}

function parseObject(value, label) {
    let result;
    try {
        result = typeof value === 'string' ? yaml.load(value, { schema: yaml.JSON_SCHEMA }) : value;
    } catch {
        throw new InvalidPayloadError(`${label} must be valid JSON or YAML`);
    }
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw new InvalidPayloadError(`${label} must be an object`);
    }
    // A JSON round trip also rejects recursive YAML aliases before recursive merging.
    try { result = JSON.parse(JSON.stringify(result)); } catch {
        throw new InvalidPayloadError(`${label} must not contain recursive values`);
    }
    assertSafe(result);
    return result;
}

export function parseClashOverrides(value = {}) {
    const overrides = parseObject(value, 'Clash overrides');
    if (Object.keys(overrides).some(key => GENERATED_KEYS.has(key))) {
        throw new InvalidPayloadError('Edit nodes and routing rules in the subscription form, not Clash overrides');
    }
    for (const key of ['dns', 'sniffer', 'tun']) {
        if (key in overrides && (!overrides[key] || typeof overrides[key] !== 'object' || Array.isArray(overrides[key]))) {
            throw new InvalidPayloadError(`${key} must be an object`);
        }
    }
    const dns = overrides.dns;
    for (const key of ['nameserver', 'default-nameserver', 'proxy-server-nameserver', 'direct-nameserver', 'fallback', 'fake-ip-filter']) {
        if (dns && key in dns && (!Array.isArray(dns[key]) || !dns[key].every(item => typeof item === 'string'))) {
            throw new InvalidPayloadError(`dns.${key} must be an array of strings`);
        }
    }
    if (dns && 'nameserver-policy' in dns) {
        const policy = dns['nameserver-policy'];
        if (!policy || typeof policy !== 'object' || Array.isArray(policy) || !Object.values(policy).every(value =>
            typeof value === 'string' || (Array.isArray(value) && value.every(server => typeof server === 'string')))) {
            throw new InvalidPayloadError('dns.nameserver-policy must map domains to DNS servers');
        }
    }
    return overrides;
}

// Replace arrays, merge maps: retaining an obsolete DNS server can undo a DNS repair.
export function mergeClashOverrides(base, overrides) {
    const result = structuredClone(base);
    for (const [key, value] of Object.entries(overrides)) {
        if (BLOCKED_KEYS.has(key)) throw new InvalidPayloadError('Unsupported object key');
        const isMap = value && typeof value === 'object' && !Array.isArray(value);
        const currentIsMap = result[key] && typeof result[key] === 'object' && !Array.isArray(result[key]);
        result[key] = isMap && currentIsMap
            ? mergeClashOverrides(result[key], value)
            : structuredClone(value);
    }
    return result;
}

async function snapshotBaseConfig(baseConfig, configId, storage) {
    if (baseConfig === undefined && configId) {
        const type = configId.split('_')[0];
        const content = await storage.getConfigById(configId);
        if (!content) throw new ServiceError('Referenced base config has expired or does not exist', 404);
        baseConfig = { type, content };
    }
    if (baseConfig == null) return null;
    if (!['clash', 'singbox', 'surge'].includes(baseConfig.type)) {
        throw new InvalidPayloadError('Unsupported base config type');
    }
    return { type: baseConfig.type, content: parseObject(baseConfig.content, 'Base config') };
}

export async function loadManagedSubscription(kv, code, storage) {
    validateShortCode(code);
    const record = decodeShortLink(await kv.get(code));
    if (!record) throw new ServiceError('Subscription not found', 404);
    if (!record.legacy) return record;
    const params = new URLSearchParams(record.query);
    const baseConfig = await snapshotBaseConfig(undefined, params.get('configId'), storage);
    params.delete('configId');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(record.query));
    return {
        ...record,
        query: `?${params}`,
        baseConfig,
        clashOverrides: {},
        revision: `legacy-${Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('')}`,
        updateIntervalHours: 1
    };
}

export async function saveManagedSubscription(kv, code, payload, expectedRevision, storage) {
    validateShortCode(code);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new InvalidPayloadError('Expected a subscription object');
    }
    const existing = await kv.get(code);
    const current = existing ? await loadManagedSubscription(kv, code, storage) : null;
    if ((current?.revision ?? null) !== expectedRevision) {
        throw new ServiceError('Subscription changed or already exists; reload before saving', 409);
    }
    if (typeof payload.query !== 'string' || !payload.query.startsWith('?')) {
        throw new InvalidPayloadError('query must start with ?');
    }
    const params = new URLSearchParams(payload.query);
    if (!params.get('config')?.trim()) throw new InvalidPayloadError('Missing subscription input');
    const baseConfig = await snapshotBaseConfig(payload.baseConfig, params.get('configId'), storage);
    params.delete('configId');
    const updateIntervalHours = payload.updateIntervalHours ?? 1;
    if (!Number.isInteger(updateIntervalHours) || updateIntervalHours < 1 || updateIntervalHours > 8760) {
        throw new InvalidPayloadError('Update interval must be 1–8760 hours');
    }
    const record = {
        kind: KIND,
        query: `?${params}`,
        baseConfig,
        clashOverrides: parseClashOverrides(payload.clashOverrides ?? {}),
        updateIntervalHours,
        revision: crypto.randomUUID(),
        updatedAt: new Date().toISOString()
    };
    const serialized = JSON.stringify(record);
    if (new TextEncoder().encode(serialized).length > 512 * 1024) {
        throw new ServiceError('Subscription exceeds 512 KiB', 413);
    }
    // A single permanent record keeps the query, DNS patch and base config together.
    // KV revision checks catch stale editors but are not a distributed compare-and-swap.
    await kv.put(code, serialized);
    return record;
}
