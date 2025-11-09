import { describe, it, expect } from 'vitest';
import { ShadowsocksParser } from './ShadowsocksParser.js';

describe('ShadowsocksParser', () => {
  const parser = new ShadowsocksParser();

  it('should parse a modern format ss URL', () => {
    const url = 'ss://YWVzLTI1Ni1nY206dGVzdHBhc3N3b3Jk@example.com:8443#MySSNode';
    const result = parser.parse(url);

    expect(result.tag).toBe('MySSNode');
    expect(result.server).toBe('example.com');
    expect(result.server_port).toBe(8443);
    expect(result.method).toBe('aes-256-gcm');
    expect(result.password).toBe('testpassword');
  });

  it('should parse a legacy format ss URL', () => {
    // base64('aes-128-cfb:legacy-password@legacy.server.com:12345')
    const url = 'ss://YWVzLTEyOC1jZmI6bGVnYWN5LXBhc3N3b3JkQGxlZ2FjeS5zZXJ2ZXIuY29tOjEyMzQ1#Legacy';
    const result = parser.parse(url);

    expect(result.tag).toBe('Legacy');
    expect(result.server).toBe('legacy.server.com');
    expect(result.server_port).toBe(12345);
    expect(result.method).toBe('aes-128-cfb');
    expect(result.password).toBe('legacy-password');
  });

  it('should handle URL with encoded tag', () => {
    const url = 'ss://YWVzLTI1Ni1nY206dGVzdHBhc3N3b3Jk@example.com:8443#%E4%B8%AD%E6%96%87%E8%8A%82%E7%82%B9'; // 中文节点
    const result = parser.parse(url);
    expect(result.tag).toBe('中文节点');
  });

  it('should handle IPv6 address in server part', () => {
    const url = 'ss://YWVzLTI1Ni1nY206dGVzdHBhc3N3b3Jk@[::1]:8443#IPv6Node';
    const result = parser.parse(url);

    expect(result.tag).toBe('IPv6Node');
    expect(result.server).toBe('::1');
    expect(result.server_port).toBe(8443);
  });
});