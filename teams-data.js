// 2026 FIFA World Cup — official 48 teams & groups
const TEAMS = [
  // Group A
  { code: 'MEX', name: 'Mexico',        flag: '🇲🇽', confederation: 'CONCACAF', group: 'A' },
  { code: 'RSA', name: 'South Africa',  flag: '🇿🇦', confederation: 'CAF',      group: 'A' },
  { code: 'KOR', name: 'South Korea',   flag: '🇰🇷', confederation: 'AFC',      group: 'A' },
  { code: 'CZE', name: 'Czechia',       flag: '🇨🇿', confederation: 'UEFA',     group: 'A' },

  // Group B
  { code: 'CAN', name: 'Canada',        flag: '🇨🇦', confederation: 'CONCACAF', group: 'B' },
  { code: 'BIH', name: 'Bosnia',        flag: '🇧🇦', confederation: 'UEFA',     group: 'B' },
  { code: 'QAT', name: 'Qatar',         flag: '🇶🇦', confederation: 'AFC',      group: 'B' },
  { code: 'SUI', name: 'Switzerland',   flag: '🇨🇭', confederation: 'UEFA',     group: 'B' },

  // Group C
  { code: 'BRA', name: 'Brazil',        flag: '🇧🇷', confederation: 'CONMEBOL', group: 'C' },
  { code: 'MAR', name: 'Morocco',       flag: '🇲🇦', confederation: 'CAF',      group: 'C' },
  { code: 'HAI', name: 'Haiti',         flag: '🇭🇹', confederation: 'CONCACAF', group: 'C' },
  { code: 'SCO', name: 'Scotland',      flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confederation: 'UEFA',     group: 'C' },

  // Group D
  { code: 'USA', name: 'United States', flag: '🇺🇸', confederation: 'CONCACAF', group: 'D' },
  { code: 'PAR', name: 'Paraguay',      flag: '🇵🇾', confederation: 'CONMEBOL', group: 'D' },
  { code: 'AUS', name: 'Australia',     flag: '🇦🇺', confederation: 'AFC',      group: 'D' },
  { code: 'TUR', name: 'Türkiye',       flag: '🇹🇷', confederation: 'UEFA',     group: 'D' },

  // Group E
  { code: 'GER', name: 'Germany',       flag: '🇩🇪', confederation: 'UEFA',     group: 'E' },
  { code: 'CUW', name: 'Curaçao',       flag: '🇨🇼', confederation: 'CONCACAF', group: 'E' },
  { code: 'CIV', name: 'Ivory Coast',   flag: '🇨🇮', confederation: 'CAF',      group: 'E' },
  { code: 'ECU', name: 'Ecuador',       flag: '🇪🇨', confederation: 'CONMEBOL', group: 'E' },

  // Group F
  { code: 'NED', name: 'Netherlands',   flag: '🇳🇱', confederation: 'UEFA',     group: 'F' },
  { code: 'JPN', name: 'Japan',         flag: '🇯🇵', confederation: 'AFC',      group: 'F' },
  { code: 'SWE', name: 'Sweden',        flag: '🇸🇪', confederation: 'UEFA',     group: 'F' },
  { code: 'TUN', name: 'Tunisia',       flag: '🇹🇳', confederation: 'CAF',      group: 'F' },

  // Group G
  { code: 'BEL', name: 'Belgium',       flag: '🇧🇪', confederation: 'UEFA',     group: 'G' },
  { code: 'EGY', name: 'Egypt',         flag: '🇪🇬', confederation: 'CAF',      group: 'G' },
  { code: 'IRN', name: 'Iran',          flag: '🇮🇷', confederation: 'AFC',      group: 'G' },
  { code: 'NZL', name: 'New Zealand',   flag: '🇳🇿', confederation: 'OFC',      group: 'G' },

  // Group H
  { code: 'ESP', name: 'Spain',         flag: '🇪🇸', confederation: 'UEFA',     group: 'H' },
  { code: 'CPV', name: 'Cabo Verde',    flag: '🇨🇻', confederation: 'CAF',      group: 'H' },
  { code: 'KSA', name: 'Saudi Arabia',  flag: '🇸🇦', confederation: 'AFC',      group: 'H' },
  { code: 'URU', name: 'Uruguay',       flag: '🇺🇾', confederation: 'CONMEBOL', group: 'H' },

  // Group I
  { code: 'FRA', name: 'France',        flag: '🇫🇷', confederation: 'UEFA',     group: 'I' },
  { code: 'SEN', name: 'Senegal',       flag: '🇸🇳', confederation: 'CAF',      group: 'I' },
  { code: 'IRQ', name: 'Iraq',          flag: '🇮🇶', confederation: 'AFC',      group: 'I' },
  { code: 'NOR', name: 'Norway',        flag: '🇳🇴', confederation: 'UEFA',     group: 'I' },

  // Group J
  { code: 'ARG', name: 'Argentina',     flag: '🇦🇷', confederation: 'CONMEBOL', group: 'J' },
  { code: 'ALG', name: 'Algeria',       flag: '🇩🇿', confederation: 'CAF',      group: 'J' },
  { code: 'AUT', name: 'Austria',       flag: '🇦🇹', confederation: 'UEFA',     group: 'J' },
  { code: 'JOR', name: 'Jordan',        flag: '🇯🇴', confederation: 'AFC',      group: 'J' },

  // Group K
  { code: 'POR', name: 'Portugal',      flag: '🇵🇹', confederation: 'UEFA',     group: 'K' },
  { code: 'COD', name: 'DR Congo',      flag: '🇨🇩', confederation: 'CAF',      group: 'K' },
  { code: 'UZB', name: 'Uzbekistan',    flag: '🇺🇿', confederation: 'AFC',      group: 'K' },
  { code: 'COL', name: 'Colombia',      flag: '🇨🇴', confederation: 'CONMEBOL', group: 'K' },

  // Group L
  { code: 'ENG', name: 'England',       flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA',     group: 'L' },
  { code: 'CRO', name: 'Croatia',       flag: '🇭🇷', confederation: 'UEFA',     group: 'L' },
  { code: 'GHA', name: 'Ghana',         flag: '🇬🇭', confederation: 'CAF',      group: 'L' },
  { code: 'PAN', name: 'Panama',        flag: '🇵🇦', confederation: 'CONCACAF', group: 'L' },
];

module.exports = { TEAMS };
