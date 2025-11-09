export function parseServerInfo(serverInfo) {
	let host, port;
	if (serverInfo.startsWith('[')) {
	  const closeBracketIndex = serverInfo.indexOf(']');
	  host = serverInfo.slice(1, closeBracketIndex);
	  port = serverInfo.slice(closeBracketIndex + 2); // +2 to skip ']:'
	} else {
	  const lastColonIndex = serverInfo.lastIndexOf(':');
	  host = serverInfo.slice(0, lastColonIndex);
	  port = serverInfo.slice(lastColonIndex + 1);
	}
	return { host, port: parseInt(port) };
  }
  
  export function parseUrlParams(url) {
	const [, rest] = url.split('://');
	const [beforeFragment, ...fragmentParts] = rest.split('#');
	const [addressPart, ...paramsParts] = beforeFragment.split('?');
	const paramsPart = paramsParts.join('?');
	 
	const paramsOnly = paramsPart;
	const searchParams = new URLSearchParams(paramsOnly);
	const params = Object.fromEntries(searchParams.entries());

	let name = fragmentParts.length > 0 ? fragmentParts.join('#') : '';
	try {
	    name = decodeURIComponent(name);
	} catch (error) { };
	
	return { addressPart, params, name };
  }
  
  export function createTlsConfig(params) {
	let tls = { enabled: false };
	if (params.security != 'none') {
	  tls = {
		enabled: true,
		server_name: params.sni || params.host,
		insecure: !!params?.allowInsecure || !!params?.insecure || !!params?.allow_insecure,
		// utls: {
		//   enabled: true,
		//   fingerprint: "chrome"
		// },
	  };
	  if (params.security === 'reality') {
		tls.reality = {
		  enabled: true,
		  public_key: params.pbk,
		  short_id: params.sid,
		};
	  }
	}
	return tls;
  }

export function createTransportConfig(params) {
	return {
		type: params.type,
		path: params.path ?? undefined,
		...(params.host && {'headers': {'host': params.host}}),
		...(params.type === 'grpc' && {
			service_name: params.serviceName ?? undefined,
		})
	};
}