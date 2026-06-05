import { json, getSettings } from '../_shared.js';

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT t.id, t.proposer_id, t.receiver_id, t.offer_teams, t.request_teams,
             t.status, t.created_at, p1.name AS proposer_name, p2.name AS receiver_name
      FROM trades t
      JOIN players p1 ON p1.id = t.proposer_id
      JOIN players p2 ON p2.id = t.receiver_id
      WHERE t.status = 'pending'
      ORDER BY t.created_at DESC
    `).all();
    return json(results.map(t => ({
      ...t,
      offer_teams: JSON.parse(t.offer_teams),
      request_teams: JSON.parse(t.request_teams),
    })));
  } catch (err) {
    return json([]);
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const settings = await getSettings(env.DB);
    if (!settings.trade_deadline_active) return json({ error: 'Trade period is not active' }, 403);

    const { proposer_id, receiver_id, offer_teams, request_teams } = await request.json();
    if (!proposer_id || !receiver_id || !offer_teams?.length || !request_teams?.length)
      return json({ error: 'Missing required fields' }, 400);
    if (proposer_id === receiver_id)
      return json({ error: 'Cannot trade with yourself' }, 400);

    for (const code of offer_teams) {
      const row = await env.DB.prepare(
        'SELECT 1 FROM player_teams WHERE player_id = ? AND team_code = ?'
      ).bind(proposer_id, code).first();
      if (!row) return json({ error: `You don't own team ${code}` }, 400);
    }
    for (const code of request_teams) {
      const row = await env.DB.prepare(
        'SELECT 1 FROM player_teams WHERE player_id = ? AND team_code = ?'
      ).bind(receiver_id, code).first();
      if (!row) return json({ error: `Team ${code} doesn't belong to the other player` }, 400);
    }

    await env.DB.prepare(
      'INSERT INTO trades (proposer_id, receiver_id, offer_teams, request_teams) VALUES (?, ?, ?, ?)'
    ).bind(proposer_id, receiver_id, JSON.stringify(offer_teams), JSON.stringify(request_teams)).run();

    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
