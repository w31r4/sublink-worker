import { parseUrlParams, parseServerInfo, createTlsConfig } from './url.js';
import { parseMaybeNumber, parseArray, parseBool } from '../utils.js';
import { createHysteria2Node } from '../ir/factory.js';

export class Hysteria2Parser {
  canParse(url) {
    return url.startsWith('hysteria://') || url.startsWith('hysteria2://') || url.startsWith('hy2://');
  }

  parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    // 支持不包含 @ 的 URL
    let host, port;
    let password = null;

    if (addressPart.includes('@')) {
      const [pwd, serverInfo] = addressPart.split('@');
      const parsed = parseServerInfo(serverInfo);
      host = parsed.host;
      port = parsed.port;
      password = decodeURIComponent(pwd);
    } else {
      const parsed = parseServerInfo(addressPart);
      host = parsed.host;
      port = parsed.port;
      password = params.auth;
    }

    const obfs = {};
    if (params['obfs-password']) {
      obfs.type = params.obfs;
      obfs.password = params['obfs-password'];
    }

    const hopInterval = parseMaybeNumber(params['hop-interval']);
    const recvWindowConn = parseMaybeNumber(params['recv-window-conn'] ?? params.recv_window_conn);
    const ports = params.ports ? String(params.ports) : undefined;
    const alpn = parseArray(params.alpn);
    const fastOpen = parseBool(params['fast-open']);
    const tls = createTlsConfig(params);
    if (alpn) {
      tls.alpn = alpn;
    }

    return createHysteria2Node({
      host,
      port,
      password,
      tls,
      obfs: Object.keys(obfs).length > 0 ? obfs : undefined,
      auth: params.auth,
      up: params.up ?? (params.upmbps ? parseMaybeNumber(params.upmbps) : undefined),
      down: params.down ?? (params.downmbps ? parseMaybeNumber(params.downmbps) : undefined),
      recv_window_conn: recvWindowConn,
      ports,
      hop_interval: hopInterval,
      fast_open: fastOpen,
      alpn,
      tags: name ? [name] : [],
    });
  }
}
