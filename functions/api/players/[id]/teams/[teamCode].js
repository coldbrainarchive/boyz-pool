import { json, getSettings } from '../../../_shared.js';

export async function onRequestDelete({ env, params }) {
  const settings = await getSettings(env.DB);
  if (settings.teams_locked) return json({ error: 'Team changes are locked' }, 403);
  // Fetch names before deleting so we can log
  const [player, team] = await Promise.all([
    env.DB.prepare('SELECT name FROM players WHERE id = ?').bind(params.id).first(),
    env.DB.prepare('SELECT name, flag FROM teams WHERE code = ?').bind(params.teamCode).first(),
  ]);

  const { meta } = await env.DB.prepare(
    'DELETE FROM player_teams WHERE player_id = ? AND team_code = ?'
  ).bind(params.id, params.teamCode).run();

  if (!meta.changes) return json({ error: 'Assignment not found' }, 404);

  if (player && team) {
    await env.DB.prepare(
      `INSERT INTO activity_log (action, player_name, team_code, team_name, team_flag) VALUES ('removed', ?, ?, ?, ?)`
    ).bind(player.name, params.teamCode, team.name, team.flag).run();
  }

  return json({ success: true });
}
