import { json } from '../../_shared.js';

export async function onRequestDelete({ env, params }) {
  try {
    const { meta } = await env.DB.prepare(
      'DELETE FROM trades WHERE id = ?'
    ).bind(params.id).run();
    if (!meta.changes) return json({ error: 'Trade not found' }, 404);
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
