import { parseUrlParams, parseServerInfo, createTlsConfig, createTransportConfig, parseArray } from '../utils.js';

export class VlessParser {
  canParse(url) {
    return url.startsWith('vless://');
  }

  parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [uuid, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);

    const tls = createTlsConfig(params);
    if (tls.reality) {
      tls.utls = {
        enabled: true,
        fingerprint: 'chrome'
      };
    }
    const transport = params.type !== 'tcp' ? createTransportConfig(params) : undefined;

    return {
      type: 'vless',
      tag: name,
      server: host,
      server_port: port,
      uuid: decodeURIComponent(uuid),
      tcp_fast_open: false,
      tls,
      transport,
      network: 'tcp',
      flow: params.flow ?? undefined,
      alpn: parseArray(params.alpn)
    };
  }
}
