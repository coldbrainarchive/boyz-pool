import { json } from '../../_shared.js';

export async function onRequestPost({ env, params }) {
  try {
    const { meta } = await env.DB.prepare(
      "UPDATE trades SET status = 'rejected' WHERE id = ? AND status = 'pending'"
    ).bind(params.id).run();
    if (!meta.changes) return json({ error: 'Trade not found or already resolved' }, 404);
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
