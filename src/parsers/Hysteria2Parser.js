import { parseUrlParams, parseServerInfo, createTlsConfig } from './url.js';
import { parseMaybeNumber, parseArray, parseBool } from '../utils.js';
import { createHysteria2Node } from '../ir/factory.js';

// Hysteria2 协议的 URL 解析器
export class Hysteria2Parser {
  // 判断是否能解析该 URL
  canParse(url) {
    return url.startsWith('hysteria://') || url.startsWith('hysteria2://') || url.startsWith('hy2://');
  }

  // 解析 URL
  parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    let host, port;
    let password = null;

    // 从 addressPart 中提取认证信息和服务器地址
    if (addressPart.includes('@')) {
      const [pwd, serverInfo] = addressPart.split('@');
      const parsed = parseServerInfo(serverInfo);
      host = parsed.host;
      port = parsed.port;
      password = decodeURIComponent(pwd);
    } else {
      // 兼容不含 @ 的格式，此时密码从参数中获取
      const parsed = parseServerInfo(addressPart);
      host = parsed.host;
      port = parsed.port;
      password = params.auth;
    }

    // 解析 OBFS 设置
    const obfs = {};
    if (params['obfs-password']) {
      obfs.type = params.obfs;
      obfs.password = params['obfs-password'];
    }

    // 解析其他 Hysteria2 特定参数
    const hopInterval = parseMaybeNumber(params['hop-interval']);
    const recvWindowConn = parseMaybeNumber(params['recv-window-conn'] ?? params.recv_window_conn);
    const ports = params.ports ? String(params.ports) : undefined;
    const alpn = parseArray(params.alpn);
    const fastOpen = parseBool(params['fast-open']);
    
    // 创建 TLS 配置
    const tls = createTlsConfig(params);
    if (alpn) {
      tls.alpn = alpn;
    }

    // 创建并返回 Hysteria2 节点对象
    return createHysteria2Node({
      host,
      port,
      password,
      tls,
      obfs: Object.keys(obfs).length > 0 ? obfs : undefined,
      auth: params.auth,
      up: params.up ?? (params.upmbps ? parseMaybeNumber(params.upmbps) : undefined),
      down: params.down ?? (params.downmbps ? parseMaybeNumber(params.downmbps) : undefined),
      recv_window_conn: recvWindowConn,
      ports,
      hop_interval: hopInterval,
      fast_open: fastOpen,
      alpn,
      tags: name ? [name] : [],
    });
  }
}
