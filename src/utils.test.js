import { describe, it, expect } from 'vitest';
import { encodeBase64, decodeBase64, tryDecodeSubscriptionLines, base64ToBinary, base64FromBinary } from './utils.js';

describe('utils.js', () => {
  describe('Base64 encoding/decoding', () => {
    it('should encode and decode a simple ASCII string correctly', () => {
      const original = 'hello world';
      const encoded = encodeBase64(original);
      const decoded = decodeBase64(encoded);
      expect(encoded).toBe('aGVsbG8gd29ybGQ=');
      expect(decoded).toBe(original);
    });

    it('should encode and decode a string with UTF-8 characters', () => {
      const original = '你好，世界';
      const encoded = encodeBase64(original);
      const decoded = decodeBase64(encoded);
      expect(encoded).toBe('5L2g5aW977yM5LiW55WM');
      expect(decoded).toBe(original);
    });

    it('should handle empty string', () => {
        const original = '';
        const encoded = encodeBase64(original);
        const decoded = decodeBase64(encoded);
        expect(encoded).toBe('');
        expect(decoded).toBe('');
    });

    it('should handle large strings without overflowing the stack', () => {
      const original = 'node'.repeat(60000);
      const encoded = encodeBase64(original);
      const decoded = decodeBase64(encoded);
      expect(decoded).toBe(original);
    });
  });

  describe('tryDecodeSubscriptionLines', () => {
    it('should return plain string if it contains a protocol', () => {
      const url = 'vmess://some-random-string';
      expect(tryDecodeSubscriptionLines(url)).toBe(url);
    });

    it('should decode a single base64 encoded string', () => {
      const original = 'ss://aes-128-gcm:password@example.com:8080#test';
      const encoded = encodeBase64(original);
      expect(tryDecodeSubscriptionLines(encoded)).toBe(original);
    });

    it('should decode and split multiple lines of base64 encoded strings', () => {
      const original1 = 'ss://...line1';
      const original2 = 'trojan://...line2';
      const content = `${original1}\n${original2}`;
      const encoded = encodeBase64(content);
      expect(tryDecodeSubscriptionLines(encoded)).toEqual([original1, original2]);
    });

    it('should handle plain multi-line strings with protocols', () => {
        const content = 'ss://...line1\ntrojan://...line2\n';
        expect(tryDecodeSubscriptionLines(content)).toEqual(['ss://...line1', 'trojan://...line2']);
    });

    it('should return original string if base64 decoding fails', () => {
        const invalidBase64 = 'this is not base64';
        expect(tryDecodeSubscriptionLines(invalidBase64)).toBe(invalidBase64);
    });
  });
});
