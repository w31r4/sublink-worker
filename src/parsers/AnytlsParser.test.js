import { describe, it, expect } from 'vitest';
import { AnytlsParser } from './AnytlsParser.js';

describe('AnytlsParser', () => {
  const parser = new AnytlsParser();

  it('should parse a typical anytls URL', () => {
    const url = 'anytls://password@example.com:443?sni=sub.example.com&udp=true#MyAnytlsNode';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });

  it('should parse an anytls URL with utls enabled', () => {
    const url = 'anytls://password@example.com:443?sni=sub.example.com&client-fingerprint=chrome#MyAnytlsNodeWithUtls';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });

  it('should parse an anytls URL with insecure tls', () => {
    const url = 'anytls://password@example.com:443?skip-cert-verify=true#MyAnytlsNodeInsecure';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });

  it('should parse an anytls URL with alpn', () => {
    const url = 'anytls://password@example.com:443?alpn=h2,http/1.1#MyAnytlsNodeWithAlpn';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });
});