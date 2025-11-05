import { VmessParser } from './VmessParser.js';
import { ShadowsocksParser } from './ShadowsocksParser.js';
import { TrojanParser } from './TrojanParser.js';

// This is our parser chain.
// We will add more parsers here as we migrate them.
const parsers = [
  new VmessParser(),
  new ShadowsocksParser(),
  new TrojanParser(),
];

/**
 * Parses a given URL by trying a chain of registered parsers.
 * @param {string} url The URL or content to parse.
 * @returns {object|null} The parsed proxy object, or null if no parser can handle the input.
 */
export function parse(url) {
  if (typeof url !== 'string' || !url.trim()) {
    return null;
  }

  const trimmedUrl = url.trim();

  for (const parser of parsers) {
    if (parser.canParse(trimmedUrl)) {
      return parser.parse(trimmedUrl);
    }
  }

  // If no parser in the chain can handle the URL, we return null.
  // We will later integrate the remaining old parsers here as a fallback.
  return null;
}