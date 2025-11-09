import { describe, it, expect } from 'vitest';
import { SingboxConfigBuilder } from './SingboxConfigBuilder.js';

describe('SingboxConfigBuilder', () => {
  it('should perform an end-to-end conversion of mixed proxies', async () => {
    const input = [
      'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJ2bWVzcy13cy10bHMiLAogICJhZGQiOiAiY2xvdWRmbGFyZS5jb20iLAogICJwb3J0IjogNDQzLAogICJpZCI6ICJ5b3VyLXV1aWQiLAogICJhaWQiOiAwLAogICJuZXQiOiAid3MiLAogICJ0eXBlIjogIm5vbmUiLAogICJob3N0IjogInNlcnZlci5jb20iLAogICJwYXRoIjogIi9wYXRoIiwKICAidGxzIjogInRscyIKfQ==',
      'trojan://password@example.com:443#trojan-node'
    ].join('\n');

    const builder = new SingboxConfigBuilder(input, ['Global'], [], undefined, 'en', 'test-agent', false);
    await builder.build();
    const result = builder.formatConfig();

    expect(result).toMatchSnapshot();
  });

  it('should group proxies by country when groupByCountry is true', async () => {
    const input = [
      'ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ=@1.1.1.1:8888#🇺🇸 US Node',
      'ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ=@8.8.8.8:8888#🇬🇧 UK Node'
    ].join('\n');

    const builder = new SingboxConfigBuilder(input, ['Global'], [], undefined, 'en', 'test-agent', true);
    await builder.build();
    const result = builder.formatConfig();

    expect(result).toMatchSnapshot();
  });
});