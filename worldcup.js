const { getDb } = require('./db');

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = 'https://api.football-data.org/v4';

const DEFAULT_SETTINGS = {
  pts_groups:    5,
  pts_r16:       10,
  pts_qf:        10,
  pts_sf:        10,
  pts_runner_up: 10,
  pts_champion:  10,
};

const STAGE_ORDER = ['GROUP', 'R32', 'R16', 'QF', 'SF', 'FINAL', 'WINNER'];

// football-data.org stage strings → our stage (for losers at that round)
const API_LOSER_STAGE = {
  GROUP_STAGE:    'GROUP',
  ROUND_OF_32:    'R32',
  ROUND_OF_16:    'R16',
  QUARTER_FINALS: 'QF',
  SEMI_FINALS:    'SF',
  FINAL:          'FINAL'
};

// What stage does the winner of each round advance to?
const API_WINNER_ADVANCES_TO = {
  GROUP_STAGE:    'R32',
  ROUND_OF_32:    'R16',
  ROUND_OF_16:    'QF',
  QUARTER_FINALS: 'SF',
  SEMI_FINALS:    'FINAL',
  FINAL:          'WINNER'
};

async function fetchApi(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY }
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function stageRank(stage) {
  return STAGE_ORDER.indexOf(stage);
}

function setStageIfHigher(db, tla, newStage) {
  if (!tla || !newStage) return;
  const team = db.prepare('SELECT stage FROM teams WHERE code = ?').get(tla);
  if (!team) return;
  if (stageRank(newStage) > stageRank(team.stage)) {
    db.prepare(`UPDATE teams SET stage = ?, updated_at = datetime('now') WHERE code = ?`).run(newStage, tla);
  }
}

async function syncWorldCupData() {
  if (!API_KEY) {
    console.log('[sync] No API key configured, skipping.');
    return;
  }

  try {
    const db = getDb();

    // --- Group stage: use standings to determine who advanced ---
    const standings = await fetchApi('/competitions/WC/standings?season=2026').catch(() => null);
    if (standings?.standings?.length) {
      const thirdPlace = [];

      for (const group of standings.standings) {
        const table = group.table || [];
        const gamesPerTeam = table.length - 1; // round-robin: each plays all others
        const groupDone = table.every(row => row.playedGames >= gamesPerTeam);

        for (const row of table) {
          const tla = row.team?.tla;
          if (!tla) continue;

          if (row.position <= 2 && groupDone) {
            setStageIfHigher(db, tla, 'R32');
          } else if (row.position === 3) {
            thirdPlace.push({ tla, pts: row.points, gd: row.goalDifference, gf: row.goalsFor });
          } else if (row.position >= 4 && groupDone) {
            setStageIfHigher(db, tla, 'GROUP');
          }
        }
      }

      // Best 8 third-place teams advance for the 48-team format
      thirdPlace.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
      for (let i = 0; i < thirdPlace.length; i++) {
        const stage = i < 8 ? 'R32' : 'GROUP';
        setStageIfHigher(db, thirdPlace[i].tla, stage);
      }
    }

    // --- Knockout stages: process finished matches ---
    const matchData = await fetchApi('/competitions/WC/matches?season=2026&stage=ROUND_OF_32,ROUND_OF_16,QUARTER_FINALS,SEMI_FINALS,FINAL').catch(() => null);
    const matches = matchData?.matches ?? [];

    for (const match of matches) {
      if (match.status !== 'FINISHED') continue;
      const winner = match.score?.winner;
      if (!winner || winner === 'DRAW') continue;

      const homeTeam = match.homeTeam?.tla;
      const awayTeam = match.awayTeam?.tla;
      const winnerTla = winner === 'HOME_TEAM' ? homeTeam : awayTeam;
      const loserTla  = winner === 'HOME_TEAM' ? awayTeam  : homeTeam;

      const loserStage  = API_LOSER_STAGE[match.stage];
      const winnerStage = API_WINNER_ADVANCES_TO[match.stage];

      setStageIfHigher(db, loserTla,  loserStage);
      setStageIfHigher(db, winnerTla, winnerStage);
    }

    console.log(`[sync] World Cup data updated at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('[sync] Error:', err.message);
  }
}

// settings = { pts_groups, pts_r16, pts_qf, pts_sf, pts_runner_up, pts_champion }
// Points are cumulative: each stage builds on the previous bonuses.
function calcPoints(stage, settings) {
  if (!stage || stage === 'GROUP') return 0;
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const g  = s.pts_groups;
  const r16 = g  + s.pts_r16;
  const qf  = r16 + s.pts_qf;
  const sf  = qf  + s.pts_sf;
  const fin = sf  + s.pts_runner_up;
  const win = fin + s.pts_champion;
  return { R32: g, R16: r16, QF: qf, SF: sf, FINAL: fin, WINNER: win }[stage] ?? 0;
}

module.exports = { syncWorldCupData, calcPoints, DEFAULT_SETTINGS };
