import { describe, it, expect } from 'vitest';
import { VlessParser } from './VlessParser.js';

describe('VlessParser', () => {
  const parser = new VlessParser();

  it('should parse a typical vless URL', () => {
    const url = 'vless://a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6@example.com:443#MyVlessNode';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });

  it('should parse a vless URL with params', () => {
    const url = 'vless://a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6@example.com:443?sni=sub.example.com&type=ws&path=/ws-path#MyVlessWsNode';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });
});