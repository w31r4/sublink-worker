// Map Core IR to Clash proxy object (scaffold)
export function mapIRToClash(ir, original) {
  if (!ir) return null;
  const name = ir.tags?.[0] || 'proxy';
  const base = {
    name,
    server: ir.host,
    port: ir.port,
  };

  if (ir.kind === 'anytls') {
    const out = {
      ...base,
      type: 'anytls',
      password: original?.password || ir.auth?.password,
    };
    if (typeof original?.udp !== 'undefined') out.udp = original.udp;
    if (ir.tls?.utls?.fingerprint) out['client-fingerprint'] = ir.tls.utls.fingerprint;
    if (ir.tls?.sni) out.sni = ir.tls.sni;
    if (typeof original?.tls?.insecure !== 'undefined') out['skip-cert-verify'] = !!original.tls.insecure;
    if (ir.tls?.alpn) out.alpn = ir.tls.alpn;
    const p = ir.proto?.anytls || {};
    if (typeof p.idle_session_check_interval !== 'undefined') out['idle-session-check-interval'] = p.idle_session_check_interval;
    if (typeof p.idle_session_timeout !== 'undefined') out['idle-session-timeout'] = p.idle_session_timeout;
    if (typeof p.min_idle_session !== 'undefined') out['min-idle-session'] = p.min_idle_session;
    return out;
  }

  if (ir.kind === 'tuic') {
    const p = ir.proto?.tuic || {};
    const out = {
      ...base,
      type: 'tuic',
      uuid: original?.uuid || ir.auth?.uuid,
      password: original?.password || ir.auth?.password,
      'congestion-controller': p.congestion_control,
      'skip-cert-verify': original?.tls?.insecure ? true : false,
      'sni': ir.tls?.sni,
      'udp-relay-mode': original?.udp_relay_mode || p.udp_relay_mode || 'native',
    };
    if (Array.isArray(ir.tls?.alpn)) out.alpn = ir.tls.alpn;
    if (typeof p.zero_rtt !== 'undefined') out['zero-rtt'] = p.zero_rtt;
    if (typeof p.reduce_rtt !== 'undefined') out['reduce-rtt'] = p.reduce_rtt;
    if (typeof p.fast_open !== 'undefined') out['fast-open'] = p.fast_open;
    if (typeof p.disable_sni !== 'undefined') out['disable-sni'] = p.disable_sni;
    return out;
  }

  if (ir.kind === 'vless') {
    const out = {
      ...base,
      type: 'vless',
      uuid: original?.uuid || ir.auth?.uuid,
      cipher: original?.security,
      tls: original?.tls?.enabled || !!ir.tls,
      'client-fingerprint': ir.tls?.utls?.fingerprint,
      servername: ir.tls?.sni || original?.tls?.server_name || '',
      network: original?.transport?.type || original?.network || 'tcp',
      tfo: original?.tcp_fast_open,
      'skip-cert-verify': original?.tls?.insecure ? true : false,
      ...(typeof original?.udp !== 'undefined' ? { udp: original.udp } : {}),
      ...(Array.isArray(ir.tls?.alpn) ? { alpn: ir.tls.alpn } : {}),
      ...(original?.packet_encoding ? { 'packet-encoding': original.packet_encoding } : {}),
      ...(original?.flow ? { flow: original.flow } : {}),
    };
    if (original?.transport?.type === 'ws') {
      out['ws-opts'] = { path: original.transport.path, headers: original.transport.headers };
    } else if (original?.transport?.type === 'grpc') {
      out['grpc-opts'] = { 'grpc-service-name': original.transport.service_name };
    } else if (original?.transport?.type === 'http') {
      const opts = {
        method: original.transport.method || 'GET',
        path: Array.isArray(original.transport.path) ? original.transport.path : [original.transport.path || '/'],
      };
      if (original.transport.headers && Object.keys(original.transport.headers).length > 0) {
        opts.headers = original.transport.headers;
      }
      out['http-opts'] = opts;
    } else if (original?.transport?.type === 'h2') {
      out['h2-opts'] = { path: original.transport.path, host: original.transport.host };
    }
    if (original?.tls?.reality?.enabled) {
      out['reality-opts'] = {
        'public-key': original.tls.reality.public_key,
        'short-id': original.tls.reality.short_id,
      };
    }
    return out;
  }

  if (ir.kind === 'hysteria2' || ir.kind === 'hy2') {
    const p = ir.proto?.hy2 || {};
    const out = {
      ...base,
      type: 'hysteria2',
      ...(original?.ports ? { ports: original.ports } : {}),
      obfs: original?.obfs?.type || p.obfs?.type,
      'obfs-password': original?.obfs?.password || p.obfs?.password,
      password: original?.password || ir.auth?.password,
      auth: original?.auth || p.auth,
      up: original?.up || p.up,
      down: original?.down || p.down,
      'recv-window-conn': original?.recv_window_conn || p.recv_window_conn,
      sni: ir.tls?.sni || original?.tls?.server_name || '',
      'skip-cert-verify': original?.tls?.insecure ? true : false,
      ...(typeof p.hop_interval !== 'undefined' ? { 'hop-interval': p.hop_interval } : {}),
      ...(Array.isArray(ir.tls?.alpn) ? { alpn: ir.tls.alpn } : {}),
      ...(typeof p.fast_open !== 'undefined' ? { 'fast-open': p.fast_open } : {}),
    };
    return out;
  }

  if (ir.kind === 'vmess') {
    const out = {
      ...base,
      type: 'vmess',
      uuid: original?.uuid || ir.auth?.uuid,
      alterId: original?.alter_id,
      cipher: original?.security,
      tls: original?.tls?.enabled || !!ir.tls,
      servername: ir.tls?.sni || original?.tls?.server_name || '',
      'skip-cert-verify': original?.tls?.insecure ? true : false,
      network: original?.transport?.type || original?.network || 'tcp',
    };
    if (original?.transport?.type === 'ws') {
      out['ws-opts'] = { path: original.transport.path, headers: original.transport.headers };
    } else if (original?.transport?.type === 'grpc') {
      out['grpc-opts'] = { 'grpc-service-name': original.transport.service_name };
    } else if (original?.transport?.type === 'http') {
      const opts = {
        method: original.transport.method || 'GET',
        path: Array.isArray(original.transport.path) ? original.transport.path : [original.transport.path || '/'],
      };
      if (original.transport.headers && Object.keys(original.transport.headers).length > 0) {
        opts.headers = original.transport.headers;
      }
      out['http-opts'] = opts;
    } else if (original?.transport?.type === 'h2') {
      out['h2-opts'] = { path: original.transport.path, host: original.transport.host };
    }
    return out;
  }

  if (ir.kind === 'trojan') {
    const out = {
      ...base,
      type: 'trojan',
      password: original?.password || ir.auth?.password,
      cipher: original?.security,
      tls: original?.tls?.enabled || !!ir.tls,
      'client-fingerprint': ir.tls?.utls?.fingerprint,
      sni: ir.tls?.sni || original?.tls?.server_name || '',
      network: original?.transport?.type || original?.network || 'tcp',
      tfo: original?.tcp_fast_open,
      'skip-cert-verify': original?.tls?.insecure ? true : false,
      ...(Array.isArray(ir.tls?.alpn) ? { alpn: ir.tls.alpn } : {}),
      ...(original?.flow ? { flow: original.flow } : {}),
    };
    if (original?.transport?.type === 'ws') {
      out['ws-opts'] = { path: original.transport.path, headers: original.transport.headers };
    } else if (original?.transport?.type === 'grpc') {
      out['grpc-opts'] = { 'grpc-service-name': original.transport.service_name };
    }
    if (original?.tls?.reality?.enabled) {
      out['reality-opts'] = {
        'public-key': original.tls.reality.public_key,
        'short-id': original.tls.reality.short_id,
      };
    }
    return out;
  }

  // Not implemented here → let builder fallback handle
  return null;
}
