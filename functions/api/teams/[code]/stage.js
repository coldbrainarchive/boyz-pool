import { VALID_STAGES, json } from '../../_shared.js';

export async function onRequestPatch({ env, params, request }) {
  const { stage } = await request.json();
  if (!VALID_STAGES.includes(stage))
    return json({ error: 'Invalid stage' }, 400);

  const { meta } = await env.DB.prepare(
    `UPDATE teams SET stage = ?, updated_at = datetime('now') WHERE code = ?`
  ).bind(stage, params.code).run();

  if (!meta.changes) return json({ error: 'Team not found' }, 404);
  return json({ success: true });
}
