import { describe, it, expect, vi } from 'vitest';
import { Router } from './router.js';

describe('Router', () => {
  it('matches constrained params and exposes captures', async () => {
    const router = new Router();
    const handler = vi.fn(async ({ params }) => new Response(JSON.stringify(params)));
    router.on('GET', '/:type(b|c|x|s)/:shortCode', handler);

    const request = new Request('https://example.com/b/abc123', { method: 'GET' });
    const response = await router.route(request);
    const data = await response.json();

    expect(handler).toHaveBeenCalledOnce();
    expect(data).toEqual({ type: 'b', shortCode: 'abc123' });
  });

  it('returns 404 when constrained param does not match', async () => {
    const router = new Router();
    const handler = vi.fn(async () => new Response('ok'));
    router.on('GET', '/:type(b|c|x|s)/:shortCode', handler);

    const request = new Request('https://example.com/z/abc123', { method: 'GET' });
    const response = await router.route(request);

    expect(response.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });
});
