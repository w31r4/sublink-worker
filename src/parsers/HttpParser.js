import yaml from 'js-yaml';
import { decodeBase64, DeepCopy } from '../utils.js';
import { convertYamlProxyToObject } from './yamlHelper.js';

// 用于解析 HTTP/HTTPS 订阅链接的解析器
export class HttpParser {
  // 判断是否能解析该 URL
  canParse(url) {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  // 解析 URL 内容
  async parse(url, userAgent) {
    try {
      // 设置请求头
      let headers = new Headers({ 'User-Agent': userAgent || 'curl/7.74.0' });
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`HTTP 错误! 状态: ${response.status}`);
      }
      const text = await response.text();
      let decodedText;

      // 尝试 Base64 解码
      try {
        decodedText = decodeBase64(text.trim());
        if (decodedText.includes('%')) {
          decodedText = decodeURIComponent(decodedText);
        }
      } catch (e) {
        // 如果解码失败，则假定为纯文本
        decodedText = text;
        if (decodedText.includes('%')) {
          try {
            decodedText = decodeURIComponent(decodedText);
          } catch (_) {}
        }
      }

      // 优先尝试将内容作为 YAML 解析
      try {
        const parsed = yaml.load(decodedText);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.proxies)) {
          const proxies = parsed.proxies
            .map(p => convertYamlProxyToObject(p))
            .filter(p => p != null);
          if (proxies.length > 0) {
            const configOverrides = DeepCopy(parsed);
            delete configOverrides.proxies;
            return {
              type: 'yamlConfig',
              proxies,
              config: Object.keys(configOverrides).length > 0 ? configOverrides : null
            };
          }
        }
      } catch (_) {
        // 不是 YAML 格式，忽略错误
      }

      // 如果 YAML 解析失败，则回退到按行分割
      return decodedText.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
      console.error('获取或解析 HTTP(S) 内容时出错:', error);
      return null;
    }
  }
}

