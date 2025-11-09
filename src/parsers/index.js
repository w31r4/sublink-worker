import { VmessParser } from './VmessParser.js';
import { ShadowsocksParser } from './ShadowsocksParser.js';
import { TrojanParser } from './TrojanParser.js';
import { VlessParser } from './VlessParser.js';
import { Hysteria2Parser } from './Hysteria2Parser.js';
import { TuicParser } from './TuicUrlParser.js';
import { AnytlsParser } from './AnytlsParser.js';
import { HttpParser } from './HttpParser.js';

// 解析器链
// 按顺序尝试使用以下解析器
const parsers = [
  new VmessParser(),
  new ShadowsocksParser(),
  new TrojanParser(),
  new VlessParser(),
  new Hysteria2Parser(),
  new TuicParser(),
  new AnytlsParser(),
  new HttpParser(),
];

/**
 * 通过尝试已注册的解析器链来解析给定的 URL。
 * @param {string} url 要解析的 URL 或内容。
 * @param {string} userAgent - 用于网络请求的 User-Agent。
 * @returns {Promise<object|null>} 解析后的代理对象，如果无法解析则返回 null。
 */
export async function parse(url, userAgent) {
  if (typeof url !== 'string' || !url.trim()) {
    return null;
  }

  const trimmedUrl = url.trim();

  // 遍历解析器链
  for (const parser of parsers) {
    try {
      // 检查当前解析器是否能处理该 URL
      if (parser.canParse(trimmedUrl)) {
        const res = parser.parse(trimmedUrl, userAgent);
        // 支持异步解析器（例如，需要发起 HTTP 请求的解析器）
        const value = res instanceof Promise ? await res : res;
        if (value != null) {
          return value; // 解析成功，返回结果
        }
      }
    } catch (e) {
      // 记录解析失败的警告，但继续尝试下一个解析器
      console.warn('解析器失败:', parser?.constructor?.name, e?.message || e);
    }
  }

  // 如果链中没有解析器可以处理该 URL，则返回 null。
  return null;
}
