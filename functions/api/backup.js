export async function onRequestGet({ env }) {
  try {
    const [players, assignments, stages, settings, activity] = await Promise.all([
      env.DB.prepare('SELECT id, name, created_at FROM players ORDER BY id').all(),
      env.DB.prepare(`
        SELECT pt.player_id, p.name AS player_name, pt.team_code,
               t.name AS team_name, t.flag
        FROM player_teams pt
        JOIN players p ON pt.player_id = p.id
        JOIN teams t ON pt.team_code = t.code
        ORDER BY p.name
      `).all(),
      env.DB.prepare(
        'SELECT code, name, flag, group_name, stage FROM teams WHERE stage IS NOT NULL ORDER BY group_name'
      ).all(),
      env.DB.prepare('SELECT key, value FROM settings ORDER BY key').all(),
      env.DB.prepare('SELECT action, player_name, team_name, team_flag, stage, created_at FROM activity_log ORDER BY id DESC').all(),
    ]);

    const payload = JSON.stringify({
      exported_at: new Date().toISOString(),
      players: players.results,
      team_assignments: assignments.results,
      team_stages: stages.results,
      scoring_settings: settings.results,
      activity_log: activity.results,
    }, null, 2);

    const date = new Date().toISOString().split('T')[0];
    return new Response(payload, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="boyz-pool-backup-${date}.json"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
