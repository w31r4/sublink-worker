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

  // Not implemented here → let builder fallback handle
  return null;
}
