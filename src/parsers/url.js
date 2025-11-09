// 解析服务器信息字符串（例如 "example.com:443"）
export function parseServerInfo(serverInfo) {
	let host, port;
	// 处理 IPv6 地址格式, e.g., [::1]:443
	if (serverInfo.startsWith('[')) {
	  const closeBracketIndex = serverInfo.indexOf(']');
	  host = serverInfo.slice(1, closeBracketIndex);
	  port = serverInfo.slice(closeBracketIndex + 2); // 跳过 ']:'
	} else {
	  const lastColonIndex = serverInfo.lastIndexOf(':');
	  host = serverInfo.slice(0, lastColonIndex);
	  port = serverInfo.slice(lastColonIndex + 1);
	}
	return { host, port: parseInt(port) };
  }
  
  // 从分享链接中解析出地址、参数和节点名称
  export function parseUrlParams(url) {
	const [, rest] = url.split('://');
	const [beforeFragment, ...fragmentParts] = rest.split('#');
	const [addressPart, ...paramsParts] = beforeFragment.split('?');
	const paramsPart = paramsParts.join('?');
	 
	const paramsOnly = paramsPart;
	const searchParams = new URLSearchParams(paramsOnly);
	const params = Object.fromEntries(searchParams.entries());

	// 节点名称在 '#' 后面
	let name = fragmentParts.length > 0 ? fragmentParts.join('#') : '';
	try {
		// 解码节点名称
	    name = decodeURIComponent(name);
	} catch (error) { };
	
	return { addressPart, params, name };
  }
  
// 根据参数创建 TLS 配置对象
export function createTlsConfig(params) {
	let tls = { enabled: false };
	if (params.security != 'none') {
	  tls = {
		enabled: true,
		server_name: params.sni || params.host,
		sni: params.sni || params.host,
		insecure: !!params?.allowInsecure || !!params?.insecure || !!params?.allow_insecure,
		// utls: {
		//   enabled: true,
		//   fingerprint: "chrome"
		// },
	  };
	  // 处理 REALITY 安全类型
	  if (params.security === 'reality') {
		tls.reality = {
		  enabled: true,
		  public_key: params.pbk,
		  short_id: params.sid,
		};
	  }
	}
	if (!tls.sni && tls.server_name) {
	  tls.sni = tls.server_name;
	}
	return tls;
  }

// 根据参数创建传输配置对象
export function createTransportConfig(params) {
	return {
		type: params.type, // 传输类型, e.g., ws, grpc
		path: params.path ?? undefined,
		...(params.host && {'headers': {'host': params.host}}), // ws-opts
		...(params.type === 'grpc' && { // grpc-opts
			service_name: params.serviceName ?? undefined,
		})
	};
}
