import { describe, it, expect } from 'vitest';
import { XrayConfigBuilder } from './XrayConfigBuilder.js';

const VMESS_URL =
  'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJ2bWVzcy13cy10bHMiLAogICJhZGQiOiAiY2xvdWRmbGFyZS5jb20iLAogICJwb3J0IjogNDQzLAogICJpZCI6ICJ5b3VyLXV1aWQiLAogICJhaWQiOiAwLAogICJuZXQiOiAid3MiLAogICJ0eXBlIjogIm5vbmUiLAogICJob3N0IjogInNlcnZlci5jb20iLAogICJwYXRoIjogIi9wYXRoIiwKICAidGxzIjogInRscyIKfQ==';

describe('XrayConfigBuilder', () => {
  it('routes to first proxy instead of DIRECT by default', async () => {
    const builder = new XrayConfigBuilder(VMESS_URL, ['Global'], [], null, 'en', 'test-agent', false);
    const built = await builder.build();

    const vmessOutbound = (built.outbounds || []).find(o => o?.protocol === 'vmess');
    expect(vmessOutbound?.tag).toBeTruthy();

    const lastRule = (built.routing?.rules || []).at(-1);
    expect(lastRule?.outboundTag).toBe(vmessOutbound.tag);
    expect(lastRule?.outboundTag).not.toBe('DIRECT');
  });

  it('uses balancerTag when use_balancer is enabled', async () => {
    const builder = new XrayConfigBuilder(VMESS_URL, ['Global'], [], null, 'en', 'test-agent', false, { useBalancer: true });
    const built = await builder.build();

    expect((built.routing?.balancers || []).some(b => b?.tag === 'auto_select')).toBe(true);

    const lastRule = (built.routing?.rules || []).at(-1);
    expect(lastRule?.balancerTag).toBe('auto_select');
    expect(lastRule?.outboundTag).toBeUndefined();
  });
});

