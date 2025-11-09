import { SingboxConfigBuilder } from './SingboxConfigBuilder.js';
import { generateHtml } from './htmlBuilder.js';
import { ClashConfigBuilder } from './ClashConfigBuilder.js';
import { SurgeConfigBuilder } from './SurgeConfigBuilder.js';
import { encodeBase64, GenerateWebPath, tryDecodeSubscriptionLines } from './utils.js';
import { XrayConfigBuilder } from './XrayConfigBuilder.js';
import { PREDEFINED_RULE_SETS } from './config.js';
import { t } from './i18n/index.js';
import yaml from 'js-yaml';

// 处理主页请求，返回 HTML 页面
export async function handleMainPage({ url }) {
  return new Response(generateHtml('', '', '', '', url.origin), {
    headers: { 'Content-Type': 'text/html' }
  });
}

// 通用的配置处理函数
async function handleConfig(request, builderClass, format, builderOptions = {}) {
    const url = new URL(request.url);
    // 从 URL 参数获取配置信息
    const inputString = url.searchParams.get('config');
    let selectedRules = url.searchParams.get('selectedRules');
    let customRules = url.searchParams.get('customRules');
    const groupByCountry = url.searchParams.get('group_by_country') === 'true';
    let lang = url.searchParams.get('lang') || 'zh-CN';
    let userAgent = url.searchParams.get('ua') || 'curl/7.74.0';

    // 检查是否提供了配置参数
    if (!inputString) {
        return new Response(t('missingConfig'), { status: 400 });
    }

    // 处理预定义的规则集
    if (PREDEFINED_RULE_SETS[selectedRules]) {
        selectedRules = PREDEFINED_RULE_SETS[selectedRules];
    } else if (selectedRules) {
        try {
            selectedRules = JSON.parse(decodeURIComponent(selectedRules));
        } catch (error) {
            console.error('解析 selectedRules 出错:', error);
            selectedRules = PREDEFINED_RULE_SETS.minimal;
        }
    } else {
        selectedRules = PREDEFINED_RULE_SETS.minimal;
    }

    // 处理自定义规则
    if (customRules) {
        try {
            customRules = JSON.parse(decodeURIComponent(customRules));
        } catch (error) {
            console.error('解析 customRules 出错:', error);
            customRules = [];
        }
    } else {
        customRules = [];
    }

    // 从 KV 中获取自定义的基础配置
    const configId = url.searchParams.get('configId');
    let baseConfig;
    if (configId) {
        const customConfig = await SUBLINK_KV.get(configId);
        if (customConfig) {
            baseConfig = JSON.parse(customConfig);
        }
    }

    // 创建配置构建器实例
    const configBuilder = new builderClass(inputString, selectedRules, customRules, baseConfig, lang, userAgent, groupByCountry, builderOptions);
    // 特殊处理 Surge 配置
    if (builderClass === SurgeConfigBuilder) {
        configBuilder.setSubscriptionUrl(url.href);
    }
    
    // 构建配置
    const config = await configBuilder.build();

    // 设置响应头
    const headers = {
        'content-type': format === 'json' ? 'application/json; charset=utf-8' : (format === 'yaml' ? 'text/yaml; charset=utf-8' : 'text/plain; charset=utf-8')
    };

    // 为 Surge 添加特定的响应头
    if (builderClass === SurgeConfigBuilder) {
        headers['subscription-userinfo'] = 'upload=0; download=0; total=10737418240; expire=2546249531';
    }

    // 返回生成的配置
    return new Response(
        format === 'json' ? JSON.stringify(config, null, 2) : config,
        { headers }
    );
}

// 处理 Sing-box 配置请求
export async function handleSingbox({ request }) {
    return handleConfig(request, SingboxConfigBuilder, 'json');
}

// 处理 Clash 配置请求
export async function handleClash({ request }) {
    return handleConfig(request, ClashConfigBuilder, 'yaml');
}

// 处理 Surge 配置请求
export async function handleSurge({ request }) {
    return handleConfig(request, SurgeConfigBuilder, 'text');
}

// 处理 Xray 配置请求
export async function handleXrayConfig({ request }) {
    const url = new URL(request.url);
    const useBalancer = url.searchParams.get('use_balancer') === 'true';
    return handleConfig(request, XrayConfigBuilder, 'json', { useBalancer });
}

// 处理 Xray 订阅请求
export async function handleXraySubscription({ request }) {
    const url = new URL(request.url);
    const inputString = url.searchParams.get('config');
    if (!inputString) {
        return new Response('缺少 config 参数', { status: 400 });
    }

    const proxylist = inputString.split('\n');
    const finalProxyList = [];
    let userAgent = url.searchParams.get('ua') || 'curl/7.74.0';
    const headers = new Headers({ 'User-Agent': userAgent });

    // 遍历处理每个代理链接或订阅链接
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
                console.warn('获取代理失败:', e);
            }
        } else {
            let processed = tryDecodeSubscriptionLines(trimmedProxy);
            if (!Array.isArray(processed)) processed = [processed];
            finalProxyList.push(...processed.filter(item => typeof item === 'string' && item.trim() !== ''));
        }
    }

    const finalString = finalProxyList.join('\n');
    if (!finalString) {
        return new Response('缺少 config 参数', { status: 400 });
    }

    // 返回 Base64 编码后的订阅内容
    return new Response(encodeBase64(finalString), {
        headers: { 'content-type': 'application/json; charset=utf-8' }
    });
}

// 处理短链接生成请求 (v1)
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

// 处理短链接生成请求 (v2)
export async function handleShortenV2({ url }) {
    const originalUrl = url.searchParams.get('url');
    let shortCode = url.searchParams.get('shortCode');
    if (!originalUrl) {
        return new Response('缺少 URL 参数', { status: 400 });
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

// 处理短链接重定向
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

// 处理网站图标请求
export function handleFavicon() {
    return Response.redirect('https://cravatar.cn/avatar/9240d78bbea4cf05fb04f2b86f22b18d?s=160&d=retro&r=g', 301);
}

// 处理保存自定义配置的请求
export async function handleSaveConfig({ request }) {
    try {
        const { type, content } = await request.json();
        const configId = `${type}_${GenerateWebPath(8)}`;
        let configString;
        // 如果是 Clash 配置且内容是 YAML 格式，先转换为 JSON
        if (type === 'clash' && typeof content === 'string' && (content.trim().startsWith('-') || content.includes(':'))) {
            const yamlConfig = yaml.load(content);
            configString = JSON.stringify(yamlConfig);
        } else {
            configString = typeof content === 'object' ? JSON.stringify(content) : content;
        }
        JSON.parse(configString); // 验证 JSON 格式是否正确
        await SUBLINK_KV.put(configId, configString, { expirationTtl: 60 * 60 * 24 * 30 }); // 存储 30 天
        return new Response(configId, { headers: { 'Content-Type': 'text/plain' } });
    } catch (error) {
        console.error('配置验证错误:', error);
        return new Response(t('invalidFormat') + error.message, { status: 400, headers: { 'Content-Type': 'text/plain' } });
    }
}

// 处理解析短链接的请求
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
