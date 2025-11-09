import { decodeBase64 } from '../utils.js';
import { createVmessNode } from '../ir/factory.js';

// 确保值是一个数组
const normalizeToArray = (value) => {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
};

// 创建 HTTP 传输配置
const createHttpTransport = (config) => {
  const path = config.path || '/';
  const headers = (() => {
    const hostHeader = normalizeToArray(config.host || config.sni);
    if (config.headers && typeof config.headers === 'object') {
      const normalized = {};
      Object.entries(config.headers).forEach(([key, value]) => {
        const normalizedValue = normalizeToArray(value)?.map(entry => `${entry}`);
        if (normalizedValue && normalizedValue.length > 0) {
          normalized[key] = normalizedValue;
        }
      });
      if (hostHeader && !normalized.Host) {
        normalized.Host = hostHeader;
      }
      if (Object.keys(normalized).length > 0) {
        return normalized;
      }
    }
    return hostHeader ? { 'Host': hostHeader } : undefined;
  })();

  return {
    type: "http",
    method: config.method || 'GET',
    path: Array.isArray(path) ? path : [path],
    headers: headers,
  };
};

// 根据 vmess 配置创建传输配置
const createTransport = (config) => {
  const networkType = config.net || 'tcp';
  const transportType = config.type || networkType;

  switch (networkType) {
    case 'ws':
      return {
        type: "ws",
        path: config.path,
        headers: { 'Host': config.host || config.sni },
      };
    case 'http':
    case 'tcp': // 用于 http upgrade
      if (transportType === 'http') {
        return createHttpTransport(config);
      }
      return undefined;
    case 'grpc':
      return {
        type: "grpc",
        service_name: config.path || config.serviceName,
      };
    case 'h2':
      const hostValue = config.host || config.sni;
      return {
        type: "h2",
        path: config.path,
        host: hostValue ? normalizeToArray(hostValue) : undefined,
      };
    default:
      return undefined;
  }
};

// VMess 协议的 URL 解析器
export class VmessParser {
  // 判断是否能解析该 URL
  canParse(url) {
    return url.startsWith('vmess://');
  }

  // 解析 URL
  parse(url) {
    try {
      let base64WithFragment = url.replace('vmess://', '');
      let tagOverride;
      // 处理 URL 中的 # 标签
      const hashPos = base64WithFragment.indexOf('#');
      if (hashPos >= 0) {
        tagOverride = decodeURIComponent(base64WithFragment.slice(hashPos + 1));
        base64WithFragment = base64WithFragment.slice(0, hashPos);
      }
      // Base64 解码并解析 JSON
      const vmessConfig = JSON.parse(decodeBase64(base64WithFragment));

      // 解析 TLS 设置
      const tlsEnabled = vmessConfig.tls && vmessConfig.tls !== 'none';
      const tls = tlsEnabled ? {
        enabled: true,
        sni: vmessConfig.sni,
        server_name: vmessConfig.sni,
        insecure: vmessConfig['skip-cert-verify'] || false,
      } : undefined;

      // 创建传输配置
      const transport = createTransport(vmessConfig);
      const tag = tagOverride || vmessConfig.ps;
      const tcpFastOpen = typeof vmessConfig['fast-open'] !== 'undefined'
        ? !!vmessConfig['fast-open']
        : undefined;

      // 创建并返回 VMess 节点对象
      return createVmessNode({
        host: vmessConfig.add,
        port: vmessConfig.port,
        uuid: vmessConfig.id,
        alter_id: vmessConfig.aid ? parseInt(vmessConfig.aid) : undefined,
        security: vmessConfig.scy || 'auto',
        network: transport?.type || vmessConfig.net || 'tcp',
        transport: transport,
        tls: tls,
        tags: tag ? [tag] : [],
        tcp_fast_open: tcpFastOpen,
      });
    } catch (e) {
      console.error('解析 VMess URL 失败:', e);
      return null;
    }
  }
}
