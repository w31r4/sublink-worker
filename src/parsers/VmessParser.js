import { decodeBase64 } from '../utils.js';

const normalizeToArray = (value) => {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
};

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
    case 'tcp': // for http upgrade
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

export class VmessParser {
  canParse(url) {
    return url.startsWith('vmess://');
  }

  parse(url) {
    try {
      let base64WithFragment = url.replace('vmess://', '');
      let tagOverride;
      const hashPos = base64WithFragment.indexOf('#');
      if (hashPos >= 0) {
        tagOverride = decodeURIComponent(base64WithFragment.slice(hashPos + 1));
        base64WithFragment = base64WithFragment.slice(0, hashPos);
      }
      const vmessConfig = JSON.parse(decodeBase64(base64WithFragment));

      const tlsEnabled = vmessConfig.tls && vmessConfig.tls !== 'none';
      const tls = tlsEnabled ? {
        enabled: true,
        server_name: vmessConfig.sni,
        insecure: vmessConfig['skip-cert-verify'] || false,
      } : undefined;

      const transport = createTransport(vmessConfig);

      return {
        tag: tagOverride || vmessConfig.ps,
        type: "vmess",
        server: vmessConfig.add,
        server_port: parseInt(vmessConfig.port),
        uuid: vmessConfig.id,
        alter_id: parseInt(vmessConfig.aid),
        security: vmessConfig.scy || "auto",
        network: transport?.type || vmessConfig.net || "tcp",
        tcp_fast_open: false,
        transport: transport,
        tls: tls,
      };
    } catch (e) {
      console.error('Failed to parse vmess URL:', e);
      return null;
    }
  }
}
