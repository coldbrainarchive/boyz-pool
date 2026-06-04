import { json } from '../../../_shared.js';

export async function onRequestPost({ env, params, request }) {
  const { teamCode } = await request.json();

  const team   = await env.DB.prepare('SELECT 1 FROM teams WHERE code = ?').bind(teamCode).first();
  const player = await env.DB.prepare('SELECT 1 FROM players WHERE id = ?').bind(params.id).first();
  const taken  = await env.DB.prepare('SELECT 1 FROM player_teams WHERE team_code = ?').bind(teamCode).first();

  if (!team)   return json({ error: 'Team not found' }, 404);
  if (!player) return json({ error: 'Player not found' }, 404);
  if (taken)   return json({ error: 'Team already claimed' }, 400);

  try {
    await env.DB.prepare('INSERT INTO player_teams (player_id, team_code) VALUES (?, ?)').bind(params.id, teamCode).run();
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
