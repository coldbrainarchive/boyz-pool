import { json } from '../../_shared.js';

export async function onRequestPost({ env, params }) {
  try {
    const trade = await env.DB.prepare(
      "SELECT * FROM trades WHERE id = ? AND status = 'pending'"
    ).bind(params.id).first();
    if (!trade) return json({ error: 'Trade not found or already resolved' }, 404);

    const offerTeams = JSON.parse(trade.offer_teams);
    const requestTeams = JSON.parse(trade.request_teams);

    const stmts = [];
    for (const code of offerTeams) {
      stmts.push(
        env.DB.prepare('UPDATE player_teams SET player_id = ? WHERE team_code = ?')
          .bind(trade.receiver_id, code)
      );
    }
    for (const code of requestTeams) {
      stmts.push(
        env.DB.prepare('UPDATE player_teams SET player_id = ? WHERE team_code = ?')
          .bind(trade.proposer_id, code)
      );
    }
    stmts.push(
      env.DB.prepare("UPDATE trades SET status = 'approved' WHERE id = ?").bind(params.id)
    );

    await env.DB.batch(stmts);
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
