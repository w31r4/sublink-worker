/**
 * 将核心内部表示 (IR) 映射到 Xray 出站对象。
 * @param {object} ir - 内部表示 (IR) 对象。
 * @param {object} [original] - 原始解析出的对象，用于备用。
 * @returns {object|null} Xray 出站对象，或在无法映射时返回 null。
 */
export function mapIRToXray(ir, original) {
  if (!ir) return null;
  // 从 IR 中提取通用字段
  const auth = ir.auth || original?.auth || {};
  const transport = ir.transport || original?.transport;
  const tls = ir.tls || original?.tls;
  const host = ir.host;
  const port = ir.port;
  const stream = buildStreamSettings(ir, transport, tls);

  // 根据不同的协议类型进行映射
  switch (ir.kind) {
    case 'vmess':
      return {
        protocol: 'vmess',
        tag: ir.tags?.[0] || 'proxy',
        settings: {
          vnext: [{ address: host, port, users: [{ id: auth.uuid, security: auth.method || 'auto' }] }]
        },
        ...(stream ? { streamSettings: stream } : {})
      };
    case 'vless':
      return {
        protocol: 'vless',
        tag: ir.tags?.[0] || 'proxy',
        settings: {
          vnext: [{ address: host, port, users: [{ id: auth.uuid, encryption: 'none', flow: ir.flow }] }]
        },
        ...(stream ? { streamSettings: stream } : {})
      };
    case 'trojan':
      return {
        protocol: 'trojan',
        tag: ir.tags?.[0] || 'proxy',
        settings: { servers: [{ address: host, port, password: auth.password, sni: tls?.sni }] },
        ...(stream ? { streamSettings: stream } : {})
      };
    case 'shadowsocks':
      return {
        protocol: 'shadowsocks',
        tag: ir.tags?.[0] || 'proxy',
        settings: { servers: [{ address: host, port, method: auth.method, password: auth.password }] }
      };
    default:
      return null;
  }
}

/**
 * 根据 IR、传输和 TLS 设置构建 Xray 的 streamSettings 对象。
 * @param {object} ir - 内部表示 (IR) 对象。
 * @param {object} transport - 传输设置对象。
 * @param {object} tls - TLS 设置对象。
 * @returns {object} Xray 的 streamSettings 对象。
 */
function buildStreamSettings(ir, transport, tls) {
  const network = transport?.type || ir.network || 'tcp';
  const stream = { network };
  // 根据网络类型构建不同的设置
  if (network === 'ws') {
    stream.wsSettings = { path: transport?.path, headers: transport?.headers };
  } else if (network === 'grpc') {
    stream.grpcSettings = { serviceName: transport?.service_name };
  } else if (network === 'http' || network === 'h2') {
    stream.httpSettings = { path: transport?.path, host: transport?.host };
  }
  // 处理 TLS 和 Reality 设置
  if (tls) {
    if (tls.reality) {
      stream.security = 'reality';
      stream.realitySettings = {
        serverName: tls.sni,
        publicKey: tls.reality.publicKey || tls.reality.public_key,
        shortId: tls.reality.shortId || tls.reality.short_id,
        ...(tls.utls?.fingerprint ? { fingerprint: tls.utls.fingerprint } : {})
      };
    } else {
      stream.security = 'tls';
      stream.tlsSettings = {
        serverName: tls.sni,
        allowInsecure: !!tls.insecure,
        ...(Array.isArray(tls.alpn) ? { alpn: tls.alpn } : {})
      };
    }
  }
  return stream;
}
