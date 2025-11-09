/**
 * 将核心内部表示 (IR) 映射到 sing-box 出站对象。
 * @param {object} ir - 内部表示 (IR) 对象。
 * @param {object} [original] - 原始解析出的对象，用于备用。
 * @returns {object|null} sing-box 出站对象，或在无法映射时返回 null。
 */
export function mapIRToSingbox(ir, original) {
  if (!ir) return null;
  // 从 IR 中提取通用字段
  const auth = ir.auth || original?.auth || {};
  const transport = ir.transport || original?.transport;
  const tls = ir.tls || original?.tls;
  const network = ir.network || original?.network || 'tcp';
  const base = {
    type: ir.kind,
    tag: ir.tags?.[0] || ir.tag || 'proxy',
    server: ir.host,
    server_port: ir.port,
  };

  // 根据不同的协议类型进行映射
  if (ir.kind === 'anytls') {
    // 将数值转换为 sing-box 的时长格式 (e.g., "10s")
    const toDuration = (v) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === 'number') return `${v}s`;
      const s = String(v).trim();
      return /[a-zA-Z]$/.test(s) ? s : `${s}s`;
    };
    const p = ir.proto?.anytls || {};
    const out = {
      ...base,
      password: auth.password,
      tls: tls && typeof tls === 'object' ? { ...tls } : { enabled: true },
    };
    if (typeof p.idle_session_check_interval !== 'undefined') out.idle_session_check_interval = toDuration(p.idle_session_check_interval);
    if (typeof p.idle_session_timeout !== 'undefined') out.idle_session_timeout = toDuration(p.idle_session_timeout);
    if (typeof p.min_idle_session !== 'undefined') out.min_idle_session = Number(p.min_idle_session);
    return out;
  }
  if (ir.kind === 'shadowsocks') {
    const out = {
      ...base,
      type: 'shadowsocks',
      method: auth.method,
      password: auth.password,
    };
    return out;
  }

  if (ir.kind === 'vless') {
    const out = {
      ...base,
      uuid: auth.uuid,
      tls: tls ? { ...tls } : undefined,
      transport,
      network,
      flow: ir.flow,
    };
    return out;
  }

  if (ir.kind === 'hysteria2' || ir.kind === 'hy2') {
    const p = ir.proto?.hy2 || {};
    const out = {
      ...base,
      type: 'hysteria2',
      password: auth.password,
      tls: tls ? { ...tls } : undefined,
      obfs: p.obfs,
      auth: p.auth,
      recv_window_conn: p.recv_window_conn,
      up: p.up,
      down: p.down,
      ports: p.ports,
      hop_interval: typeof p.hop_interval !== 'undefined' ? p.hop_interval : undefined,
      alpn: tls?.alpn,
      fast_open: typeof p.fast_open !== 'undefined' ? p.fast_open : undefined,
    };
    return out;
  }

  if (ir.kind === 'vmess') {
    const out = {
      ...base,
      type: 'vmess',
      uuid: auth.uuid,
      security: auth.method,
      tls: tls ? { ...tls } : undefined,
      transport,
      network,
    };
    return out;
  }

  if (ir.kind === 'trojan') {
    const out = {
      ...base,
      type: 'trojan',
      password: auth.password,
      tls: tls ? { ...tls } : undefined,
      transport,
      network,
      flow: ir.flow,
    };
    return out;
  }

  // 如果此处未实现，则让构建器进行回退处理
  return null;
}
