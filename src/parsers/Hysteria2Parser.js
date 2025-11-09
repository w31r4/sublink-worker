import { parseUrlParams, parseServerInfo, createTlsConfig, parseMaybeNumber, parseArray, parseBool } from '../utils.js';

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

    const tls = createTlsConfig(params);

    const obfs = {};
    if (params['obfs-password']) {
      obfs.type = params.obfs;
      obfs.password = params['obfs-password'];
    }

    const hopInterval = parseMaybeNumber(params['hop-interval']);

    return {
      tag: name,
      type: 'hysteria2',
      server: host,
      server_port: port,
      password: password,
      tls: tls,
      obfs: Object.keys(obfs).length > 0 ? obfs : undefined,
      auth: params.auth,
      recv_window_conn: params.recv_window_conn,
      up: params.up ?? (params.upmbps ? parseMaybeNumber(params.upmbps) : undefined),
      down: params.down ?? (params.downmbps ? parseMaybeNumber(params.downmbps) : undefined),
      ports: params.ports,
      hop_interval: hopInterval,
      alpn: parseArray(params.alpn),
      fast_open: parseBool(params['fast-open'])
    };
  }
}

