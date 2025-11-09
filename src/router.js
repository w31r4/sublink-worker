export class Router {
  constructor() {
    this.routes = [];
  }

  on(method, path, handler) {
    const paramNames = [];
    const pattern = path.replace(/:([A-Za-z0-9_]+)(\([^/]+\))?/g, (_, name, customPattern) => {
      paramNames.push(name);
      return customPattern ? customPattern : '([^/]+)';
    });
    const regex = new RegExp(`^${pattern}$`);
    this.routes.push({ method, regex, handler, paramNames });
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
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });
        return await route.handler({ request, url, params });
      }
    }
    return new Response('Not Found', { status: 404 });
  }
}
