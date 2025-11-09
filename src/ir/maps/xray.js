export function mapIRToXray(ir, original) {
  if (!ir) return null;
  const auth = original?.auth || ir.auth || {};
  const transport = original?.transport || ir.transport;
  const tls = original?.tls || ir.tls;
  const host = ir.host;
  const port = ir.port;
  const stream = buildStreamSettings(ir, transport, tls);

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

function buildStreamSettings(ir, transport, tls) {
  const network = transport?.type || ir.network || 'tcp';
  const stream = { network };
  if (network === 'ws') {
    stream.wsSettings = { path: transport?.path, headers: transport?.headers };
  } else if (network === 'grpc') {
    stream.grpcSettings = { serviceName: transport?.service_name };
  } else if (network === 'http' || network === 'h2') {
    stream.httpSettings = { path: transport?.path, host: transport?.host };
  }
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
