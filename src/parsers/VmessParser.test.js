import { describe, it, expect } from 'vitest';
import { VmessParser } from './VmessParser.js';

describe('VmessParser', () => {
  const parser = new VmessParser();

  it('should parse a typical vmess URL', () => {
    const config = {
      "v": "2",
      "ps": "MyVmessNode",
      "add": "example.com",
      "port": "443",
      "id": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
      "aid": "64",
      "net": "ws",
      "type": "none",
      "host": "sub.example.com",
      "path": "/ws-path",
      "tls": "tls",
      "sni": "sub.example.com"
    };
    const url = 'vmess://' + btoa(JSON.stringify(config));
    const result = parser.parse(url);

    expect(result.tag).toBe('MyVmessNode');
    expect(result.server).toBe('example.com');
    expect(result.server_port).toBe(443);
    expect(result.uuid).toBe('a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6');
    expect(result.alter_id).toBe(64);
    expect(result.network).toBe('ws');
    expect(result.transport.type).toBe('ws');
    expect(result.transport.path).toBe('/ws-path');
    expect(result.transport.headers.Host).toBe('sub.example.com');
    expect(result.tls.enabled).toBe(true);
    expect(result.tls.server_name).toBe('sub.example.com');
  });

  it('should parse a vmess URL with a tag override', () => {
    const config = {
      "ps": "OriginalName",
      "add": "1.2.3.4",
      "port": "80",
      "id": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
      "aid": "0",
      "net": "tcp"
    };
    const url = 'vmess://' + btoa(JSON.stringify(config)) + '#NewName';
    const result = parser.parse(url);

    expect(result.tag).toBe('NewName');
  });

  it('should handle http transport type', () => {
    const config = {
        "ps": "http-node",
        "add": "example.com",
        "port": "8080",
        "id": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
        "aid": "0",
        "net": "tcp",
        "type": "http",
        "host": "example.com",
        "path": "/"
    };
    const url = 'vmess://' + btoa(JSON.stringify(config));
    const result = parser.parse(url);

    expect(result.network).toBe('http');
    expect(result.transport.type).toBe('http');
    expect(result.transport.method).toBe('GET');
  });
});