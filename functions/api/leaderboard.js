import { calcPoints, getSettings, json } from './_shared.js';

export async function onRequestGet({ env }) {
  const settings = await getSettings(env.DB);
  const { results: players } = await env.DB.prepare(
    'SELECT id, name, photo FROM players ORDER BY name'
  ).all();

  const result = await Promise.all(players.map(async player => {
    const { results: teams } = await env.DB.prepare(`
      SELECT t.code, t.name, t.flag, t.stage, t.confederation, t.group_name
      FROM player_teams pt
      JOIN teams t ON pt.team_code = t.code
      WHERE pt.player_id = ?
    `).bind(player.id).all();

    const teamsWithPts = teams.map(t => ({ ...t, points: calcPoints(t.stage, settings) }));
    return {
      id: player.id,
      name: player.name,
      photo: player.photo || null,
      teams: teamsWithPts,
      totalPoints: teamsWithPts.reduce((s, t) => s + t.points, 0),
    };
  }));

  result.sort((a, b) => b.totalPoints - a.totalPoints || a.id - b.id);
  return json(result);
}
