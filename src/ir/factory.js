// IR Factory: Creates standardized Intermediate Representation nodes.

/**
 * Creates a base IR node with common fields and performs basic validation.
 * @param {object} data - The input data from a parser.
 * @returns {object} The base IR node.
 * @throws {Error} if required fields are missing.
 */
function createBaseNode(data) {
  if (!data.host || !data.port) {
    throw new Error('host and port are required for all nodes');
  }
  return {
    kind: data.kind,
    host: data.host,
    port: parseInt(data.port, 10),
    tags: data.tags || [],
    version: '1.0.0',
    ...(typeof data.udp !== 'undefined' && { udp: data.udp }),
    ...(data.network && { network: data.network }),
    ...(data.transport && { transport: data.transport }),
    ...(data.tls && { tls: data.tls }),
  };
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
  // Stash alterId for clients that need it (e.g., Clash)
  if (typeof data.alter_id !== 'undefined') {
    base.ext = { clash: { alterId: data.alter_id } };
  }
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
  const base = createBaseNode({ ...data, kind: 'ss' });
  base.auth = {
    password: data.password,
    method: data.method,
  };
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
  
  // Hysteria2 specific fields
  base.proto = {
    hy2: {
      obfs: data.obfs,
      auth: data.auth,
      up: data.up,
      down: data.down,
    }
  };

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

  // Anytls specific fields
  base.proto = {
    anytls: {
      'idle-session-check-interval': data['idle-session-check-interval'],
      'idle-session-timeout': data['idle-session-timeout'],
      'min-idle-session': data['min-idle-session'],
    }
  };

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

  return base;
}