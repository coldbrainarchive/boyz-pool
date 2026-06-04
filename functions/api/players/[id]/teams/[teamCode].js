import { json } from '../../../_shared.js';

export async function onRequestDelete({ env, params }) {
  const { meta } = await env.DB.prepare(
    'DELETE FROM player_teams WHERE player_id = ? AND team_code = ?'
  ).bind(params.id, params.teamCode).run();

  if (!meta.changes) return json({ error: 'Assignment not found' }, 404);
  return json({ success: true });
}
