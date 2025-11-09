// Core IR and capability matrix scaffolding

// Capability matrix per target
export const CAPS = {
  clash: { reality: false, hy2: true, tuic: true, utls: false, ruleProviders: true, dnsOverHttps: true },
  singbox: { reality: true, hy2: true, tuic: true, utls: true, ruleProviders: false, dnsOverHttps: true },
  xray: { reality: true, hy2: false, tuic: false, utls: true, ruleProviders: false, dnsOverHttps: true },
};

// Minimal core IR structure (doc only; JS not enforcing types)
// {
//   kind: 'vmess'|'vless'|'trojan'|'ss'|'hy2'|'tuic'|'anytls',
//   host: string,
//   port: number,
//   auth?: { uuid?: string; password?: string; method?: string },
//   tls?: { sni?: string; alpn?: string[]; reality?: { publicKey?: string; shortId?: string }; utls?: { fingerprint?: string } },
//   tags?: string[],
//   ext?: { clash?: Record<string, unknown>; singbox?: Record<string, unknown>; xray?: Record<string, unknown> },
//   version: '1.0.0'
// }

export function downgradeByCaps(ir, target) {
  const caps = CAPS[target];
  if (!caps || !ir) return ir;
  const out = JSON.parse(JSON.stringify(ir));
  // Example: drop reality if unsupported
  if (!caps.reality && out.tls && out.tls.reality) {
    delete out.tls.reality;
  }
  // Drop utls fingerprint if target doesn't support utls
  if (!caps.utls && out.tls && out.tls.utls) {
    delete out.tls.utls;
  }
  return out;
}
