import { decodeBase64 } from '../utils.js';
import { parseUrlParams, parseServerInfo } from './url.js';

export class ShadowsocksParser {
  canParse(url) {
    return url.startsWith('ss://');
  }

  parse(url) {
    try {
      const { addressPart, name: tag } = parseUrlParams(url);

      // Modern format: ss://<base64-encoded-method-password>@<server>:<port>
      if (addressPart.includes('@')) {
        const [userInfo, serverInfo] = addressPart.split('@');
        const decodedUserInfo = decodeBase64(decodeURIComponent(userInfo));
        const [method, ...passwordParts] = decodedUserInfo.split(':');
        const password = passwordParts.join(':');
        const { host, port } = parseServerInfo(serverInfo);
        return this.createConfig(tag, host, port, method, password);
      }
      
      // Legacy format: ss://<base64-encoded-full-info>
      const decodedLegacy = decodeBase64(addressPart);
      const [methodAndPass, serverInfo] = decodedLegacy.split('@');
      const [method, ...passwordParts] = methodAndPass.split(':');
      const password = passwordParts.join(':');
      const { host, port } = parseServerInfo(serverInfo);
      return this.createConfig(tag, host, port, method, password);

    } catch (e) {
      console.error('Failed to parse shadowsocks URL:', e);
      return null;
    }
  }

  createConfig(tag, server, server_port, method, password) {
    return {
      tag: tag || "Shadowsocks",
      type: 'shadowsocks',
      server: server,
      server_port: parseInt(server_port),
      method: method,
      password: password,
      network: 'tcp',
      tcp_fast_open: false,
    };
  }
}