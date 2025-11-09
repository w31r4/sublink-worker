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

const router = new Router();

router
  .on('GET', '/', handleMainPage)
  .on('GET', '/singbox', handleSingbox)
  .on('GET', '/clash', handleClash)
  .on('GET', '/surge', handleSurge)
  .on('GET', '/xray-config', handleXrayConfig)
  .on('GET', '/sub', handleXraySubscription)
  .on('GET', '/shorten', handleShorten)
  .on('GET', '/shorten-v2', handleShortenV2)
  .on('GET', '/favicon.ico', handleFavicon)
  .on('GET', '/resolve', handleResolve)
  .on('POST', '/config', handleSaveConfig)
  // Redirect routes
  .on('GET', '/:type(b|c|x|s)/:shortCode', handleRedirect);


addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    const lang = url.searchParams.get('lang');
    setLanguage(lang || request.headers.get('accept-language')?.split(',')[0]);
    
    return await router.route(request);

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(t('internalError'), { status: 500 });
  }
}
