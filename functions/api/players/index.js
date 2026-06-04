import { json } from '../_shared.js';

export async function onRequestPost({ env, request }) {
  const { name } = await request.json();
  if (!name?.trim()) return json({ error: 'Name is required' }, 400);

  try {
    const { meta } = await env.DB.prepare('INSERT INTO players (name) VALUES (?)').bind(name.trim()).run();
    return json({ id: meta.last_row_id, name: name.trim() });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return json({ error: 'Name already taken' }, 400);
    return json({ error: err.message }, 500);
  }
}
