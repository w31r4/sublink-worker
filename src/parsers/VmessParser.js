import { decodeBase64 } from '../utils.js';

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
      
      let tls = { "enabled": false };
      let transport;
      const networkType = vmessConfig.net || 'tcp';
      const transportType = vmessConfig.type || networkType;

      const tlsEnabled = vmessConfig.tls && vmessConfig.tls !== '' && vmessConfig.tls !== 'none';
      if (tlsEnabled) {
        tls = {
          "enabled": true,
          "server_name": vmessConfig.sni,
          "insecure": vmessConfig['skip-cert-verify'] || false
        };
      }

      if (networkType === 'ws') {
        transport = {
          "type": "ws",
          "path": vmessConfig.path,
          "headers": { 'Host': vmessConfig.host ? vmessConfig.host : vmessConfig.sni }
        };
      } else if ((networkType === 'tcp' && transportType === 'http') || networkType === 'http') {
        const method = vmessConfig.method || 'GET';
        const path = vmessConfig.path || '/';
        const normalizeToArray = (value) => {
          if (!value) return undefined;
          return Array.isArray(value) ? value : [value];
        };
        const headers = (() => {
          const hostHeader = normalizeToArray(vmessConfig.host || vmessConfig.sni);
          if (vmessConfig.headers && typeof vmessConfig.headers === 'object') {
            const normalized = {};
            Object.entries(vmessConfig.headers).forEach(([key, value]) => {
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

        transport = {
          "type": "http",
          "method": method,
          "path": Array.isArray(path) ? path : [path],
          "headers": headers
        };
      } else if (networkType === 'grpc') {
        transport = {
          "type": "grpc",
          "service_name": vmessConfig?.path || vmessConfig?.serviceName
        };
      } else if (networkType === 'h2') {
        const hostValue = vmessConfig.host || vmessConfig.sni;
        transport = {
          "type": "h2",
          "path": vmessConfig.path,
          "host": hostValue ? (Array.isArray(hostValue) ? hostValue : [hostValue]) : undefined
        };
      }

      return {
        "tag": tagOverride || vmessConfig.ps,
        "type": "vmess",
        "server": vmessConfig.add,
        "server_port": parseInt(vmessConfig.port),
        "uuid": vmessConfig.id,
        "alter_id": parseInt(vmessConfig.aid),
        "security": vmessConfig.scy || "auto",
        "network": transport?.type || networkType || "tcp",
        "tcp_fast_open": false,
        "transport": transport,
        "tls": tls.enabled ? tls : undefined
      };
    } catch (e) {
      console.error('Failed to parse vmess URL:', e);
      return null;
    }
  }
}
