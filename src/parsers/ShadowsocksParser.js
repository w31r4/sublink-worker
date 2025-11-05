import { base64ToBinary } from '../utils.js';

export class ShadowsocksParser {
  canParse(url) {
    return url.startsWith('ss://');
  }

  parse(url) {
    try {
      let parts = url.replace('ss://', '').split('#');
      let mainPart = parts[0];
      let tag = parts[1];
      if (tag && tag.includes('%')) {
        tag = decodeURIComponent(tag);
      }

      // Try new format first
      try {
        let [base64, serverPart] = mainPart.split('@');
        // If no @ symbol found, try legacy format
        if (!serverPart) {
          // Decode the entire mainPart for legacy format
          let decodedLegacy = base64ToBinary(mainPart);
          // Legacy format: method:password@server:port
          let [methodAndPass, serverInfo] = decodedLegacy.split('@');
          let [method, password] = methodAndPass.split(':');
          let [server, server_port] = this.parseServer(serverInfo);
          
          return this.createConfig(tag, server, server_port, method, password);
        }

        // Continue with new format parsing
        let decodedParts = base64ToBinary(decodeURIComponent(base64)).split(':');
        let method = decodedParts[0];
        let password = decodedParts.slice(1).join(':');
        let [server, server_port] = this.parseServer(serverPart);

        return this.createConfig(tag, server, server_port, method, password);
      } catch (e) {
        console.error('Failed to parse shadowsocks URL:', e);
        return null;
      }
    } catch (e) {
      console.error('Failed to parse shadowsocks URL:', e);
      return null;
    }
  }

  // Helper method to parse server info
  parseServer(serverPart) {
    // Match IPv6 address
    let match = serverPart.match(/\[([^\]]+)\]:(\d+)/);
    if (match) {
      return [match[1], match[2]];
    }
    return serverPart.split(':');
  }

  // Helper method to create config object
  createConfig(tag, server, server_port, method, password) {
    return {
      "tag": tag || "Shadowsocks",
      "type": 'shadowsocks',
      "server": server,
      "server_port": parseInt(server_port),
      "method": method,
      "password": password,
      "network": 'tcp',
      "tcp_fast_open": false
    };
  }
}