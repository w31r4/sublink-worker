import { parseUrlParams, parseServerInfo } from './url.js';
import { parseBool, parseMaybeNumber, parseArray } from '../utils.js';
import { createAnytlsNode } from '../ir/factory.js';

export class AnytlsParser {
  canParse(url) {
    return url.startsWith('anytls://');
  }

  parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    let password;
    let host;
    let port;

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
      password = params.password || params.auth;
    }

    const tlsInsecure = parseBool(
      params['skip-cert-verify'] ?? params.insecure ?? params.allowInsecure ?? params.allow_insecure
    );
    const tls = {
      enabled: true,
      server_name: params.sni || params.host,
      sni: params.sni || params.host,
      ...(tlsInsecure !== undefined ? { insecure: tlsInsecure } : {})
    };
    const alpn = parseArray(params.alpn);
    if (alpn) {
      tls.alpn = alpn;
    }
    if (params['client-fingerprint'] || params.client_fingerprint) {
      tls.utls = {
        enabled: true,
        fingerprint: params['client-fingerprint'] || params.client_fingerprint
      };
    }

    return createAnytlsNode({
      host,
      port,
      password,
      tls,
      udp: parseBool(params.udp),
      idle_session_check_interval: parseMaybeNumber(
        params['idle-session-check-interval'] || params.idleSessionCheckInterval || params.idle_session_check_interval
      ),
      idle_session_timeout: parseMaybeNumber(
        params['idle-session-timeout'] || params.idleSessionTimeout || params.idle_session_timeout
      ),
      min_idle_session: parseMaybeNumber(
        params['min-idle-session'] || params.minIdleSession || params.min_idle_session
      ),
      tags: name ? [name] : [],
    });
  }
}
