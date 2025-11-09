// 导入所需模块
import { Router } from './router.js';
import { setLanguage, t } from './i18n/index.js';
import {
  handleMainPage,
  handleSingbox,
  handleClash,
  handleSurge,
  handleXrayConfig,
  handleXraySubscription,
  handleShorten,
  handleShortenV2,
  handleRedirect,
  handleFavicon,
  handleSaveConfig,
  handleResolve,
} from './handlers.js';

// 创建一个新的路由器实例
const router = new Router();

// 定义路由规则
router
  .on('GET', '/', handleMainPage) // 主页
  .on('GET', '/singbox', handleSingbox) // Sing-box 配置
  .on('GET', '/clash', handleClash) // Clash 配置
  .on('GET', '/surge', handleSurge) // Surge 配置
  .on('GET', '/xray-config', handleXrayConfig) // Xray 配置
  .on('GET', '/sub', handleXraySubscription) // Xray 订阅
  .on('GET', '/shorten', handleShorten) // 短链接生成 (v1)
  .on('GET', '/shorten-v2', handleShortenV2) // 短链接生成 (v2)
  .on('GET', '/favicon.ico', handleFavicon) // 网站图标
  .on('GET', '/resolve', handleResolve) // 解析短链接
  .on('POST', '/config', handleSaveConfig) // 保存自定义配置
  // 重定向路由，用于短链接跳转
  .on('GET', '/:type(b|c|x|s)/:shortCode', handleRedirect);

// Cloudflare Worker 的 fetch 事件监听器
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// 处理传入的 HTTP 请求
async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    // 从 URL 参数或请求头中获取语言设置
    const lang = url.searchParams.get('lang');
    setLanguage(lang || request.headers.get('accept-language')?.split(',')[0]);
    
    // 使用路由器处理请求
    return await router.route(request);

  } catch (error) {
    console.error('处理请求时出错:', error);
    // 返回内部服务器错误响应
    return new Response(t('internalError'), { status: 500 });
  }
}
