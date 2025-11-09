// Map Core IR to sing-box outbound object (scaffold)
export function mapIRToSingbox(ir, original) {
  if (!ir) return null;
  const base = {
    type: ir.kind,
    tag: ir.tags?.[0] || 'proxy',
    server: ir.host,
    server_port: ir.port,
  };

  if (ir.kind === 'anytls') {
    const toDuration = (v) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === 'number') return `${v}s`;
      const s = String(v).trim();
      return /[a-zA-Z]$/.test(s) ? s : `${s}s`;
    };
    const p = ir.proto?.anytls || {};
    const out = {
      ...base,
      password: original?.password || ir.auth?.password,
      tls: original?.tls && typeof original.tls === 'object' ? { ...original.tls } : { enabled: true },
    };
    if (typeof p.idle_session_check_interval !== 'undefined') out.idle_session_check_interval = toDuration(p.idle_session_check_interval);
    if (typeof p.idle_session_timeout !== 'undefined') out.idle_session_timeout = toDuration(p.idle_session_timeout);
    if (typeof p.min_idle_session !== 'undefined') out.min_idle_session = Number(p.min_idle_session);
    return out;
  }

  if (ir.kind === 'vless') {
    const out = {
      ...base,
      uuid: original?.uuid || ir.auth?.uuid,
      tls: original?.tls || (ir.tls ? { enabled: true, server_name: ir.tls.sni, alpn: ir.tls.alpn } : undefined),
      transport: original?.transport,
      network: original?.network || 'tcp',
      flow: original?.flow,
    };
    return out;
  }

  if (ir.kind === 'hysteria2' || ir.kind === 'hy2') {
    const p = ir.proto?.hy2 || {};
    const out = {
      ...base,
      type: 'hysteria2',
      password: original?.password || ir.auth?.password,
      tls: original?.tls || (ir.tls ? { enabled: true, server_name: ir.tls.sni, alpn: ir.tls.alpn } : undefined),
      obfs: original?.obfs,
      auth: original?.auth || p.auth,
      recv_window_conn: original?.recv_window_conn || p.recv_window_conn,
      up: original?.up || p.up,
      down: original?.down || p.down,
      ports: original?.ports || p.ports,
      hop_interval: typeof p.hop_interval !== 'undefined' ? p.hop_interval : original?.hop_interval,
      alpn: ir.tls?.alpn,
      fast_open: typeof p.fast_open !== 'undefined' ? p.fast_open : original?.fast_open,
    };
    return out;
  }

  // Let builder fallback for other kinds
  return null;
}
