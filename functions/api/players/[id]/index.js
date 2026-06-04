import { json } from '../../_shared.js';

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM player_teams WHERE player_id = ?').bind(params.id).run();
  const { meta } = await env.DB.prepare('DELETE FROM players WHERE id = ?').bind(params.id).run();
  if (!meta.changes) return json({ error: 'Player not found' }, 404);
  return json({ success: true });
}

export async function onRequestPatch({ env, params, request }) {
  const { photo } = await request.json();
  const { meta } = await env.DB.prepare(
    'UPDATE players SET photo = ? WHERE id = ?'
  ).bind(photo || null, params.id).run();
  if (!meta.changes) return json({ error: 'Player not found' }, 404);
  return json({ success: true });
}
