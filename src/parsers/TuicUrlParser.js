import { parseUrlParams, parseServerInfo } from './url.js';
import { parseArray, parseBool } from '../utils.js';
import { createTuicNode } from '../ir/factory.js';

// TUIC 协议的 URL 解析器
export class TuicParser {
  // 判断是否能解析该 URL
  canParse(url) {
    return url.startsWith('tuic://');
  }

  // 解析 URL
  parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [userinfo, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);
    const [uuid, password] = decodeURIComponent(userinfo).split(':');

    // 创建 TLS 配置
    const tls = {
      enabled: true,
      sni: params.sni,
      server_name: params.sni,
      alpn: parseArray(params.alpn),
      insecure: parseBool(params['skip-cert-verify'] ?? params.insecure ?? params.allowInsecure, true)
    };

    // 创建并返回 TUIC 节点对象
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
