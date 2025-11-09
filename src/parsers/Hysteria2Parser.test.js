import { describe, it, expect } from 'vitest';
import { Hysteria2Parser } from './Hysteria2Parser.js';

describe('Hysteria2Parser', () => {
  const parser = new Hysteria2Parser();

  it('should parse a typical hysteria2 URL', () => {
    const url = 'hysteria2://password@example.com:443#MyHysteria2Node';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });

  it('should parse a hysteria2 URL with params', () => {
    const url = 'hysteria2://password@example.com:443?sni=sub.example.com&obfs=salamander&obfs-password=obfspwd#MyHysteria2ObfsNode';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });
});