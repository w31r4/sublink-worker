import { VmessParser } from './VmessParser.js';
import { ShadowsocksParser } from './ShadowsocksParser.js';
import { TrojanParser } from './TrojanParser.js';
import { VlessParser } from './VlessParser.js';
import { Hysteria2Parser } from './Hysteria2Parser.js';
import { TuicParser } from './TuicUrlParser.js';
import { AnytlsParser } from './AnytlsParser.js';
import { HttpParser } from './HttpParser.js';

// This is our parser chain.
// We will add more parsers here as we migrate them.
const parsers = [
  new VmessParser(),
  new ShadowsocksParser(),
  new TrojanParser(),
  new VlessParser(),
  new Hysteria2Parser(),
  new TuicParser(),
  new AnytlsParser(),
  new HttpParser(),
];

/**
 * Parses a given URL by trying a chain of registered parsers.
 * @param {string} url The URL or content to parse.
 * @returns {object|null} The parsed proxy object, or null if no parser can handle the input.
 */
export async function parse(url, userAgent) {
  if (typeof url !== 'string' || !url.trim()) {
    return null;
  }

  const trimmedUrl = url.trim();

  for (const parser of parsers) {
    try {
      if (parser.canParse(trimmedUrl)) {
        const res = parser.parse(trimmedUrl, userAgent);
        // Support async parsers (e.g., HTTP)
        const value = res instanceof Promise ? await res : res;
        if (value != null) return value;
      }
    } catch (e) {
      console.warn('Parser failed:', parser?.constructor?.name, e?.message || e);
    }
  }

  // If no parser in the chain can handle the URL, we return null.
  // We will later integrate the remaining old parsers here as a fallback.
  return null;
}
