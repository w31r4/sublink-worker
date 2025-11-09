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

  // Let builder fallback for other kinds
  return null;
}
