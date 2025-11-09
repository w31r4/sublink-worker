import { t } from './i18n/index.js';

export function sanitize(values = []) {
  const normalize = (s) => (typeof s === 'string' ? s.trim() : s);
  const seen = new Set();
  return (values || [])
    .map(normalize)
    .filter((v) => typeof v === 'string' && v.length > 0)
    .filter((v) => {
      if (seen.has(v)) return false;
      seen.add(v);
      return true;
    });
}

export function baseMembers({ groupByCountry, manualGroupName, countryGroupNames = [], proxyList = [] } = {}) {
  const auto = t('outboundNames.Auto Select');
  if (groupByCountry) {
    return sanitize([auto, ...(manualGroupName ? [manualGroupName] : []), ...(countryGroupNames || [])]);
  }
  return sanitize([auto, ...proxyList]);
}

export function buildNodeSelectMembers(opts = {}) {
  return sanitize(['DIRECT', 'REJECT', ...baseMembers(opts)]);
}

export function buildAggregatedMembers(opts = {}) {
  const nodeSelect = t('outboundNames.Node Select');
  return sanitize(['DIRECT', 'REJECT', nodeSelect, ...baseMembers(opts)]);
}

