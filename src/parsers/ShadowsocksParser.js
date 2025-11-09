import { decodeBase64 } from '../utils.js';
import { parseUrlParams, parseServerInfo } from './url.js';
import { createShadowsocksNode } from '../ir/factory.js';

// Shadowsocks (SS) 协议的 URL 解析器
export class ShadowsocksParser {
  // 判断是否能解析该 URL
  canParse(url) {
    return url.startsWith('ss://');
  }

  // 解析 URL
  parse(url) {
    try {
      const { addressPart, name: tag } = parseUrlParams(url);

      // 现代格式: ss://<base64-encoded-method-password>@<server>:<port>
      if (addressPart.includes('@')) {
        const [userInfo, serverInfo] = addressPart.split('@');
        const decodedUserInfo = decodeBase64(decodeURIComponent(userInfo));
        const [method, ...passwordParts] = decodedUserInfo.split(':');
        const password = passwordParts.join(':');
        const { host, port } = parseServerInfo(serverInfo);
        return createShadowsocksNode({
          host,
          port,
          method,
          password,
          tags: tag ? [tag] : [],
        });
      }
      
      // 传统格式: ss://<base64-encoded-full-info>
      const decodedLegacy = decodeBase64(addressPart);
      const [methodAndPass, serverInfo] = decodedLegacy.split('@');
      const [method, ...passwordParts] = methodAndPass.split(':');
      const password = passwordParts.join(':');
      const { host, port } = parseServerInfo(serverInfo);
      return createShadowsocksNode({
        host,
        port,
        method,
        password,
        tags: tag ? [tag] : [],
      });

    } catch (e) {
      console.error('解析 Shadowsocks URL 失败:', e);
      return null;
    }
  }
}