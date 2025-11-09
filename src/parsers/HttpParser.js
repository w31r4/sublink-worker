import yaml from 'js-yaml';
import { decodeBase64, DeepCopy } from '../utils.js';
import { convertYamlProxyToObject } from '../ProxyParsers.js';

export class HttpParser {
  canParse(url) {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  async parse(url, userAgent) {
    try {
      let headers = new Headers({ 'User-Agent': userAgent || 'curl/7.74.0' });
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      let decodedText;
      try {
        decodedText = decodeBase64(text.trim());
        if (decodedText.includes('%')) {
          decodedText = decodeURIComponent(decodedText);
        }
      } catch (e) {
        decodedText = text;
        if (decodedText.includes('%')) {
          try {
            decodedText = decodeURIComponent(decodedText);
          } catch (_) {}
        }
      }

      // Try YAML first
      try {
        const parsed = yaml.load(decodedText);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.proxies)) {
          const proxies = parsed.proxies
            .map(p => convertYamlProxyToObject(p))
            .filter(p => p != null);
          if (proxies.length > 0) {
            const configOverrides = DeepCopy(parsed);
            delete configOverrides.proxies;
            return {
              type: 'yamlConfig',
              proxies,
              config: Object.keys(configOverrides).length > 0 ? configOverrides : null
            };
          }
        }
      } catch (_) {
        // not YAML
      }

      // Fallback to split lines
      return decodedText.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
      console.error('Error fetching or parsing HTTP(S) content:', error);
      return null;
    }
  }
}

