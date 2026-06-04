import { STAGE_ORDER, json } from './_shared.js';

const API_LOSER_STAGE = {
  GROUP_STAGE: 'GROUP', ROUND_OF_32: 'R32', ROUND_OF_16: 'R16',
  QUARTER_FINALS: 'QF', SEMI_FINALS: 'SF', FINAL: 'FINAL',
};
const API_WINNER_NEXT = {
  GROUP_STAGE: 'R32', ROUND_OF_32: 'R16', ROUND_OF_16: 'QF',
  QUARTER_FINALS: 'SF', SEMI_FINALS: 'FINAL', FINAL: 'WINNER',
};

async function setStageIfHigher(db, tla, newStage) {
  if (!tla || !newStage) return;
  const team = await db.prepare('SELECT stage FROM teams WHERE code = ?').bind(tla).first();
  if (!team) return;
  if (STAGE_ORDER.indexOf(newStage) > STAGE_ORDER.indexOf(team.stage || 'GROUP'))
    await db.prepare(`UPDATE teams SET stage = ?, updated_at = datetime('now') WHERE code = ?`).bind(newStage, tla).run();
}

export async function onRequestPost({ env }) {
  if (!env.FOOTBALL_DATA_API_KEY)
    return json({ success: false, message: 'No API key configured' });

  const hdrs = { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY };

  try {
    // Group stage via standings
    const sRes = await fetch('https://api.football-data.org/v4/competitions/WC/standings?season=2026', { headers: hdrs });
    if (sRes.ok) {
      const { standings } = await sRes.json();
      const thirdPlace = [];
      for (const group of (standings || [])) {
        const table = group.table || [];
        const done = table.every(r => r.playedGames >= table.length - 1);
        for (const row of table) {
          const tla = row.team?.tla;
          if (!tla) continue;
          if (row.position <= 2 && done)      await setStageIfHigher(env.DB, tla, 'R32');
          else if (row.position === 3)         thirdPlace.push({ tla, pts: row.points, gd: row.goalDifference, gf: row.goalsFor });
          else if (row.position >= 4 && done)  await setStageIfHigher(env.DB, tla, 'GROUP');
        }
      }
      thirdPlace.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
      for (let i = 0; i < thirdPlace.length; i++)
        await setStageIfHigher(env.DB, thirdPlace[i].tla, i < 8 ? 'R32' : 'GROUP');
    }

    // Knockout matches
    const mRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches?season=2026', { headers: hdrs });
    if (mRes.ok) {
      const { matches } = await mRes.json();
      const ko = ['ROUND_OF_32','ROUND_OF_16','QUARTER_FINALS','SEMI_FINALS','FINAL'];
      for (const m of (matches || [])) {
        if (!ko.includes(m.stage) || m.status !== 'FINISHED') continue;
        const w = m.score?.winner;
        if (!w || w === 'DRAW') continue;
        const winnerTla = w === 'HOME_TEAM' ? m.homeTeam?.tla : m.awayTeam?.tla;
        const loserTla  = w === 'HOME_TEAM' ? m.awayTeam?.tla : m.homeTeam?.tla;
        await setStageIfHigher(env.DB, loserTla,  API_LOSER_STAGE[m.stage]);
        await setStageIfHigher(env.DB, winnerTla, API_WINNER_NEXT[m.stage]);
      }
    }

    return json({ success: true, message: 'Sync complete' });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
