// Convert legacy proxy objects to Core IR

export function toIR(proxy) {
  if (!proxy || typeof proxy !== 'object') return null;
  const kind = proxy.type;
  const ir = {
    kind,
    host: proxy.server,
    port: proxy.server_port,
    tags: proxy.tag ? [proxy.tag] : [],
    auth: {},
    tls: undefined,
    ext: {},
    version: '1.0.0',
  };

  if (proxy.uuid) ir.auth.uuid = proxy.uuid;
  if (proxy.password) ir.auth.password = proxy.password;
  if (proxy.method) ir.auth.method = proxy.method;

  if (proxy.tls) {
    ir.tls = {
      sni: proxy.tls.server_name,
      alpn: typeof proxy.tls.alpn !== 'undefined' ? proxy.tls.alpn : proxy.alpn,
    };
    if (proxy.tls.reality) {
      ir.tls.reality = {
        publicKey: proxy.tls.reality.public_key,
        shortId: proxy.tls.reality.short_id,
      };
    }
    if (proxy.tls.utls && proxy.tls.utls.fingerprint) {
      ir.tls.utls = { fingerprint: proxy.tls.utls.fingerprint };
    }
  }

  // Stash target-specific extras
  ir.ext = ir.ext || {};
  ir.ext.clash = ir.ext.clash || {};
  ir.ext.singbox = ir.ext.singbox || {};

  // Common runtime flags
  if (typeof proxy.udp !== 'undefined') ir.udp = proxy.udp;
  if (proxy.network) ir.network = proxy.network;
  if (proxy.transport) ir.transport = proxy.transport;
  if (proxy.flow) ir.flow = proxy.flow;
  if (proxy.packet_encoding) ir.packetEncoding = proxy.packet_encoding;

  // Protocol-specific extras (kept generic)
  ir.proto = {};
  if (kind === 'hysteria2') {
    ir.proto.hy2 = {
      obfs: proxy.obfs,
      auth: proxy.auth,
      recv_window_conn: proxy.recv_window_conn,
      up: proxy.up,
      down: proxy.down,
      ports: proxy.ports,
      hop_interval: proxy.hop_interval,
      fast_open: proxy.fast_open,
    };
  } else if (kind === 'tuic') {
    ir.proto.tuic = {
      congestion_control: proxy.congestion_control,
      udp_relay_mode: proxy.udp_relay_mode,
      zero_rtt: proxy.zero_rtt,
      reduce_rtt: proxy.reduce_rtt,
      fast_open: proxy.fast_open,
      disable_sni: proxy.disable_sni,
    };
  } else if (kind === 'anytls') {
    ir.proto.anytls = {
      idle_session_check_interval: proxy['idle-session-check-interval'],
      idle_session_timeout: proxy['idle-session-timeout'],
      min_idle_session: proxy['min-idle-session'],
    };
  }

  return ir;
}
