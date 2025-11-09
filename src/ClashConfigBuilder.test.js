import { describe, it, expect } from 'vitest';
import { ClashConfigBuilder } from './ClashConfigBuilder.js';

describe('ClashConfigBuilder', () => {
  it('should perform an end-to-end conversion of mixed proxies', async () => {
    const input = [
      'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJ2bWVzcy13cy10bHMiLAogICJhZGQiOiAiY2xvdWRmbGFyZS5jb20iLAogICJwb3J0IjogNDQzLAogICJpZCI6ICJ5b3VyLXV1aWQiLAogICJhaWQiOiAwLAogICJuZXQiOiAid3MiLAogICJ0eXBlIjogIm5vbmUiLAogICJob3N0IjogInNlcnZlci5jb20iLAogICJwYXRoIjogIi9wYXRoIiwKICAidGxzIjogInRscyIKfQ==',
      'trojan://password@example.com:443#trojan-node'
    ].join('\n');

    const builder = new ClashConfigBuilder(input, ['Global'], [], null, 'en', 'test-agent', false);
    await builder.build();
    const result = builder.formatConfig();

    expect(result).toMatchSnapshot();
  });

  it('should group proxies by country when groupByCountry is true', async () => {
    const input = [
      'ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ=@1.1.1.1:8888#🇺🇸 US Node',
      'ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ=@8.8.8.8:8888#🇬🇧 UK Node'
    ].join('\n');

    const builder = new ClashConfigBuilder(input, ['Global'], [], null, 'en', 'test-agent', true);
    await builder.build();
    const result = builder.formatConfig();

    expect(result).toMatchSnapshot();
  });

  it('should parse Clash YAML even when proxies are not the first section', async () => {
    const yamlInput = `
port: 7890
socks-port: 7891
allow-lan: false
mode: rule
log-level: info
proxies:
  - name: HY2-main
    type: hysteria2
    server: example.com
    port: 443
    password: my-password
    sni: assets.example.com
    obfs: salamander
    obfs-password: obfs-pass
    alpn:
      - h3
  - name: TUIC-main
    type: tuic
    server: example.com
    port: 444
    uuid: 11111111-2222-3333-4444-555555555555
    password: another-password
    sni: assets.example.com
proxy-groups:
  - name: Default
    type: select
    proxies:
      - DIRECT
      - HY2-main
rules:
  - MATCH,Default
`.trim();

    const builder = new ClashConfigBuilder(yamlInput, ['Global'], [], null, 'en', 'test-agent', false);
    await builder.build();
    expect(builder.getProxies()).toHaveLength(2);
  });

  it('should fetch and parse remote Clash YAML configs referenced by URL', async () => {
    const yamlInput = `
proxies:
  - name: Remote-HY2
    type: hysteria2
    server: remote.example.com
    port: 443
    password: remote-pass
`;
    const remoteUrl = 'https://example.com/hy2.yaml';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      expect(url).toBe(remoteUrl);
      return new Response(yamlInput, { status: 200 });
    };

    try {
      const builder = new ClashConfigBuilder(remoteUrl, ['Global'], [], null, 'en', 'test-agent', false);
      await builder.build();
      expect(builder.getProxies()).toHaveLength(1);
      expect(builder.getProxies()[0].name).toBe('Remote-HY2');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
