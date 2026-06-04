import { json } from '../../_shared.js';

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM player_teams WHERE player_id = ?').bind(params.id).run();
  const { meta } = await env.DB.prepare('DELETE FROM players WHERE id = ?').bind(params.id).run();
  if (!meta.changes) return json({ error: 'Player not found' }, 404);
  return json({ success: true });
}
