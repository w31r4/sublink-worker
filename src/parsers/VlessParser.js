import { parseUrlParams, parseServerInfo, createTlsConfig, createTransportConfig } from './url.js';
import { parseArray } from '../utils.js';
import { createVlessNode } from '../ir/factory.js';

export class VlessParser {
  canParse(url) {
    return url.startsWith('vless://');
  }

  parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [uuid, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);

    const tls = createTlsConfig(params);
    const alpn = parseArray(params.alpn);
    if (alpn) {
      tls.alpn = alpn;
    }
    if (tls.reality) {
      tls.utls = {
        enabled: true,
        fingerprint: 'chrome'
      };
    }
    const transport = params.type !== 'tcp' ? createTransportConfig(params) : undefined;

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
