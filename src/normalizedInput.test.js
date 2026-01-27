import { describe, expect, it } from 'vitest';
import { SingboxConfigBuilder } from './SingboxConfigBuilder.js';

function buildNormalizedConfig(nodes) {
  return JSON.stringify({ version: '1.0.0', nodes });
}

describe('Normalized input object {version,nodes}', () => {
  it('should accept a minimal vless node and build sing-box config', async () => {
    const input = buildNormalizedConfig([
      {
        kind: 'vless',
        host: 'example.com',
        port: 443,
        tag: 'test-vless',
        uuid: '11111111-1111-1111-1111-111111111111',
        tls: { enabled: true, server_name: 'example.com' },
      },
    ]);

    const builder = new SingboxConfigBuilder(input, ['Global'], [], null, 'en', 'test-agent', false);
    const config = await builder.build();

    expect(config).toBeTruthy();
    expect(config.outbounds).toBeTruthy();
    const out = config.outbounds.find(o => o.tag === 'test-vless');
    expect(out).toBeTruthy();
    expect(out.type).toBe('vless');
    expect(out.server).toBe('example.com');
    expect(out.server_port).toBe(443);
  });

  it('should reject nodes missing required fields with a clear error', async () => {
    const input = buildNormalizedConfig([
      {
        kind: 'vless',
        port: 443,
        tag: 'bad-node',
        uuid: '11111111-1111-1111-1111-111111111111',
      },
    ]);

    const builder = new SingboxConfigBuilder(input, ['Global'], [], null, 'en', 'test-agent', false);
    await expect(builder.build()).rejects.toThrow(/nodes\[0\]\.host/);
  });
});
