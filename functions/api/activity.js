import { json } from './_shared.js';

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, action, player_name, team_code, team_name, team_flag, stage, created_at
      FROM activity_log
      ORDER BY id DESC
    `).all();
    return json(results);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
