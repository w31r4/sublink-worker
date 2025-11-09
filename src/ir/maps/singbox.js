// Map Core IR to sing-box outbound object (scaffold)
export function mapIRToSingbox(ir) {
  if (!ir) return null;
  const base = {
    type: ir.kind,
    tag: ir.tags?.[0] || 'proxy',
    server: ir.host,
    server_port: ir.port,
  };
  return base;
}

