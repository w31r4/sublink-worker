import { describe, it, expect } from 'vitest';
import { TrojanParser } from './TrojanParser.js';

describe('TrojanParser', () => {
  const parser = new TrojanParser();

  it('should parse a typical trojan URL', () => {
    const url = 'trojan://password@example.com:443#MyTrojanNode';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });

  it('should parse a trojan URL with params', () => {
    const url = 'trojan://password@example.com:443?sni=sub.example.com&type=ws&path=/ws-path#MyTrojanWsNode';
    const result = parser.parse(url);
    expect(result).toMatchSnapshot();
  });
});