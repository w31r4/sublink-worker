import { parseUrlParams, parseServerInfo } from './url.js';
import { parseArray, parseBool } from '../utils.js';
import { createTuicNode } from '../ir/factory.js';

export class TuicParser {
  canParse(url) {
    return url.startsWith('tuic://');
  }

  parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [userinfo, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);
    const [uuid, password] = decodeURIComponent(userinfo).split(':');

    const tls = {
      sni: params.sni,
      alpn: parseArray(params.alpn),
      insecure: parseBool(params['skip-cert-verify'] ?? params.insecure ?? params.allowInsecure, true)
    };

    return createTuicNode({
      host,
      port,
      uuid,
      password,
      congestion_control: params.congestion_control,
      tls,
      udp_relay_mode: params['udp-relay-mode'] || params.udp_relay_mode,
      zero_rtt: parseBool(params['zero-rtt'], undefined),
      reduce_rtt: parseBool(params['reduce-rtt'], undefined),
      fast_open: parseBool(params['fast-open'], undefined),
      disable_sni: parseBool(params['disable-sni'], undefined),
      tags: name ? [name] : [],
    });
  }
}

