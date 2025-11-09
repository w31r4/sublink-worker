import { t } from './i18n/index.js';

// 清理和去重数组中的值
export function sanitize(values = []) {
  // 规范化函数，去除字符串两端空格
  const normalize = (s) => (typeof s === 'string' ? s.trim() : s);
  const seen = new Set();
  return (values || [])
    .map(normalize)
    // 过滤掉非字符串或空字符串
    .filter((v) => typeof v === 'string' && v.length > 0)
    // 去重
    .filter((v) => {
      if (seen.has(v)) return false;
      seen.add(v);
      return true;
    });
}

// 构建基础的出站成员列表
export function baseMembers({ groupByCountry, manualGroupName, countryGroupNames = [], proxyList = [] } = {}) {
  const auto = t('outboundNames.Auto Select');
  // 如果按国家分组，则返回自动选择、手动分组名称和国家分组名称
  if (groupByCountry) {
    return sanitize([auto, ...(manualGroupName ? [manualGroupName] : []), ...(countryGroupNames || [])]);
  }
  // 否则返回自动选择和所有代理节点
  return sanitize([auto, ...proxyList]);
}

// 构建“节点选择”出站的成员列表
export function buildNodeSelectMembers(opts = {}) {
  // 包括直连、拒绝和基础成员
  return sanitize(['DIRECT', 'REJECT', ...baseMembers(opts)]);
}

// 构建聚合类型的出站成员列表（例如 "国外媒体"）
export function buildAggregatedMembers(opts = {}) {
  const nodeSelect = t('outboundNames.Node Select');
  // 包括直连、拒绝、节点选择和基础成员
  return sanitize(['DIRECT', 'REJECT', nodeSelect, ...baseMembers(opts)]);
}

