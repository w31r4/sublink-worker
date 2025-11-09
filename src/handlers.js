import { SingboxConfigBuilder } from './SingboxConfigBuilder.js';
import { generateHtml } from './htmlBuilder.js';
import { ClashConfigBuilder } from './ClashConfigBuilder.js';
import { SurgeConfigBuilder } from './SurgeConfigBuilder.js';
import { encodeBase64, GenerateWebPath, tryDecodeSubscriptionLines } from './utils.js';
import { XrayConfigBuilder } from './XrayConfigBuilder.js';
import { PREDEFINED_RULE_SETS } from './config.js';
import { t } from './i18n/index.js';
import yaml from 'js-yaml';

export async function handleMainPage({ url }) {
  return new Response(generateHtml('', '', '', '', url.origin), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleConfig(request, builderClass, format, builderOptions = {}) {
    const url = new URL(request.url);
    const inputString = url.searchParams.get('config');
    let selectedRules = url.searchParams.get('selectedRules');
    let customRules = url.search_params.get('customRules');
    const groupByCountry = url.searchParams.get('group_by_country') === 'true';
    let lang = url.searchParams.get('lang') || 'zh-CN';
    let userAgent = url.searchParams.get('ua') || 'curl/7.74.0';

    if (!inputString) {
        return new Response(t('missingConfig'), { status: 400 });
    }

    if (PREDEFINED_RULE_SETS[selectedRules]) {
        selectedRules = PREDEFINED_RULE_SETS[selectedRules];
    } else if (selectedRules) {
        try {
            selectedRules = JSON.parse(decodeURIComponent(selectedRules));
        } catch (error) {
            console.error('Error parsing selectedRules:', error);
            selectedRules = PREDEFINED_RULE_SETS.minimal;
        }
    } else {
        selectedRules = PREDEFINED_RULE_SETS.minimal;
    }

    if (customRules) {
        try {
            customRules = JSON.parse(decodeURIComponent(customRules));
        } catch (error) {
            console.error('Error parsing customRules:', error);
            customRules = [];
        }
    } else {
        customRules = [];
    }

    const configId = url.searchParams.get('configId');
    let baseConfig;
    if (configId) {
        const customConfig = await SUBLINK_KV.get(configId);
        if (customConfig) {
            baseConfig = JSON.parse(customConfig);
        }
    }

    const configBuilder = new builderClass(inputString, selectedRules, customRules, baseConfig, lang, userAgent, groupByCountry, builderOptions);
    if (builderClass === SurgeConfigBuilder) {
        configBuilder.setSubscriptionUrl(url.href);
    }
    
    const config = await configBuilder.build();

    const headers = {
        'content-type': format === 'json' ? 'application/json; charset=utf-8' : (format === 'yaml' ? 'text/yaml; charset=utf-8' : 'text/plain; charset=utf-8')
    };

    if (builderClass === SurgeConfigBuilder) {
        headers['subscription-userinfo'] = 'upload=0; download=0; total=10737418240; expire=2546249531';
    }

    return new Response(
        format === 'json' ? JSON.stringify(config, null, 2) : config,
        { headers }
    );
}

export async function handleSingbox({ request }) {
    return handleConfig(request, SingboxConfigBuilder, 'json');
}

export async function handleClash({ request }) {
    return handleConfig(request, ClashConfigBuilder, 'yaml');
}

export async function handleSurge({ request }) {
    return handleConfig(request, SurgeConfigBuilder, 'text');
}

export async function handleXrayConfig({ request }) {
    const url = new URL(request.url);
    const useBalancer = url.searchParams.get('use_balancer') === 'true';
    return handleConfig(request, XrayConfigBuilder, 'json', { useBalancer });
}

export async function handleXraySubscription({ request }) {
    const url = new URL(request.url);
    const inputString = url.searchParams.get('config');
    if (!inputString) {
        return new Response('Missing config parameter', { status: 400 });
    }

    const proxylist = inputString.split('\n');
    const finalProxyList = [];
    let userAgent = url.searchParams.get('ua') || 'curl/7.74.0';
    const headers = new Headers({ 'User-Agent': userAgent });

    for (const proxy of proxylist) {
        const trimmedProxy = proxy.trim();
        if (!trimmedProxy) continue;

        if (trimmedProxy.startsWith('http://') || trimmedProxy.startsWith('https://')) {
            try {
                const response = await fetch(trimmedProxy, { method: 'GET', headers });
                const text = await response.text();
                let processed = tryDecodeSubscriptionLines(text, { decodeUriComponent: true });
                if (!Array.isArray(processed)) processed = [processed];
                finalProxyList.push(...processed.filter(item => typeof item === 'string' && item.trim() !== ''));
            } catch (e) {
                console.warn('Failed to fetch the proxy:', e);
            }
        } else {
            let processed = tryDecodeSubscriptionLines(trimmedProxy);
            if (!Array.isArray(processed)) processed = [processed];
            finalProxyList.push(...processed.filter(item => typeof item === 'string' && item.trim() !== ''));
        }
    }

    const finalString = finalProxyList.join('\n');
    if (!finalString) {
        return new Response('Missing config parameter', { status: 400 });
    }

    return new Response(encodeBase64(finalString), {
        headers: { 'content-type': 'application/json; charset=utf-8' }
    });
}

export async function handleShorten({ url }) {
    const originalUrl = url.searchParams.get('url');
    if (!originalUrl) {
        return new Response(t('missingUrl'), { status: 400 });
    }
    const shortCode = GenerateWebPath();
    await SUBLINK_KV.put(shortCode, originalUrl);
    const shortUrl = `${url.origin}/s/${shortCode}`;
    return new Response(JSON.stringify({ shortUrl }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function handleShortenV2({ url }) {
    const originalUrl = url.searchParams.get('url');
    let shortCode = url.searchParams.get('shortCode');
    if (!originalUrl) {
        return new Response('Missing URL parameter', { status: 400 });
    }
    const parsedUrl = new URL(originalUrl);
    const queryString = parsedUrl.search;
    if (!shortCode) {
        shortCode = GenerateWebPath();
    }
    await SUBLINK_KV.put(shortCode, queryString);
    return new Response(shortCode, {
        headers: { 'Content-Type': 'text/plain' }
    });
}

export async function handleRedirect({ url, params }) {
    const { type, shortCode } = params;
    const originalParam = await SUBLINK_KV.get(shortCode);
    if (originalParam === null) {
        return new Response(t('shortUrlNotFound'), { status: 404 });
    }
    const targetMap = { b: 'singbox', c: 'clash', x: 'sub', s: 'surge' };
    const originalUrl = `${url.origin}/${targetMap[type]}${originalParam}`;
    return Response.redirect(originalUrl, 302);
}

export function handleFavicon() {
    return Response.redirect('https://cravatar.cn/avatar/9240d78bbea4cf05fb04f2b86f22b18d?s=160&d=retro&r=g', 301);
}

export async function handleSaveConfig({ request }) {
    try {
        const { type, content } = await request.json();
        const configId = `${type}_${GenerateWebPath(8)}`;
        let configString;
        if (type === 'clash' && typeof content === 'string' && (content.trim().startsWith('-') || content.includes(':'))) {
            const yamlConfig = yaml.load(content);
            configString = JSON.stringify(yamlConfig);
        } else {
            configString = typeof content === 'object' ? JSON.stringify(content) : content;
        }
        JSON.parse(configString); // Validate JSON
        await SUBLINK_KV.put(configId, configString, { expirationTtl: 60 * 60 * 24 * 30 }); // 30 days
        return new Response(configId, { headers: { 'Content-Type': 'text/plain' } });
    } catch (error) {
        console.error('Config validation error:', error);
        return new Response(t('invalidFormat') + error.message, { status: 400, headers: { 'Content-Type': 'text/plain' } });
    }
}

export async function handleResolve({ url }) {
    const shortUrl = url.searchParams.get('url');
    if (!shortUrl) {
        return new Response(t('missingUrl'), { status: 400 });
    }
    try {
        const urlObj = new URL(shortUrl);
        const pathParts = urlObj.pathname.split('/');
        if (pathParts.length < 3) {
            return new Response(t('invalidShortUrl'), { status: 400 });
        }
        const prefix = pathParts[1];
        const shortCode = pathParts[2];
        if (!['b', 'c', 'x', 's'].includes(prefix)) {
            return new Response(t('invalidShortUrl'), { status: 400 });
        }
        const originalParam = await SUBLINK_KV.get(shortCode);
        if (originalParam === null) {
            return new Response(t('shortUrlNotFound'), { status: 404 });
        }
        const targetMap = { b: 'singbox', c: 'clash', x: 'sub', s: 'surge' };
        const originalUrl = `${url.origin}/${targetMap[prefix]}${originalParam}`;
        return new Response(JSON.stringify({ originalUrl }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(t('invalidShortUrl'), { status: 400 });
    }
}
