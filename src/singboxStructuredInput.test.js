import { describe, expect, it } from 'vitest';
import { SingboxConfigBuilder } from './SingboxConfigBuilder.js';

function buildSingboxConfig(outbounds) {
  return JSON.stringify({
    log: { level: 'info' },
    outbounds,
  });
}

describe('Structured sing-box config input (outbounds extraction)', () => {
  it('should extract real node outbounds and ignore policy outbounds', async () => {
    const input = buildSingboxConfig([
      { type: 'direct', tag: 'DIRECT' },
      { type: 'selector', tag: 'AUTO', outbounds: ['a', 'b'] },
      {
        type: 'vless',
        tag: 'sb-vless',
        server: 'example.com',
        server_port: 443,
        uuid: '11111111-1111-1111-1111-111111111111',
        tls: { enabled: true, server_name: 'example.com' },
      },
    ]);

    const builder = new SingboxConfigBuilder(input, ['Global'], [], null, 'en', 'test-agent', false);
    const config = await builder.build();

    const out = config.outbounds.find(o => o.tag === 'sb-vless');
    expect(out).toBeTruthy();
    expect(out.type).toBe('vless');
  });
});
