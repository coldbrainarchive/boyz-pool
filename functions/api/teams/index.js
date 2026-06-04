import { json } from '../_shared.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(`
    SELECT t.code, t.name, t.flag, t.confederation, t.group_name, t.stage,
           p.name AS claimed_by, p.id AS claimed_by_id
    FROM teams t
    LEFT JOIN player_teams pt ON t.code = pt.team_code
    LEFT JOIN players p ON pt.player_id = p.id
    ORDER BY t.group_name, t.name
  `).all();
  return json(results);
}
