export function mapIRToXray(ir, original) {
  if (!ir) return null;
  const host = ir.host;
  const port = ir.port;
  const stream = buildStreamSettings(ir, original);

  switch (ir.kind) {
    case 'vmess':
      return {
        protocol: 'vmess',
        tag: ir.tags?.[0] || 'proxy',
        settings: {
          vnext: [{ address: host, port, users: [{ id: original?.uuid || ir.auth?.uuid, security: original?.security || 'auto' }] }]
        },
        ...(stream ? { streamSettings: stream } : {})
      };
    case 'vless':
      return {
        protocol: 'vless',
        tag: ir.tags?.[0] || 'proxy',
        settings: {
          vnext: [{ address: host, port, users: [{ id: original?.uuid || ir.auth?.uuid, encryption: 'none', flow: original?.flow }] }]
        },
        ...(stream ? { streamSettings: stream } : {})
      };
    case 'trojan':
      return {
        protocol: 'trojan',
        tag: ir.tags?.[0] || 'proxy',
        settings: { servers: [{ address: host, port, password: original?.password || ir.auth?.password, sni: ir.tls?.sni }] },
        ...(stream ? { streamSettings: stream } : {})
      };
    case 'shadowsocks':
      return {
        protocol: 'shadowsocks',
        tag: ir.tags?.[0] || 'proxy',
        settings: { servers: [{ address: host, port, method: original?.method, password: original?.password }] }
      };
    default:
      return null;
  }
}

function buildStreamSettings(ir, original) {
  const network = original?.transport?.type || original?.network || 'tcp';
  const tls = ir.tls;
  const stream = { network };
  if (network === 'ws') {
    stream.wsSettings = { path: original?.transport?.path, headers: original?.transport?.headers };
  } else if (network === 'grpc') {
    stream.grpcSettings = { serviceName: original?.transport?.service_name };
  } else if (network === 'http' || network === 'h2') {
    stream.httpSettings = { path: original?.transport?.path, host: original?.transport?.host };
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
        allowInsecure: !!original?.tls?.insecure,
        ...(Array.isArray(tls.alpn) ? { alpn: tls.alpn } : {})
      };
    }
  }
  return stream;
}
