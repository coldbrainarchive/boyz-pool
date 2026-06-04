require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDb, getDb } = require('./db');
const { syncWorldCupData, calcPoints, DEFAULT_SETTINGS } = require('./worldcup');
const { TEAMS } = require('./teams-data');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Boot
const db = initDb();
seedTeams(db);

if (process.env.FOOTBALL_DATA_API_KEY) {
  syncWorldCupData();
  setInterval(syncWorldCupData, 30 * 60 * 1000);
}

function getSettings() {
  const rows = db.prepare(`SELECT key, value FROM settings`).all();
  const s = { ...DEFAULT_SETTINGS };
  for (const row of rows) if (row.key in s) s[row.key] = parseInt(row.value) || 0;
  return s;
}

function seedTeams(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO teams (code, name, flag, confederation, group_name)
    VALUES (?, ?, ?, ?, ?)
  `);
  const updateGroup = db.prepare(`UPDATE teams SET group_name = ? WHERE code = ?`);
  for (const t of TEAMS) {
    insert.run(t.code, t.name, t.flag, t.confederation, t.group);
    updateGroup.run(t.group, t.code);
  }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

app.get('/api/leaderboard', (req, res) => {
  const settings = getSettings();
  const players = db.prepare(`SELECT id, name FROM players ORDER BY name`).all();

  const result = players.map(player => {
    const teams = db.prepare(`
      SELECT t.code, t.name, t.flag, t.stage, t.confederation
      FROM player_teams pt
      JOIN teams t ON pt.team_code = t.code
      WHERE pt.player_id = ?
    `).all(player.id).map(t => ({ ...t, points: calcPoints(t.stage, settings) }));

    return {
      id: player.id,
      name: player.name,
      teams,
      totalPoints: teams.reduce((s, t) => s + t.points, 0)
    };
  });

  result.sort((a, b) => b.totalPoints - a.totalPoints || a.id - b.id);
  res.json(result);
});

// ─── Teams ────────────────────────────────────────────────────────────────────

app.get('/api/teams', (req, res) => {
  const teams = db.prepare(`
    SELECT t.code, t.name, t.flag, t.confederation, t.group_name, t.stage,
           p.name AS claimed_by, p.id AS claimed_by_id
    FROM teams t
    LEFT JOIN player_teams pt ON t.code = pt.team_code
    LEFT JOIN players p ON pt.player_id = p.id
    ORDER BY t.group_name, t.name
  `).all();
  res.json(teams);
});

// ─── Players ──────────────────────────────────────────────────────────────────

app.post('/api/players', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const { lastInsertRowid } = db.prepare(`INSERT INTO players (name) VALUES (?)`).run(name);
    res.json({ id: lastInsertRowid, name });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Name already taken' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/players/:id', (req, res) => {
  db.prepare(`DELETE FROM player_teams WHERE player_id = ?`).run(req.params.id);
  const { changes } = db.prepare(`DELETE FROM players WHERE id = ?`).run(req.params.id);
  if (!changes) return res.status(404).json({ error: 'Player not found' });
  res.json({ success: true });
});

// ─── Team assignments ─────────────────────────────────────────────────────────

app.post('/api/players/:id/teams', (req, res) => {
  const { teamCode } = req.body;
  if (!db.prepare(`SELECT 1 FROM teams WHERE code = ?`).get(teamCode))
    return res.status(404).json({ error: 'Team not found' });
  if (!db.prepare(`SELECT 1 FROM players WHERE id = ?`).get(req.params.id))
    return res.status(404).json({ error: 'Player not found' });
  if (db.prepare(`SELECT 1 FROM player_teams WHERE team_code = ?`).get(teamCode))
    return res.status(400).json({ error: 'Team already claimed' });

  try {
    db.prepare(`INSERT INTO player_teams (player_id, team_code) VALUES (?, ?)`).run(req.params.id, teamCode);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/players/:id/teams/:teamCode', (req, res) => {
  const { changes } = db.prepare(`
    DELETE FROM player_teams WHERE player_id = ? AND team_code = ?
  `).run(req.params.id, req.params.teamCode);
  if (!changes) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ success: true });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

const VALID_STAGES = [null, 'GROUP', 'R32', 'R16', 'QF', 'SF', 'FINAL', 'WINNER'];

app.patch('/api/teams/:code/stage', (req, res) => {
  const { stage } = req.body;
  if (!VALID_STAGES.includes(stage))
    return res.status(400).json({ error: `Invalid stage. Valid: ${VALID_STAGES.filter(Boolean).join(', ')}` });

  const { changes } = db.prepare(`
    UPDATE teams SET stage = ?, updated_at = datetime('now') WHERE code = ?
  `).run(stage, req.params.code);

  if (!changes) return res.status(404).json({ error: 'Team not found' });
  res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
  res.json(getSettings());
});

app.patch('/api/settings', (req, res) => {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const upsert = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const val = parseInt(req.body[key]);
      if (!isNaN(val) && val >= 0) upsert.run(key, String(val));
    }
  }
  res.json({ success: true, settings: getSettings() });
});

let matchCache = null;
let matchCacheTime = 0;

app.get('/api/matches', async (req, res) => {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    return res.json({ matches: [], noApiKey: true });
  }
  if (matchCache && Date.now() - matchCacheTime < 10 * 60 * 1000) {
    return res.json({ matches: matchCache });
  }
  try {
    const r = await fetch('https://api.football-data.org/v4/competitions/WC/matches?season=2026', {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
    const data = await r.json();
    matchCache = data.matches || [];
    matchCacheTime = Date.now();
    res.json({ matches: matchCache });
  } catch (err) {
    if (matchCache) return res.json({ matches: matchCache });
    res.status(500).json({ error: err.message, matches: [] });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    await syncWorldCupData();
    res.json({ success: true, message: 'Sync complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n⚽  The Boyz Pool → http://localhost:${PORT}\n`);
});
