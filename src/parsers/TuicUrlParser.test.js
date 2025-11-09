import { describe, it, expect } from 'vitest';
import { TuicParser } from './TuicUrlParser.js';

describe('TuicParser', () => {
  const parser = new TuicParser();

  it('should parse a typical tuic URL', () => {
    const url = 'tuic://a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6:password@example.com:443#MyTuicNode';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });

  it('should parse a tuic URL with params', () => {
    const url = 'tuic://a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6:password@example.com:443?sni=sub.example.com&congestion_control=bbr&udp_relay_mode=native#MyTuicBbrNode';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });
});