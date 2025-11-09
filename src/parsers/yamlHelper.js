import {
   createShadowsocksNode,
   createVmessNode,
   createVlessNode,
   createTrojanNode,
   createHysteria2Node,
   createTuicNode,
   createAnytlsNode,
   createHttpNode
 } from '../ir/factory.js';
 
 export function convertYamlProxyToObject(p) {
   if (!p || typeof p !== 'object' || !p.type) return null;
   const type = String(p.type).toLowerCase();
   const name = p.name || p.tag || 'proxy';
   const tags = name ? [name] : [];
 
   const toArray = (value) => {
     if (value === undefined || value === null) return undefined;
     return Array.isArray(value) ? value : [value];
   };
 
   const getTransport = () => {
     const net = p.network || p['network-type'];
     if (net === 'ws') {
       const w = p['ws-opts'] || {};
       return { type: 'ws', path: w.path, headers: w.headers };
     }
     if (net === 'grpc') {
       const g = p['grpc-opts'] || {};
       return { type: 'grpc', service_name: g['grpc-service-name'] };
     }
     if (net === 'http') {
       const h = p['http-opts'] || {};
       return { type: 'http', method: h.method || 'GET', path: h.path, headers: h.headers };
     }
     if (net === 'h2') {
       const h2 = p['h2-opts'] || {};
       return { type: 'h2', path: h2.path, host: h2.host };
     }
     return undefined;
   };
 
  const getTls = () => {
    const hasTls =
      p.tls ||
      p.security === 'tls' ||
      p.security === 'reality' ||
      p['reality-opts'] ||
      p['client-fingerprint'];
    if (!hasTls) return undefined;
    const reality = p['reality-opts'];
    const tls = {
      enabled: true,
      sni: p.servername || p.sni || p.server,
      server_name: p.servername || p.sni || p.server,
      insecure: !!p['skip-cert-verify'],
      alpn: toArray(p.alpn),
    };
    if (reality) {
      tls.reality = {
        enabled: true,
        publicKey: reality['public-key'],
        public_key: reality['public-key'],
        shortId: reality['short-id'],
        short_id: reality['short-id'],
      };
    }
    if (p['client-fingerprint']) {
      tls.utls = {
        fingerprint: p['client-fingerprint'],
      };
    }
    return tls;
  };
 
   const common = {
     host: p.server,
     port: p.port,
     tags,
     udp: p.udp,
     network: p.network,
     transport: getTransport(),
     tls: getTls(),
   };
 
   switch (type) {
     case 'ss':
     case 'shadowsocks':
       return createShadowsocksNode({
         ...common,
         method: p.cipher || p.method,
         password: p.password,
       });
     case 'vmess':
       return createVmessNode({
         ...common,
         uuid: p.uuid,
         alter_id: p.alterId,
         security: p.cipher || p.security || 'auto',
       });
    case 'vless':
      return createVlessNode({
        ...common,
        uuid: p.uuid,
        flow: p.flow,
        packet_encoding: p['packet-encoding'],
      });
     case 'trojan':
       return createTrojanNode({
         ...common,
         password: p.password,
         flow: p.flow,
       });
    case 'hysteria2':
    case 'hysteria':
    case 'hy2': {
      const obfs = p.obfs ? { type: p.obfs, password: p['obfs-password'] } : undefined;
      const hopInterval = typeof p['hop-interval'] !== 'undefined' ? Number(p['hop-interval']) : undefined;
      const tls = {
        enabled: true,
        sni: p.sni || p.server,
        server_name: p.sni || p.server,
        insecure: !!p['skip-cert-verify'],
        alpn: toArray(p.alpn),
      };
      return createHysteria2Node({
        ...common,
        password: p.password,
        tls,
        obfs,
        auth: p.auth,
        up: p.up,
        down: p.down,
        recv_window_conn: p['recv-window-conn'],
        ports: p.ports,
        hop_interval: hopInterval,
        fast_open: typeof p['fast-open'] !== 'undefined' ? !!p['fast-open'] : undefined,
        alpn: toArray(p.alpn),
      });
    }
    case 'tuic':
      return createTuicNode({
        ...common,
        tls: {
          enabled: true,
          sni: p.sni || p.server,
          server_name: p.sni || p.server,
          insecure: !!p['skip-cert-verify'],
          alpn: toArray(p.alpn),
        },
        uuid: p.uuid,
        password: p.password,
        congestion_control: p['congestion-controller'] || p.congestion_control,
        udp_relay_mode: p['udp-relay-mode'],
        zero_rtt: p['zero-rtt'],
         reduce_rtt: p['reduce-rtt'],
         fast_open: p['fast-open'],
         disable_sni: p['disable-sni'],
       });
    case 'anytls':
      return createAnytlsNode({
        ...common,
        tls: {
          enabled: true,
          sni: p.sni || p.server,
          server_name: p.sni || p.server,
          insecure: !!p['skip-cert-verify'],
          alpn: toArray(p.alpn),
          utls: p['client-fingerprint'] ? { fingerprint: p['client-fingerprint'] } : undefined,
        },
        password: p.password,
        'idle-session-check-interval': p['idle-session-check-interval'],
        'idle-session-timeout': p['idle-session-timeout'],
        'min-idle-session': p['min-idle-session'],
        idle_session_check_interval: p['idle-session-check-interval'],
        idle_session_timeout: p['idle-session-timeout'],
        min_idle_session: p['min-idle-session'],
      });
     case 'http':
     case 'https':
       return createHttpNode({
         ...common,
         kind: type,
         username: p.username,
         password: p.password,
       });
     default:
       return null;
   }
 }
