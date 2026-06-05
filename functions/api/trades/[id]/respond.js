import { json } from '../../_shared.js';

export async function onRequestPost({ env, params, request }) {
  try {
    const { response } = await request.json();
    if (response !== 'accepted' && response !== 'declined')
      return json({ error: 'Invalid response' }, 400);

    const { meta } = await env.DB.prepare(
      "UPDATE trades SET receiver_response = ? WHERE id = ? AND status = 'pending'"
    ).bind(response, params.id).run();

    if (!meta.changes) return json({ error: 'Trade not found or already resolved' }, 404);
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
