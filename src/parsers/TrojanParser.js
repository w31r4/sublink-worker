import { parseUrlParams, parseServerInfo, createTlsConfig, createTransportConfig } from './url.js';
import { createTrojanNode } from '../ir/factory.js';

export class TrojanParser {
  canParse(url) {
    return url.startsWith('trojan://');
  }

  parse(url) {
    try {
      const { addressPart, params, name } = parseUrlParams(url);
      const [password, serverInfo] = addressPart.split('@');
      const { host, port } = parseServerInfo(serverInfo);

      const tls = createTlsConfig(params);
      const transport = params.type !== 'tcp' ? createTransportConfig(params) : undefined;
      
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
      console.error('Failed to parse trojan URL:', e);
      return null;
    }
  }
}