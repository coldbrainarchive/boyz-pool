import { json } from './_shared.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(`
    SELECT id, action, player_name, team_code, team_name, team_flag, created_at
    FROM activity_log
    ORDER BY id DESC
    LIMIT 50
  `).all();
  return json(results);
}
