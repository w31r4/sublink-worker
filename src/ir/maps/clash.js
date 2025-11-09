// Map Core IR to Clash proxy object (scaffold)
export function mapIRToClash(ir, original) {
  if (!ir) return null;
  const name = ir.tags?.[0] || 'proxy';
  const auth = original?.auth || ir.auth || {};
  const transport = original?.transport || ir.transport;
  const tls = original?.tls || ir.tls;
  const network = original?.network || ir.network;
  const udp = typeof original?.udp !== 'undefined' ? original.udp : ir.udp;
  const base = {
    name,
    server: ir.host,
    port: ir.port,
  };

  if (ir.kind === 'anytls') {
    const out = {
      ...base,
      type: 'anytls',
      password: auth.password,
    };
    if (typeof udp !== 'undefined') out.udp = udp;
    if (tls?.utls?.fingerprint) out['client-fingerprint'] = tls.utls.fingerprint;
    if (tls?.sni) out.sni = tls.sni;
    if (typeof tls?.insecure !== 'undefined') out['skip-cert-verify'] = !!tls.insecure;
    if (tls?.alpn) out.alpn = tls.alpn;
    const p = ir.proto?.anytls || {};
    if (typeof p.idle_session_check_interval !== 'undefined') out['idle-session-check-interval'] = p.idle_session_check_interval;
    if (typeof p.idle_session_timeout !== 'undefined') out['idle-session-timeout'] = p.idle_session_timeout;
    if (typeof p.min_idle_session !== 'undefined') out['min-idle-session'] = p.min_idle_session;
    return out;
  }
  if (ir.kind === 'shadowsocks') {
    const out = {
      ...base,
      type: 'ss',
      cipher: auth.method,
      password: auth.password,
    };
    return out;
  }

  if (ir.kind === 'tuic') {
    const p = ir.proto?.tuic || {};
    const out = {
      ...base,
      type: 'tuic',
      uuid: auth.uuid,
      password: auth.password,
      'congestion-controller': p.congestion_control,
      'skip-cert-verify': tls?.insecure ? true : false,
      'sni': tls?.sni,
      'udp-relay-mode': p.udp_relay_mode || 'native',
    };
    if (Array.isArray(tls?.alpn)) out.alpn = tls.alpn;
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
      uuid: auth.uuid,
      cipher: auth.method,
      tls: tls?.enabled || !!tls,
      ...(tls?.utls?.fingerprint ? { 'client-fingerprint': tls.utls.fingerprint } : {}),
      servername: tls?.sni || '',
      network: transport?.type || network || 'tcp',
      tfo: ir.tcp_fast_open,
      'skip-cert-verify': tls?.insecure ? true : false,
      ...(typeof udp !== 'undefined' ? { udp } : {}),
      ...(Array.isArray(tls?.alpn) ? { alpn: tls.alpn } : {}),
      ...(ir.packet_encoding ? { 'packet-encoding': ir.packet_encoding } : {}),
      ...(ir.flow ? { flow: ir.flow } : {}),
    };
    if (transport?.type === 'ws') {
      out['ws-opts'] = { path: transport.path, headers: transport.headers };
    } else if (transport?.type === 'grpc') {
      out['grpc-opts'] = { 'grpc-service-name': transport.service_name };
    } else if (transport?.type === 'http') {
      const opts = {
        method: transport.method || 'GET',
        path: Array.isArray(transport.path) ? transport.path : [transport.path || '/'],
      };
      if (transport.headers && Object.keys(transport.headers).length > 0) {
        opts.headers = transport.headers;
      }
      out['http-opts'] = opts;
    } else if (transport?.type === 'h2') {
      out['h2-opts'] = { path: transport.path, host: transport.host };
    }
    if (tls?.reality) {
      out['reality-opts'] = {
        'public-key': tls.reality.publicKey || tls.reality.public_key,
        'short-id': tls.reality.shortId || tls.reality.short_id,
      };
    }
    return out;
  }

  if (ir.kind === 'hysteria2' || ir.kind === 'hy2') {
    const p = ir.proto?.hy2 || {};
    const out = {
      ...base,
      type: 'hysteria2',
      ...(p.ports ? { ports: p.ports } : {}),
      obfs: p.obfs?.type,
      'obfs-password': p.obfs?.password,
      password: auth.password,
      auth: p.auth,
      up: p.up,
      down: p.down,
      'recv-window-conn': p.recv_window_conn,
      sni: tls?.sni || '',
      'skip-cert-verify': tls?.insecure ? true : false,
      ...(typeof p.hop_interval !== 'undefined' ? { 'hop-interval': p.hop_interval } : {}),
      ...(Array.isArray(tls?.alpn) ? { alpn: tls.alpn } : {}),
      ...(typeof p.fast_open !== 'undefined' ? { 'fast-open': p.fast_open } : {}),
    };
    return out;
  }

  if (ir.kind === 'vmess') {
    const out = {
      ...base,
      type: 'vmess',
      uuid: auth.uuid,
      alterId: ir.alterId,
      cipher: auth.method,
      tls: tls?.enabled || !!tls,
      servername: tls?.sni || '',
      'skip-cert-verify': tls?.insecure ? true : false,
      network: transport?.type || network || 'tcp',
    };
    if (transport?.type === 'ws') {
      out['ws-opts'] = { path: transport.path, headers: transport.headers };
    } else if (transport?.type === 'grpc') {
      out['grpc-opts'] = { 'grpc-service-name': transport.service_name };
    } else if (transport?.type === 'http') {
      const opts = {
        method: transport.method || 'GET',
        path: Array.isArray(transport.path) ? transport.path : [transport.path || '/'],
      };
      if (transport.headers && Object.keys(transport.headers).length > 0) {
        opts.headers = transport.headers;
      }
      out['http-opts'] = opts;
    } else if (transport?.type === 'h2') {
      out['h2-opts'] = { path: transport.path, host: transport.host };
    }
    return out;
  }

  if (ir.kind === 'trojan') {
    const out = {
      ...base,
      type: 'trojan',
      password: auth.password,
      cipher: auth.method,
      tls: tls?.enabled || !!tls,
      ...(tls?.utls?.fingerprint ? { 'client-fingerprint': tls.utls.fingerprint } : {}),
      sni: tls?.sni || '',
      network: transport?.type || network || 'tcp',
      tfo: ir.tcp_fast_open,
      'skip-cert-verify': tls?.insecure ? true : false,
      ...(Array.isArray(tls?.alpn) ? { alpn: tls.alpn } : {}),
      ...(ir.flow ? { flow: ir.flow } : {}),
    };
    if (transport?.type === 'ws') {
      out['ws-opts'] = { path: transport.path, headers: transport.headers };
    } else if (transport?.type === 'grpc') {
      out['grpc-opts'] = { 'grpc-service-name': transport.service_name };
    }
    if (tls?.reality) {
      out['reality-opts'] = {
        'public-key': tls.reality.publicKey || tls.reality.public_key,
        'short-id': tls.reality.shortId || tls.reality.short_id,
      };
    }
    return out;
  }

  // Not implemented here → let builder fallback handle
  return null;
}
