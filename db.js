const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDb() {
  db = new Database(path.join(__dirname, 'pool.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      flag TEXT NOT NULL,
      confederation TEXT NOT NULL,
      stage TEXT DEFAULT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS player_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      team_code TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (team_code) REFERENCES teams(code),
      UNIQUE(team_code)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Add group_name column if upgrading from older schema
  try { db.exec(`ALTER TABLE teams ADD COLUMN group_name TEXT`); } catch (_) {}

  const seedSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  seedSetting.run('pts_groups',     '5');
  seedSetting.run('pts_r16',        '10');
  seedSetting.run('pts_qf',         '10');
  seedSetting.run('pts_sf',         '10');
  seedSetting.run('pts_runner_up',  '10');
  seedSetting.run('pts_champion',   '10');

  return db;
}

function getDb() {
  return db;
}

module.exports = { initDb, getDb };
