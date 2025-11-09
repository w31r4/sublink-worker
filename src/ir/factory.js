// IR 工厂：用于创建标准化的内部表示（IR）节点。

// 清理和规范化标签数组
function sanitizeTags(tags) {
  if (!tags) return [];
  return []
    .concat(tags)
    .map(tag => (tag == null ? '' : String(tag).trim()))
    .filter(Boolean);
}

/**
 * 创建一个包含通用字段的基础 IR 节点，并执行基本验证。
 * @param {object} data - 来自解析器的输入数据。
 * @returns {object} 基础 IR 节点。
 * @throws {Error} 如果缺少必需字段。
 */
function createBaseNode(data) {
  if (!data.kind) {
    throw new Error('所有节点都需要 kind 字段');
  }
  if (!data.host || typeof data.port === 'undefined' || data.port === null) {
    throw new Error('所有节点都需要 host 和 port 字段');
  }
  const port = Number(data.port);
  if (!Number.isFinite(port)) {
    throw new Error('端口必须是有效的数字');
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
    version: '1.0.0', // IR 版本
  };
  if (tags.length > 0) {
    node.tag = tags[0];
  }
  // 添加可选的通用字段
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
 * 创建一个 VMess IR 节点。
 * @param {object} data - 解析后的 VMess 数据。
 * @returns {object} VMess IR 节点。
 */
export function createVmessNode(data) {
  if (!data.uuid) {
    throw new Error('VMess 节点需要 uuid');
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
  // 为方便访问，将核心认证信息提升到顶层
  base.uuid = base.auth.uuid;
  base.security = base.auth.method;
  return base;
}

/**
 * 创建一个 VLess IR 节点。
 * @param {object} data - 解析后的 VLess 数据。
 * @returns {object} VLess IR 节点。
 */
export function createVlessNode(data) {
  if (!data.uuid) {
    throw new Error('VLess 节点需要 uuid');
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
 * 创建一个 Trojan IR 节点。
 * @param {object} data - 解析后的 Trojan 数据。
 * @returns {object} Trojan IR 节点。
 */
export function createTrojanNode(data) {
  if (!data.password) {
    throw new Error('Trojan 节点需要 password');
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
 * 创建一个 Shadowsocks IR 节点。
 * @param {object} data - 解析后的 Shadowsocks 数据。
 * @returns {object} Shadowsocks IR 节点。
 */
export function createShadowsocksNode(data) {
  if (!data.password || !data.method) {
    throw new Error('Shadowsocks 节点需要 password 和 method');
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
 * 创建一个 Hysteria2 IR 节点。
 * @param {object} data - 解析后的 Hysteria2 数据。
 * @returns {object} Hysteria2 IR 节点。
 */
export function createHysteria2Node(data) {
  if (!data.password) {
    throw new Error('Hysteria2 节点需要 password');
  }
  const base = createBaseNode({ ...data, kind: 'hysteria2' });
  base.auth = {
    password: data.password,
  };
  base.password = data.password;
  
  // Hysteria2 特定字段
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
  // 为方便访问，将特定字段提升到顶层
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
 * 创建一个 Anytls IR 节点。
 * @param {object} data - 解析后的 Anytls 数据。
 * @returns {object} Anytls IR 节点。
 */
export function createAnytlsNode(data) {
  if (!data.password) {
    throw new Error('Anytls 节点需要 password');
  }
  const base = createBaseNode({ ...data, kind: 'anytls' });
  base.auth = {
    password: data.password,
  };
  base.password = data.password;

  // Anytls 特定字段
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
 * 创建一个 HTTP/S IR 节点。
 * @param {object} data - 解析后的 HTTP/S 数据。
 * @returns {object} HTTP/S IR 节点。
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
 * 创建一个 TUIC IR 节点。
 * @param {object} data - 解析后的 TUIC 数据。
 * @returns {object} TUIC IR 节点。
 */
export function createTuicNode(data) {
  if (!data.uuid || !data.password) {
    throw new Error('TUIC 节点需要 uuid 和 password');
  }
  const base = createBaseNode({ ...data, kind: 'tuic' });
  base.auth = {
    uuid: data.uuid,
    password: data.password,
  };
  base.uuid = data.uuid;
  base.password = data.password;

  // TUIC 特定字段
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
