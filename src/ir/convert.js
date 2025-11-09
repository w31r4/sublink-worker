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
      alpn: proxy.tls.alpn,
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
  ir.ext.clash = {};
  ir.ext.singbox = {};

  return ir;
}

