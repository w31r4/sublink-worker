// 定义一个简单的路由器类
export class Router {
  // 构造函数，初始化路由数组
  constructor() {
    this.routes = [];
  }

  // 注册一个路由规则
  on(method, path, handler) {
    const paramNames = [];
    // 将路径字符串转换为正则表达式，并提取参数名称
    const pattern = path.replace(/:([A-Za-z0-9_]+)(\([^/]+\))?/g, (_, name, customPattern) => {
      paramNames.push(name);
      return customPattern ? customPattern : '([^/]+)';
    });
    const regex = new RegExp(`^${pattern}$`);
    // 将路由信息存入数组
    this.routes.push({ method, regex, handler, paramNames });
    return this; // 支持链式调用
  }

  // 匹配并处理请求
  async route(request) {
    const url = new URL(request.url);
    // 遍历所有已注册的路由
    for (const route of this.routes) {
      // 检查 HTTP 方法是否匹配
      if (request.method !== route.method) {
        continue;
      }
      // 检查路径是否匹配正则表达式
      const match = url.pathname.match(route.regex);
      if (match) {
        const params = {};
        // 提取 URL 中的参数
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });
        // 调用对应的处理函数
        return await route.handler({ request, url, params });
      }
    }
    // 如果没有找到匹配的路由，返回 404
    return new Response('Not Found', { status: 404 });
  }
}
