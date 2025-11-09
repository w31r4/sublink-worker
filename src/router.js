export class Router {
  constructor() {
    this.routes = [];
  }

  on(method, path, handler) {
    const regex = new RegExp(`^${path.replace(/:\w+/g, '([^/]+)')}$`);
    this.routes.push({ method, path, regex, handler });
    return this;
  }

  async route(request) {
    const url = new URL(request.url);
    for (const route of this.routes) {
      if (request.method !== route.method) {
        continue;
      }
      const match = url.pathname.match(route.regex);
      if (match) {
        const params = {};
        const keys = (route.path.match(/:\w+/g) || []).map(key => key.substring(1));
        keys.forEach((key, i) => {
          params[key] = match[i + 1];
        });
        return await route.handler({ request, url, params });
      }
    }
    return new Response('Not Found', { status: 404 });
  }
}