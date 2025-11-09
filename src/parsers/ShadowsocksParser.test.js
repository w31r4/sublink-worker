import { describe, it, expect } from 'vitest';
import { ShadowsocksParser } from './ShadowsocksParser.js';

describe('ShadowsocksParser', () => {
  const parser = new ShadowsocksParser();

  it('should parse a modern shadowsocks URL', () => {
    const url = 'ss://YWVzLTI1Ni1nY206dGVzdHBhc3N3b3Jk@example.com:8080#MyShadowsocksNode';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });

  it('should parse a legacy shadowsocks URL', () => {
    const url = 'ss://YWVzLTI1Ni1nY206dGVzdHBhc3N3b3JkQGV4YW1wbGUuY29tOjgwODA=#MyLegacyNode';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });
});