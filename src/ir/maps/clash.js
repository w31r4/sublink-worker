// Map Core IR to Clash proxy object (scaffold)
export function mapIRToClash(ir) {
  if (!ir) return null;
  const base = {
    name: ir.tags?.[0] || 'proxy',
    server: ir.host,
    port: ir.port,
  };

  switch (ir.kind) {
    case 'shadowsocks':
      return { ...base, type: 'ss' };
    case 'vmess':
      return { ...base, type: 'vmess' };
    case 'vless':
      return { ...base, type: 'vless' };
    case 'trojan':
      return { ...base, type: 'trojan' };
    case 'hy2':
    case 'hysteria2':
      return { ...base, type: 'hysteria2' };
    case 'tuic':
      return { ...base, type: 'tuic' };
    case 'anytls':
      return { ...base, type: 'anytls' };
    default:
      return null;
  }
}

