import { MissingDependencyError, ServiceError } from './errors.js';
import { decodeShortLink, validateShortCode } from './managedSubscriptionService.js';

export class ShortLinkService {
    constructor(kv, options = {}) {
        this.kv = kv;
        this.options = options;
    }

    ensureKv() {
        if (!this.kv) {
            throw new MissingDependencyError('Short link service requires a KV store');
        }
        return this.kv;
    }

    async createShortLink(queryString, providedCode, { allowOverwrite = true } = {}) {
        const kv = this.ensureKv();
        let shortCode = providedCode ? validateShortCode(providedCode) : crypto.randomUUID().replaceAll('-', '');
        let existing = await kv.get(shortCode);
        if (!providedCode) {
            for (let attempt = 0; existing && attempt < 5; attempt++) {
                shortCode = crypto.randomUUID().replaceAll('-', '');
                existing = await kv.get(shortCode);
            }
            if (existing) throw new ServiceError('Could not allocate a short code', 503);
        }
        if (existing) {
            const record = decodeShortLink(existing);
            if (!record.legacy) throw new ServiceError('Use subscription management to update this link', 409);
            if (existing === queryString) return shortCode;
            if (!allowOverwrite) throw new ServiceError('Management token required to overwrite an existing link', 401);
        }
        const ttl = this.options.shortLinkTtlSeconds;
        const putOptions = ttl ? { expirationTtl: ttl } : undefined;
        await kv.put(shortCode, queryString, putOptions);
        return shortCode;
    }

    async resolveShortCode(code) {
        const kv = this.ensureKv();
        return decodeShortLink(await kv.get(code))?.query ?? null;
    }

    async getRecord(code) {
        return decodeShortLink(await this.ensureKv().get(code));
    }
}
