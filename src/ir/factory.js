// IR Factory: Creates standardized Intermediate Representation nodes.

function sanitizeTags(tags) {
  if (!tags) return [];
  return []
    .concat(tags)
    .map(tag => (tag == null ? '' : String(tag).trim()))
    .filter(Boolean);
}

/**
 * Creates a base IR node with common fields and performs basic validation.
 * @param {object} data - The input data from a parser.
 * @returns {object} The base IR node.
 * @throws {Error} if required fields are missing.
 */
function createBaseNode(data) {
  if (!data.kind) {
    throw new Error('kind is required for all nodes');
  }
  if (!data.host || typeof data.port === 'undefined' || data.port === null) {
    throw new Error('host and port are required for all nodes');
  }
  const port = Number(data.port);
  if (!Number.isFinite(port)) {
    throw new Error('port must be a valid number');
  }
  const tags = sanitizeTags(data.tags);
  const node = {
    kind: data.kind,
    type: data.kind,
    host: data.host,
    server: data.host,
    port,
    server_port: port,
    tags,
    version: '1.0.0',
  };
  if (tags.length > 0) {
    node.tag = tags[0];
  }
  if (typeof data.udp !== 'undefined') node.udp = data.udp;
  if (data.network) node.network = data.network;
  if (data.transport) node.transport = data.transport;
  if (data.tls) {
    node.tls = { ...data.tls };
    if (Array.isArray(node.tls.alpn)) {
      node.alpn = [...node.tls.alpn];
    }
  }
  if (data.ext) node.ext = { ...data.ext };
  return node;
}

/**
 * Creates a VMess IR node.
 * @param {object} data - The parsed VMess data.
 * @returns {object} The VMess IR node.
 */
export function createVmessNode(data) {
  if (!data.uuid) {
    throw new Error('uuid is required for VMess');
  }
  const base = createBaseNode({ ...data, kind: 'vmess' });
  base.auth = {
    uuid: data.uuid,
    method: data.security || 'auto',
  };
  if (typeof data.alter_id !== 'undefined') {
    base.alterId = Number(data.alter_id);
    base.ext = {
      ...(base.ext || {}),
      clash: { ...(base.ext?.clash || {}), alterId: base.alterId },
    };
  }
  if (typeof data.tcp_fast_open !== 'undefined') {
    base.tcp_fast_open = data.tcp_fast_open;
  }
  base.uuid = base.auth.uuid;
  base.security = base.auth.method;
  return base;
}

/**
 * Creates a VLess IR node.
 * @param {object} data - The parsed VLess data.
 * @returns {object} The VLess IR node.
 */
export function createVlessNode(data) {
  if (!data.uuid) {
    throw new Error('uuid is required for VLess');
  }
  const base = createBaseNode({ ...data, kind: 'vless' });
  base.auth = {
    uuid: data.uuid,
  };
  if (data.flow) {
    base.flow = data.flow;
  }
  if (data.packet_encoding) {
    base.packet_encoding = data.packet_encoding;
    base.packetEncoding = data.packet_encoding;
  }
  base.uuid = base.auth.uuid;
  return base;
}

/**
 * Creates a Trojan IR node.
 * @param {object} data - The parsed Trojan data.
 * @returns {object} The Trojan IR node.
 */
export function createTrojanNode(data) {
  if (!data.password) {
    throw new Error('password is required for Trojan');
  }
  const base = createBaseNode({ ...data, kind: 'trojan' });
  base.auth = {
    password: data.password,
  };
  if (data.flow) {
    base.flow = data.flow;
  }
  base.password = data.password;
  return base;
}

/**
 * Creates a Shadowsocks IR node.
 * @param {object} data - The parsed Shadowsocks data.
 * @returns {object} The Shadowsocks IR node.
 */
export function createShadowsocksNode(data) {
  if (!data.password || !data.method) {
    throw new Error('password and method are required for Shadowsocks');
  }
  const base = createBaseNode({ ...data, kind: 'shadowsocks' });
  base.auth = {
    password: data.password,
    method: data.method,
  };
  base.password = data.password;
  base.method = data.method;
  return base;
}

/**
 * Creates a Hysteria2 IR node.
 * @param {object} data - The parsed Hysteria2 data.
 * @returns {object} The Hysteria2 IR node.
 */
export function createHysteria2Node(data) {
  if (!data.password) {
    throw new Error('password is required for Hysteria2');
  }
  const base = createBaseNode({ ...data, kind: 'hysteria2' });
  base.auth = {
    password: data.password,
  };
  base.password = data.password;
  
  // Hysteria2 specific fields
  base.proto = {
    hy2: {
      obfs: data.obfs,
      auth: data.auth,
      up: data.up,
      down: data.down,
      recv_window_conn: data.recv_window_conn,
      ports: data.ports,
      hop_interval: data.hop_interval,
      fast_open: data.fast_open,
    },
  };
  base.obfs = data.obfs;
  base.authPayload = data.auth;
  base.up = data.up;
  base.down = data.down;
  base.recv_window_conn = data.recv_window_conn;
  base.ports = data.ports;
  base.hop_interval = data.hop_interval;
  base.fast_open = data.fast_open;
  if (Array.isArray(data.alpn) && data.alpn.length > 0) {
    base.tls = { ...(base.tls || { enabled: true }), alpn: data.alpn };
    base.alpn = data.alpn;
  }

  return base;
}

/**
 * Creates an Anytls IR node.
 * @param {object} data - The parsed Anytls data.
 * @returns {object} The Anytls IR node.
 */
export function createAnytlsNode(data) {
  if (!data.password) {
    throw new Error('password is required for Anytls');
  }
  const base = createBaseNode({ ...data, kind: 'anytls' });
  base.auth = {
    password: data.password,
  };
  base.password = data.password;

  // Anytls specific fields
  base.proto = {
    anytls: {
      idle_session_check_interval: data.idle_session_check_interval,
      idle_session_timeout: data.idle_session_timeout,
      min_idle_session: data.min_idle_session,
    },
  };
  const idleCheck = data.idle_session_check_interval ?? data['idle-session-check-interval'];
  const idleTimeout = data.idle_session_timeout ?? data['idle-session-timeout'];
  const minIdle = data.min_idle_session ?? data['min-idle-session'];
  if (typeof idleCheck !== 'undefined') {
    base.idle_session_check_interval = idleCheck;
    base['idle-session-check-interval'] = idleCheck;
  }
  if (typeof idleTimeout !== 'undefined') {
    base.idle_session_timeout = idleTimeout;
    base['idle-session-timeout'] = idleTimeout;
  }
  if (typeof minIdle !== 'undefined') {
    base.min_idle_session = minIdle;
    base['min-idle-session'] = minIdle;
  }

  return base;
}

/**
 * Creates an HTTP/S IR node.
 * @param {object} data - The parsed HTTP/S data.
 * @returns {object} The HTTP/S IR node.
 */
export function createHttpNode(data) {
  const base = createBaseNode({ ...data, kind: data.kind });
  if (data.username || data.password) {
    base.auth = {
      username: data.username,
      password: data.password,
    };
  }
  return base;
}

/**
 * Creates a TUIC IR node.
 * @param {object} data - The parsed TUIC data.
 * @returns {object} The TUIC IR node.
 */
export function createTuicNode(data) {
  if (!data.uuid || !data.password) {
    throw new Error('uuid and password are required for TUIC');
  }
  const base = createBaseNode({ ...data, kind: 'tuic' });
  base.auth = {
    uuid: data.uuid,
    password: data.password,
  };
  base.uuid = data.uuid;
  base.password = data.password;

  // TUIC specific fields
  base.proto = {
    tuic: {
      congestion_control: data.congestion_control || 'bbr',
      udp_relay_mode: data.udp_relay_mode || 'native',
      zero_rtt: data.zero_rtt,
      reduce_rtt: data.reduce_rtt,
      fast_open: data.fast_open,
      disable_sni: data.disable_sni,
    }
  };
  base.congestion_control = data.congestion_control || 'bbr';
  base.udp_relay_mode = data.udp_relay_mode || 'native';
  if (typeof data.zero_rtt !== 'undefined') base.zero_rtt = data.zero_rtt;
  if (typeof data.reduce_rtt !== 'undefined') base.reduce_rtt = data.reduce_rtt;
  if (typeof data.fast_open !== 'undefined') base.fast_open = data.fast_open;
  if (typeof data.disable_sni !== 'undefined') base.disable_sni = data.disable_sni;

  return base;
}
