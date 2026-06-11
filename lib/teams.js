// ── Team identity: colors keyed by Jolpica constructorId AND OpenF1 team_name ──
export const TEAMS = {
  mercedes:     { name: 'Mercedes',        color: '#00F5D0', dark: '#013830' },
  ferrari:      { name: 'Ferrari',         color: '#FF2B2B', dark: '#3a0606' },
  red_bull:     { name: 'Red Bull',        color: '#4781D7', dark: '#0a1733' },
  mclaren:      { name: 'McLaren',         color: '#FF8000', dark: '#3a1d00' },
  aston_martin: { name: 'Aston Martin',    color: '#229971', dark: '#06281d' },
  alpine:       { name: 'Alpine',          color: '#FF87BC', dark: '#33101f' },
  williams:     { name: 'Williams',        color: '#1868DB', dark: '#071a36' },
  rb:           { name: 'Racing Bulls',    color: '#6C98FF', dark: '#101c3a' },
  sauber:       { name: 'Audi',            color: '#01C00E', dark: '#022e07' },
  audi:         { name: 'Audi',            color: '#01C00E', dark: '#022e07' },
  haas:         { name: 'Haas',            color: '#9C9FA2', dark: '#1e2022' },
  cadillac:     { name: 'Cadillac',        color: '#B8A157', dark: '#2a2410' },
};

// OpenF1 uses display team names — map them onto the same palette
const OPENF1_TEAM_ALIASES = {
  'mercedes': 'mercedes',
  'ferrari': 'ferrari',
  'red bull racing': 'red_bull',
  'red bull': 'red_bull',
  'mclaren': 'mclaren',
  'aston martin': 'aston_martin',
  'alpine': 'alpine',
  'williams': 'williams',
  'racing bulls': 'rb',
  'rb': 'rb',
  'kick sauber': 'sauber',
  'sauber': 'sauber',
  'audi': 'audi',
  'haas f1 team': 'haas',
  'haas': 'haas',
  'cadillac': 'cadillac',
  'cadillac f1 team': 'cadillac',
};

export function teamByConstructorId(id) {
  return TEAMS[id] || { name: id, color: '#8be9fd', dark: '#10222a' };
}

export function teamByOpenF1Name(name, fallbackHex) {
  const key = OPENF1_TEAM_ALIASES[(name || '').toLowerCase()];
  if (key && TEAMS[key]) return TEAMS[key];
  if (fallbackHex) return { name, color: `#${fallbackHex}`, dark: '#10141c' };
  return { name: name || '—', color: '#8be9fd', dark: '#10222a' };
}

// ── Tire compounds ──
export const COMPOUNDS = {
  SOFT:         { code: 'S', color: '#FF3B3B' },
  MEDIUM:       { code: 'M', color: '#FFD12E' },
  HARD:         { code: 'H', color: '#F0F0F0' },
  INTERMEDIATE: { code: 'I', color: '#39D353' },
  WET:          { code: 'W', color: '#2E9BFF' },
  TEST_UNKNOWN: { code: '?', color: '#888888' },
  UNKNOWN:      { code: '?', color: '#888888' },
};

export function compound(c) {
  return COMPOUNDS[(c || 'UNKNOWN').toUpperCase()] || COMPOUNDS.UNKNOWN;
}

// F1 media serves headshots in multiple sizes — OpenF1 links the tiny 93px one.
// '4col' = 432px (cards), '' = 840px original (drawer/hero).
export function hiResHeadshot(url, size = '4col') {
  if (!url) return null;
  if (!url.includes('.transform/')) return url;
  if (!size) return url.replace(/\.transform\/[^/]+\/image\.png$/, '');
  return url.replace(/\.transform\/[^/]+\//, `.transform/${size}/`);
}

// F1 media team logos (2025 set — newest with full coverage). New-for-2026 teams fall back to a badge.
const TEAM_LOGO_SLUGS = {
  mercedes: 'mercedes', ferrari: 'ferrari', red_bull: 'red-bull-racing',
  mclaren: 'mclaren', aston_martin: 'aston-martin', alpine: 'alpine',
  williams: 'williams', rb: 'racing-bulls', sauber: 'kick-sauber', haas: 'haas',
};
export function teamLogoUrl(constructorId) {
  const slug = TEAM_LOGO_SLUGS[constructorId];
  return slug ? `https://media.formula1.com/content/dam/fom-website/teams/2025/${slug}-logo.png` : null;
}

// Country → ISO-3166 alpha-2 for real flag images (flagcdn.com)
const ISO2 = {
  Australia: 'au', China: 'cn', Japan: 'jp', Bahrain: 'bh', 'Saudi Arabia': 'sa',
  USA: 'us', 'United States': 'us', Italy: 'it', Monaco: 'mc', Spain: 'es',
  Canada: 'ca', Austria: 'at', UK: 'gb', 'United Kingdom': 'gb', 'Great Britain': 'gb',
  Hungary: 'hu', Belgium: 'be', Netherlands: 'nl', Azerbaijan: 'az', Singapore: 'sg',
  Mexico: 'mx', Brazil: 'br', Qatar: 'qa', UAE: 'ae', 'United Arab Emirates': 'ae',
  Portugal: 'pt', France: 'fr', Germany: 'de', Vietnam: 'vn',
};
export function flagUrl(country, width = 80) {
  const iso = ISO2[country];
  return iso ? `https://flagcdn.com/w${width}/${iso}.png` : null;
}

// Country code → flag emoji (fallback)
export function flagFor(country) {
  const MAP = {
    Australia: '🇦🇺', China: '🇨🇳', Japan: '🇯🇵', Bahrain: '🇧🇭', 'Saudi Arabia': '🇸🇦',
    USA: '🇺🇸', 'United States': '🇺🇸', Italy: '🇮🇹', Monaco: '🇲🇨', Spain: '🇪🇸',
    Canada: '🇨🇦', Austria: '🇦🇹', UK: '🇬🇧', 'United Kingdom': '🇬🇧', Hungary: '🇭🇺',
    Belgium: '🇧🇪', Netherlands: '🇳🇱', Azerbaijan: '🇦🇿', Singapore: '🇸🇬',
    Mexico: '🇲🇽', Brazil: '🇧🇷', Qatar: '🇶🇦', UAE: '🇦🇪', 'United Arab Emirates': '🇦🇪',
    Portugal: '🇵🇹', France: '🇫🇷', Germany: '🇩🇪', Vietnam: '🇻🇳', Madrid: '🇪🇸',
  };
  return MAP[country] || '🏁';
}
