import { describe, it, expect } from 'vitest';
import { convertYamlProxyToObject } from './yamlHelper.js';

describe('convertYamlProxyToObject', () => {
  it('should convert a vmess proxy object to IR', () => {
    const proxy = {
      name: 'vmess-ws-tls',
      type: 'vmess',
      server: 'server.com',
      port: 443,
      uuid: 'your-uuid',
      alterId: 0,
      cipher: 'auto',
      udp: true,
      tls: true,
      'skip-cert-verify': true,
      servername: 'server.com',
      network: 'ws',
      'ws-opts': {
        path: '/path',
        headers: {
          Host: 'server.com',
        },
      },
    };
    const result = convertYamlProxyToObject(proxy);
    expect(result).toMatchSnapshot();
  });

  it('should convert a trojan proxy object to IR', () => {
    const proxy = {
      name: 'trojan-node',
      type: 'trojan',
      server: 'example.com',
      port: 443,
      password: 'your-password',
      udp: true,
      sni: 'sub.example.com',
      'skip-cert-verify': false,
    };
    const result = convertYamlProxyToObject(proxy);
    expect(result).toMatchSnapshot();
  });

  it('should convert a shadowsocks proxy object to IR', () => {
    const proxy = {
      name: 'ss-node',
      type: 'ss',
      server: 'example.com',
      port: 8080,
      cipher: 'aes-256-gcm',
      password: 'your-password',
    };
    const result = convertYamlProxyToObject(proxy);
    expect(result).toMatchSnapshot();
  });

  it('should convert a hysteria2 proxy object to IR', () => {
    const proxy = {
      name: 'hy2-node',
      type: 'hysteria2',
      server: 'example.com',
      port: 443,
      password: 'your-password',
      sni: 'sub.example.com',
      'skip-cert-verify': false,
      up: '100',
      down: '500',
    };
    const result = convertYamlProxyToObject(proxy);
    expect(result).toMatchSnapshot();
  });

  it('should convert an http proxy object to IR', () => {
    const proxy = {
      name: 'http-proxy',
      type: 'http',
      server: 'proxy.example.com',
      port: 8080,
      username: 'user',
      password: 'password',
    };
    const result = convertYamlProxyToObject(proxy);
    expect(result).toMatchSnapshot();
  });

  it('should return null for invalid proxy object', () => {
    const proxy = { name: 'invalid' };
    const result = convertYamlProxyToObject(proxy);
    expect(result).toBeNull();
  });
});