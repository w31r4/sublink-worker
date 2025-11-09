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

    expect(result).toMatchSnapshot();
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

    expect(result).toMatchSnapshot();
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

    expect(result).toMatchSnapshot();
  });
});