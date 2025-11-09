const PATH_LENGTH = 7;

// 自定义的字符串前缀检查函数
export function checkStartsWith(str, prefix) {
  if (str === undefined || str === null || prefix === undefined || prefix === null) {
    return false;
  }
  str = String(str);
  prefix = String(prefix);
  return str.slice(0, prefix.length) === prefix;
}


// Base64 编码函数 (使用原生 btoa)
export function encodeBase64(input) {
	// 首先将字符串通过 TextEncoder 转为 UTF-8 编码的字节，然后将每个字节转为字符
	const utf8Bytes = new TextEncoder().encode(input);
	const binaryString = String.fromCodePoint(...utf8Bytes);
	return btoa(binaryString);
}

// Base64 解码函数 (使用原生 atob)
export function decodeBase64(input) {
	try {
		const binaryString = atob(input);
		// 将解码后的二进制字符串的每个字符的 char code 作为字节，构建 Uint8Array
		const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
		// 使用 TextDecoder 将 UTF-8 字节解码回字符串
		return new TextDecoder().decode(bytes);
	} catch (e) {
		// 如果 atob 失败 (例如，无效的 base64 字符串), 返回原始输入或根据需要处理错误
		console.error("Base64 decoding failed:", e);
		return input;
	}
}

// 兼容旧代码的存根，稍后将被完全移除
export function base64ToBinary(base64String) {
	try {
		return atob(base64String);
	} catch (e) {
		console.error("base64ToBinary failed:", e);
		return "";
	}
}

// 兼容旧代码的存根，稍后将被完全移除
export function base64FromBinary(binaryString) {
	try {
		return btoa(binaryString);
	} catch (e) {
		console.error("base64FromBinary failed:", e);
		return "";
	}
}

export function tryDecodeSubscriptionLines(input, { decodeUriComponent = false } = {}) {
	if (typeof input !== 'string') {
		return input;
	}

	const trimmed = input.trim();
	if (trimmed === '') {
		return trimmed;
	}

	const splitIfMultiple = (value) => {
		if (typeof value !== 'string') {
			return value;
		}

		const normalized = value.replace(/\r\n/g, '\n');
		const segments = normalized
			.split('\n')
			.map(segment => segment.trim())
			.filter(segment => segment !== '');

		if (segments.length > 1 && segments.some(segment => segment.includes('://'))) {
			return segments;
		}

		return normalized.trim();
	};

	const directResult = splitIfMultiple(trimmed);
	if (Array.isArray(directResult)) {
		return directResult;
	}
	if (typeof directResult === 'string' && directResult.includes('://')) {
		return directResult;
	}

	try {
		let decoded = decodeBase64(trimmed);
		if (decodeUriComponent && decoded.includes('%')) {
			const hasProtocolScheme = decoded.includes('://');
			if (!hasProtocolScheme) {
				try {
					decoded = decodeURIComponent(decoded);
				} catch (_) {
					// ignore URI decode errors and fall back to the decoded string
				}
			}
		}

		const decodedResult = splitIfMultiple(decoded);
		if (Array.isArray(decodedResult)) {
			return decodedResult;
		}
		if (typeof decodedResult === 'string' && decodedResult.includes('://')) {
			return decodedResult;
		}
	} catch (_) {
		// ignore decoding errors and return the original trimmed input
	}

	return trimmed;
}
export function DeepCopy(obj) {
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}
	if (Array.isArray(obj)) {
		return obj.map(item => DeepCopy(item));
	}
	const newObj = {};
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			newObj[key] = DeepCopy(obj[key]);
		}
	}
	return newObj;
}

export function GenerateWebPath(length = PATH_LENGTH) {
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	let result = ''
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length))
	}
	return result
}


// Parse boolean value from various formats
export function parseBool(value, fallback = undefined) {
	if (value === undefined || value === null) return fallback;
	if (typeof value === 'boolean') return value;
	const lowered = String(value).toLowerCase();
	if (lowered === 'true' || lowered === '1') return true;
	if (lowered === 'false' || lowered === '0') return false;
	return fallback;
}

// Parse number value safely
export function parseMaybeNumber(value) {
	if (value === undefined || value === null) return undefined;
	const num = Number(value);
	return Number.isNaN(num) ? undefined : num;
}

// Parse comma-separated string to array
export function parseArray(value) {
	if (!value) return undefined;
	if (Array.isArray(value)) return value;
	return String(value)
		.split(',')
		.map(entry => entry.trim())
		.filter(entry => entry.length > 0);
}

export function parseCountryFromNodeName(nodeName) {
        const countryData = {
            'HK': { name: 'Hong Kong', emoji: '🇭🇰', aliases: ['香港', 'Hong Kong', 'HK'] },
            'TW': { name: 'Taiwan', emoji: '🇹🇼', aliases: ['台湾', 'Taiwan', 'TW'] },
            'JP': { name: 'Japan', emoji: '🇯🇵', aliases: ['日本', 'Japan', 'JP'] },
            'KR': { name: 'Korea', emoji: '🇰🇷', aliases: ['韩国', 'Korea', 'KR'] },
            'SG': { name: 'Singapore', emoji: '🇸🇬', aliases: ['新加坡', 'Singapore', 'SG'] },
            'US': { name: 'United States', emoji: '🇺🇸', aliases: ['美国', 'United States', 'US'] },
            'GB': { name: 'United Kingdom', emoji: '🇬🇧', aliases: ['英国', 'United Kingdom', 'UK', 'GB'] },
            'DE': { name: 'Germany', emoji: '🇩🇪', aliases: ['德国', 'Germany'] },
            'FR': { name: 'France', emoji: '🇫🇷', aliases: ['法国', 'France'] },
            'RU': { name: 'Russia', emoji: '🇷🇺', aliases: ['俄罗斯', 'Russia'] },
            'CA': { name: 'Canada', emoji: '🇨🇦', aliases: ['加拿大', 'Canada'] },
            'AU': { name: 'Australia', emoji: '🇦🇺', aliases: ['澳大利亚', 'Australia'] },
		'IN': { name: 'India', emoji: '🇮🇳', aliases: ['印度', 'India'] },
		'BR': { name: 'Brazil', emoji: '🇧🇷', aliases: ['巴西', 'Brazil'] },
		'ZA': { name: 'South Africa', emoji: '🇿🇦', aliases: ['南非', 'South Africa'] },
		'AR': { name: 'Argentina', emoji: '🇦🇷', aliases: ['阿根廷', 'Argentina'] },
		'TR': { name: 'Turkey', emoji: '🇹🇷', aliases: ['土耳其', 'Turkey'] },
		'NL': { name: 'Netherlands', emoji: '🇳🇱', aliases: ['荷兰', 'Netherlands'] },
		'CH': { name: 'Switzerland', emoji: '🇨🇭', aliases: ['瑞士', 'Switzerland'] },
		'SE': { name: 'Sweden', emoji: '🇸🇪', aliases: ['瑞典', 'Sweden'] },
		'IT': { name: 'Italy', emoji: '🇮🇹', aliases: ['意大利', 'Italy'] },
		'ES': { name: 'Spain', emoji: '🇪🇸', aliases: ['西班牙', 'Spain'] },
		'IE': { name: 'Ireland', emoji: '🇮🇪', aliases: ['爱尔兰', 'Ireland'] },
		'MY': { name: 'Malaysia', emoji: '🇲🇾', aliases: ['马来西亚', 'Malaysia'] },
		'TH': { name: 'Thailand', emoji: '🇹🇭', aliases: ['泰国', 'Thailand'] },
		'VN': { name: 'Vietnam', emoji: '🇻🇳', aliases: ['越南', 'Vietnam'] },
		'PH': { name: 'Philippines', emoji: '🇵🇭', aliases: ['菲律宾', 'Philippines'] },
		'ID': { name: 'Indonesia', emoji: '🇮🇩', aliases: ['印度尼西亚', 'Indonesia'] },
		'NZ': { name: 'New Zealand', emoji: '🇳🇿', aliases: ['新西兰', 'New Zealand'] },
		'AE': { name: 'United Arab Emirates', emoji: '🇦🇪', aliases: ['阿联酋', 'United Arab Emirates'] },
	};

	const allAliases = Object.values(countryData).flatMap(c => c.aliases);
	const regex = new RegExp(allAliases.map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|'), 'i');
	const match = nodeName.match(regex);

	if (match) {
		const matchedAlias = match[0];
		for (const code in countryData) {
			if (countryData[code].aliases.some(alias => alias.toLowerCase() === matchedAlias.toLowerCase())) {
				return { code, ...countryData[code] };
			}
		}
	}

	return null;
}
