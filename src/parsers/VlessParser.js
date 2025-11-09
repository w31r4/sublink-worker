import { parseUrlParams, parseServerInfo, createTlsConfig, createTransportConfig } from './url.js';
import { parseArray } from '../utils.js';
import { createVlessNode } from '../ir/factory.js';

// VLESS 协议的 URL 解析器
export class VlessParser {
  // 判断是否能解析该 URL
  canParse(url) {
    return url.startsWith('vless://');
  }

  // 解析 URL
  parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [uuid, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);

    // 创建 TLS 配置
    const tls = createTlsConfig(params);
    const alpn = parseArray(params.alpn);
    if (alpn) {
      tls.alpn = alpn;
    }
    // 如果是 REALITY，则启用 uTLS
    if (tls.reality) {
      tls.utls = {
        enabled: true,
        fingerprint: 'chrome'
      };
    }
    // 创建传输配置
    const transport = params.type !== 'tcp' ? createTransportConfig(params) : undefined;

    // 创建并返回 VLESS 节点对象
    return createVlessNode({
      host,
      port,
      uuid: decodeURIComponent(uuid),
      tls,
      transport,
      network: transport?.type || 'tcp',
      flow: params.flow ?? undefined,
      tags: name ? [name] : [],
    });
  }
}
