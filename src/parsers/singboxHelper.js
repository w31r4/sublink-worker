import {
  createShadowsocksNode,
  createVmessNode,
  createVlessNode,
  createTrojanNode,
  createHysteria2Node,
  createTuicNode,
  createAnytlsNode,
  createHttpNode,
} from '../ir/factory.js';

function normalizeTags(outbound) {
  const tag = outbound?.tag;
  if (typeof tag === 'string' && tag.trim()) return [tag.trim()];
  const name = outbound?.name;
  if (typeof name === 'string' && name.trim()) return [name.trim()];
  return [];
}

function normalizeNetwork(outbound) {
  return outbound?.network || outbound?.transport?.type || 'tcp';
}

/**
 * 将 sing-box outbounds 中的单个 outbound 转换为 IR 节点。
 * 仅适用于“真实节点”类型；selector/urltest/direct/block/dns 等应在调用方过滤。
 *
 * @param {object} outbound sing-box outbound
 * @returns {object|null} IR node
 */
export function convertSingboxOutboundToIR(outbound) {
  if (!outbound || typeof outbound !== 'object') return null;

  const type = String(outbound.type || '').toLowerCase();
  const tags = normalizeTags(outbound);

  const host = outbound.server;
  const port = outbound.server_port;

  const common = {
    host,
    port,
    tags,
    udp: outbound.udp,
    network: normalizeNetwork(outbound),
    transport: outbound.transport,
    tls: outbound.tls,
    ext: { singbox: { ...outbound } },
  };

  try {
    switch (type) {
      case 'vmess':
        return createVmessNode({
          ...common,
          uuid: outbound.uuid,
          security: outbound.security,
        });
      case 'vless':
        return createVlessNode({
          ...common,
          uuid: outbound.uuid,
          flow: outbound.flow,
          packet_encoding: outbound.packet_encoding,
        });
      case 'trojan':
        return createTrojanNode({
          ...common,
          password: outbound.password,
          flow: outbound.flow,
        });
      case 'shadowsocks':
        return createShadowsocksNode({
          ...common,
          method: outbound.method,
          password: outbound.password,
        });
      case 'hysteria2': {
        return createHysteria2Node({
          ...common,
          password: outbound.password,
          tls: outbound.tls,
          obfs: outbound.obfs,
          auth: outbound.auth,
          up: outbound.up,
          down: outbound.down,
          recv_window_conn: outbound.recv_window_conn,
          ports: outbound.ports,
          hop_interval: outbound.hop_interval,
          fast_open: outbound.fast_open,
          alpn: outbound.alpn,
        });
      }
      case 'tuic':
        return createTuicNode({
          ...common,
          tls: outbound.tls,
          uuid: outbound.uuid,
          password: outbound.password,
          congestion_control: outbound.congestion_control,
          udp_relay_mode: outbound.udp_relay_mode,
          zero_rtt: outbound.zero_rtt,
          reduce_rtt: outbound.reduce_rtt,
          fast_open: outbound.fast_open,
          disable_sni: outbound.disable_sni,
        });
      case 'anytls':
        return createAnytlsNode({
          ...common,
          tls: outbound.tls,
          password: outbound.password,
          idle_session_check_interval: outbound.idle_session_check_interval,
          idle_session_timeout: outbound.idle_session_timeout,
          min_idle_session: outbound.min_idle_session,
        });
      case 'http':
      case 'https':
        return createHttpNode({
          ...common,
          kind: type,
          username: outbound.username,
          password: outbound.password,
        });
      default:
        return null;
    }
  } catch (_) {
    return null;
  }
}

export const SINGBOX_REAL_NODE_TYPES = new Set([
  'vmess',
  'vless',
  'trojan',
  'shadowsocks',
  'hysteria2',
  'tuic',
  'anytls',
  'http',
  'https',
]);
