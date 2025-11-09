// Map Core IR to sing-box outbound object (scaffold)
export function mapIRToSingbox(ir, original) {
  if (!ir) return null;
  const auth = ir.auth || original?.auth || {};
  const transport = ir.transport || original?.transport;
  const tls = ir.tls || original?.tls;
  const network = ir.network || original?.network || 'tcp';
  const base = {
    type: ir.kind,
    tag: ir.tags?.[0] || ir.tag || 'proxy',
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
      password: auth.password,
      tls: tls && typeof tls === 'object' ? { ...tls } : { enabled: true },
    };
    if (typeof p.idle_session_check_interval !== 'undefined') out.idle_session_check_interval = toDuration(p.idle_session_check_interval);
    if (typeof p.idle_session_timeout !== 'undefined') out.idle_session_timeout = toDuration(p.idle_session_timeout);
    if (typeof p.min_idle_session !== 'undefined') out.min_idle_session = Number(p.min_idle_session);
    return out;
  }
  if (ir.kind === 'shadowsocks') {
    const out = {
      ...base,
      type: 'shadowsocks',
      method: auth.method,
      password: auth.password,
    };
    return out;
  }

  if (ir.kind === 'vless') {
    const out = {
      ...base,
      uuid: auth.uuid,
      tls: tls ? { ...tls } : undefined,
      transport,
      network,
      flow: ir.flow,
    };
    return out;
  }

  if (ir.kind === 'hysteria2' || ir.kind === 'hy2') {
    const p = ir.proto?.hy2 || {};
    const out = {
      ...base,
      type: 'hysteria2',
      password: auth.password,
      tls: tls ? { ...tls } : undefined,
      obfs: p.obfs,
      auth: p.auth,
      recv_window_conn: p.recv_window_conn,
      up: p.up,
      down: p.down,
      ports: p.ports,
      hop_interval: typeof p.hop_interval !== 'undefined' ? p.hop_interval : undefined,
      alpn: tls?.alpn,
      fast_open: typeof p.fast_open !== 'undefined' ? p.fast_open : undefined,
    };
    return out;
  }

  if (ir.kind === 'vmess') {
    const out = {
      ...base,
      type: 'vmess',
      uuid: auth.uuid,
      security: auth.method,
      tls: tls ? { ...tls } : undefined,
      transport,
      network,
    };
    return out;
  }

  if (ir.kind === 'trojan') {
    const out = {
      ...base,
      type: 'trojan',
      password: auth.password,
      tls: tls ? { ...tls } : undefined,
      transport,
      network,
      flow: ir.flow,
    };
    return out;
  }

  // Let builder fallback for other kinds
  return null;
}
