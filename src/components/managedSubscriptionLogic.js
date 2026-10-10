export const managedSubscriptionLogic = () => ({
    managedCode: '',
    loadedManagedCode: '',
    managedRevision: '',
    managedToken: '',
    managedOverrides: '{}',
    managedInterval: 1,
    managedBusy: false,
    managedMessage: '',
    managedError: false,
    managedLinks: null,

    managementHeaders() {
        if (!this.managedToken.trim()) throw new Error(window.APP_TRANSLATIONS.managementTokenRequired);
        return { Authorization: `Bearer ${this.managedToken.trim()}`, 'Content-Type': 'application/json' };
    },

    managementCode() {
        const value = this.managedCode.trim();
        if (!value.includes('://')) return value;
        const url = new URL(value);
        if (url.origin !== window.location.origin) throw new Error(window.APP_TRANSLATIONS.managementSameOrigin);
        const match = url.pathname.match(/^\/[bcxs]\/([a-zA-Z0-9_-]{1,64})$/);
        if (!match) throw new Error(window.APP_TRANSLATIONS.invalidShortUrl);
        return match[1];
    },

    setManagedRecord(record) {
        this.managedCode = record.code;
        this.loadedManagedCode = record.code;
        this.managedRevision = record.revision;
        this.managedInterval = record.updateIntervalHours;
        this.managedLinks = Object.fromEntries(Object.entries({ clash: 'c', singbox: 'b', surge: 's', xray: 'x' })
            .map(([type, prefix]) => [type, `${window.location.origin}/${prefix}/${record.code}`]));
    },

    async loadManagedSubscription() {
        this.managedBusy = true;
        this.managedMessage = '';
        this.managedError = false;
        try {
            const code = this.managementCode();
            if (!code) throw new Error(window.APP_TRANSLATIONS.managementCodeRequired);
            const response = await fetch(`/api/subscriptions/${encodeURIComponent(code)}`, { headers: this.managementHeaders() });
            if (!response.ok) throw new Error(await response.text());
            const record = await response.json();
            this.populateFormFromUrl(new URL(`/clash${record.query}`, window.location.origin));
            this.configEditor = record.baseConfig ? JSON.stringify(record.baseConfig.content, null, 2) : '';
            this.configType = record.baseConfig?.type || 'clash';
            this.currentConfigId = '';
            this.updateConfigIdInUrl(null);
            this.managedOverrides = JSON.stringify(record.clashOverrides || {}, null, 2);
            this.setManagedRecord(record);
            this.managedMessage = window.APP_TRANSLATIONS[record.legacy ? 'managementLegacyLoaded' : 'managementLoaded'];
        } catch (error) {
            this.managedError = true;
            this.managedMessage = error.message;
        } finally {
            this.managedBusy = false;
        }
    },

    async saveManagedSubscription() {
        this.managedBusy = true;
        this.managedMessage = '';
        this.managedError = false;
        try {
            const headers = this.managementHeaders();
            const code = this.managementCode();
            if (code && (code !== this.loadedManagedCode || !this.managedRevision)) {
                throw new Error(window.APP_TRANSLATIONS.managementLoadFirst);
            }
            if (!this.input.trim()) throw new Error(window.APP_TRANSLATIONS.missingInput);
            if (code) headers['If-Match'] = `"${this.managedRevision}"`;
            const query = this.buildSubscriptionParams();
            const baseConfig = this.configEditor.trim() ? {
                type: this.configType, content: this.serializeBaseConfigForSubscription()
            } : (query.has('configId') ? undefined : null);
            const response = await fetch(code ? `/api/subscriptions/${encodeURIComponent(code)}` : '/api/subscriptions', {
                method: code ? 'PUT' : 'POST', headers,
                body: JSON.stringify({ query: `?${query}`, baseConfig,
                    clashOverrides: this.managedOverrides.trim() || '{}',
                    updateIntervalHours: Number(this.managedInterval) })
            });
            if (!response.ok) throw new Error(await response.text());
            this.setManagedRecord(await response.json());
            this.managedMessage = window.APP_TRANSLATIONS.managementSaved;
        } catch (error) {
            this.managedError = true;
            this.managedMessage = error.message;
        } finally {
            this.managedBusy = false;
        }
    },

    newManagedSubscription() {
        this.managedCode = '';
        this.loadedManagedCode = '';
        this.managedRevision = '';
        this.managedLinks = null;
        this.managedMessage = '';
    },

    fillSplitDnsTemplate() {
        const domestic = ['https://dns.alidns.com/dns-query'];
        const foreign = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/dns-query']
            .map(url => `${url}#${window.APP_TRANSLATIONS.nodeSelectName}`);
        const aiDomains = ['openai.com', 'chatgpt.com', 'oaistatic.com', 'oaiusercontent.com',
            'anthropic.com', 'claude.ai', 'claude.com', 'googleapis.com', 'gemini.google.com',
            'aistudio.google.com', 'huggingface.co', 'hf.co'];
        this.managedOverrides = JSON.stringify({ dns: {
            enable: true, 'respect-rules': false,
            'default-nameserver': ['223.5.5.5', '223.6.6.6'],
            'proxy-server-nameserver': domestic, nameserver: foreign,
            'nameserver-policy': {
                ...Object.fromEntries(aiDomains.map(domain => [`+.${domain}`, foreign])),
                'geosite:cn,private': domestic, 'geosite:geolocation-!cn': foreign
            }
        } }, null, 2);
    }
});
