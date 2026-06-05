import { json } from './_shared.js';

export async function onRequestGet({ env }) {
  try {
    const [{ results: logs }, { results: trades }] = await Promise.all([
      env.DB.prepare(`
        SELECT id, action, player_name, team_code, team_name, team_flag, stage, created_at
        FROM activity_log ORDER BY id DESC LIMIT 100
      `).all(),
      env.DB.prepare(`
        SELECT t.id, t.status, t.receiver_response, t.offer_teams, t.request_teams, t.created_at,
               p1.name AS proposer_name, p2.name AS receiver_name
        FROM trades t
        JOIN players p1 ON p1.id = t.proposer_id
        JOIN players p2 ON p2.id = t.receiver_id
        ORDER BY t.created_at DESC LIMIT 50
      `).all().catch(() => ({ results: [] })),
    ]);

    const tradeEntries = trades.map(t => ({
      _type: 'trade',
      id: `trade_${t.id}`,
      trade_id: t.id,
      action: 'trade',
      status: t.status,
      receiver_response: t.receiver_response,
      proposer_name: t.proposer_name,
      receiver_name: t.receiver_name,
      offer_teams: JSON.parse(t.offer_teams),
      request_teams: JSON.parse(t.request_teams),
      created_at: t.created_at,
    }));

    const merged = [...logs, ...tradeEntries]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 100);

    return json(merged);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
