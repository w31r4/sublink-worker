import { parseUrlParams, parseServerInfo, createTlsConfig, createTransportConfig } from './url.js';
import { createTrojanNode } from '../ir/factory.js';

// Trojan 协议的 URL 解析器
export class TrojanParser {
  // 判断是否能解析该 URL
  canParse(url) {
    return url.startsWith('trojan://');
  }

  // 解析 URL
  parse(url) {
    try {
      const { addressPart, params, name } = parseUrlParams(url);
      const [password, serverInfo] = addressPart.split('@');
      const { host, port } = parseServerInfo(serverInfo);

      // 创建 TLS 和传输配置
      const tls = createTlsConfig(params);
      const transport = params.type !== 'tcp' ? createTransportConfig(params) : undefined;
      
      // 创建并返回 Trojan 节点对象
      return createTrojanNode({
        host,
        port,
        password: decodeURIComponent(password),
        tls,
        transport,
        network: transport?.type || 'tcp',
        flow: params.flow ?? undefined,
        tags: name ? [name] : [],
      });
    } catch (e) {
      console.error('解析 Trojan URL 失败:', e);
      return null;
    }
  }
}