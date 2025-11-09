// 核心内部表示 (IR) 和功能矩阵

// 定义不同客户端（目标）的功能支持矩阵
export const CAPS = {
  clash: { reality: false, hy2: true, tuic: true, utls: false, ruleProviders: true, dnsOverHttps: true },
  singbox: { reality: true, hy2: true, tuic: true, utls: true, ruleProviders: false, dnsOverHttps: true },
  xray: { reality: true, hy2: false, tuic: false, utls: true, ruleProviders: false, dnsOverHttps: true },
};

// 核心 IR 结构（仅作文档参考，JS 不会强制类型检查）
// {
//   kind: 'vmess'|'vless'|'trojan'|'ss'|'hy2'|'tuic'|'anytls', // 协议类型
//   host: string, // 服务器地址
//   port: number, // 服务器端口
//   auth?: { uuid?: string; password?: string; method?: string }, // 认证信息
//   tls?: { sni?: string; alpn?: string[]; reality?: { publicKey?: string; shortId?: string }; utls?: { fingerprint?: string } }, // TLS 设置
//   tags?: string[], // 节点标签
//   ext?: { clash?: Record<string, unknown>; singbox?: Record<string, unknown>; xray?: Record<string, unknown> }, // 客户端特定扩展
//   version: '1.0.0' // IR 版本
// }

/**
 * 根据目标客户端的功能矩阵，对 IR 对象进行降级处理，移除不支持的特性。
 * @param {object} ir - 原始的内部表示 (IR) 对象。
 * @param {string} target - 目标客户端名称 (e.g., 'clash', 'singbox')。
 * @returns {object} 降级处理后的 IR 对象。
 */
export function downgradeByCaps(ir, target) {
  const caps = CAPS[target];
  if (!caps || !ir) return ir;
  const out = JSON.parse(JSON.stringify(ir)); // 深拷贝以避免修改原对象

  // 示例：如果目标不支持 reality，则移除 reality 相关配置
  if (!caps.reality && out.tls && out.tls.reality) {
    delete out.tls.reality;
  }
  // 如果目标不支持 uTLS，则移除 uTLS 指纹
  if (!caps.utls && out.tls && out.tls.utls) {
    delete out.tls.utls;
  }
  return out;
}
