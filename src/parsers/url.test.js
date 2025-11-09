import { describe, it, expect } from 'vitest';
import { parseServerInfo, parseUrlParams, createTlsConfig, createTransportConfig } from './url.js';

describe('url.js', () => {
  describe('parseServerInfo', () => {
    it('should parse IPv4 host and port', () => {
      const { host, port } = parseServerInfo('example.com:443');
      expect(host).toBe('example.com');
      expect(port).toBe(443);
    });

    it('should parse IPv6 host and port', () => {
      const { host, port } = parseServerInfo('[::1]:8080');
      expect(host).toBe('::1');
      expect(port).toBe(8080);
    });
  });

  describe('parseUrlParams', () => {
    it('should parse a simple URL', () => {
      const url = 'trojan://password@example.com:443#MyNode';
      const { addressPart, params, name } = parseUrlParams(url);
      expect(addressPart).toBe('password@example.com:443');
      expect(params).toEqual({});
      expect(name).toBe('MyNode');
    });

    it('should parse a URL with query parameters', () => {
      const url = 'vless://uuid@example.com:443?type=ws&path=%2Fpath&security=tls#MyVless';
      const { addressPart, params, name } = parseUrlParams(url);
      expect(addressPart).toBe('uuid@example.com:443');
      expect(params).toEqual({
        type: 'ws',
        path: '/path',
        security: 'tls'
      });
      expect(name).toBe('MyVless');
    });
  });

  describe('createTlsConfig', () => {
    it('should return disabled for security=none', () => {
      const tls = createTlsConfig({ security: 'none' });
      expect(tls.enabled).toBe(false);
    });

    it('should create a basic TLS config', () => {
      const tls = createTlsConfig({ security: 'tls', sni: 'example.com' });
      expect(tls.enabled).toBe(true);
      expect(tls.server_name).toBe('example.com');
      expect(tls.insecure).toBe(false);
    });

    it('should handle reality params', () => {
      const tls = createTlsConfig({ security: 'reality', pbk: 'key', sid: 'short' });
      expect(tls.reality.enabled).toBe(true);
      expect(tls.reality.public_key).toBe('key');
      expect(tls.reality.short_id).toBe('short');
    });
  });

  describe('createTransportConfig', () => {
    it('should create a websocket transport config', () => {
      const transport = createTransportConfig({ type: 'ws', path: '/ws-path', host: 'example.com' });
      expect(transport.type).toBe('ws');
      expect(transport.path).toBe('/ws-path');
      expect(transport.headers.host).toBe('example.com');
    });

    it('should create a grpc transport config', () => {
      const transport = createTransportConfig({ type: 'grpc', serviceName: 'my-service' });
      expect(transport.type).toBe('grpc');
      expect(transport.service_name).toBe('my-service');
    });
  });
});