import { parseUrlParams, parseServerInfo, createTlsConfig, createTransportConfig } from './url.js';

export class TrojanParser {
  canParse(url) {
    return url.startsWith('trojan://');
  }

  parse(url) {
    try {
      const { addressPart, params, name } = parseUrlParams(url);
      const [password, serverInfo] = addressPart.split('@');
      const { host, port } = parseServerInfo(serverInfo);

      const parsedURL = parseServerInfo(addressPart);
      const tls = createTlsConfig(params);
      const transport = params.type !== 'tcp' ? createTransportConfig(params) : undefined;
      return {
        type: 'trojan',
        tag: name,
        server: host,
        server_port: port,
        password: decodeURIComponent(password) || parsedURL.username,
        network: "tcp",
        tcp_fast_open: false,
        tls: tls,
        transport: transport,
        flow: params.flow ?? undefined
      };
    } catch (e) {
      console.error('Failed to parse trojan URL:', e);
      return null;
    }
  }
}