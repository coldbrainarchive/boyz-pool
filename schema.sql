CREATE TABLE IF NOT EXISTS teams (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  flag TEXT NOT NULL,
  confederation TEXT NOT NULL,
  group_name TEXT,
  stage TEXT DEFAULT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  photo TEXT,
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

CREATE TABLE IF NOT EXISTS draft (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active INTEGER NOT NULL DEFAULT 0,
  pick_number INTEGER NOT NULL DEFAULT 0,
  timer_enabled INTEGER NOT NULL DEFAULT 0,
  timer_seconds INTEGER NOT NULL DEFAULT 18000,
  pick_started_at TEXT,
  player_order TEXT NOT NULL DEFAULT '[]'
);
INSERT OR IGNORE INTO draft (id, active, pick_number, timer_enabled, timer_seconds, player_order)
  VALUES (1, 0, 0, 0, 18000, '[]');

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team_code TEXT NOT NULL,
  team_name TEXT NOT NULL,
  team_flag TEXT NOT NULL,
  stage TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings VALUES ('pts_groups',    '5');
INSERT OR IGNORE INTO settings VALUES ('pts_r16',       '10');
INSERT OR IGNORE INTO settings VALUES ('pts_qf',        '10');
INSERT OR IGNORE INTO settings VALUES ('pts_sf',        '10');
INSERT OR IGNORE INTO settings VALUES ('pts_runner_up', '10');
INSERT OR IGNORE INTO settings VALUES ('pts_champion',  '10');

-- Group A
INSERT OR IGNORE INTO teams VALUES ('MEX','Mexico','🇲🇽','CONCACAF','A',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('RSA','South Africa','🇿🇦','CAF','A',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('KOR','South Korea','🇰🇷','AFC','A',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('CZE','Czechia','🇨🇿','UEFA','A',NULL,NULL);
-- Group B
INSERT OR IGNORE INTO teams VALUES ('CAN','Canada','🇨🇦','CONCACAF','B',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('BIH','Bosnia','🇧🇦','UEFA','B',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('QAT','Qatar','🇶🇦','AFC','B',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('SUI','Switzerland','🇨🇭','UEFA','B',NULL,NULL);
-- Group C
INSERT OR IGNORE INTO teams VALUES ('BRA','Brazil','🇧🇷','CONMEBOL','C',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('MAR','Morocco','🇲🇦','CAF','C',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('HAI','Haiti','🇭🇹','CONCACAF','C',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('SCO','Scotland','🏴󠁧󠁢󠁳󠁣󠁴󠁿','UEFA','C',NULL,NULL);
-- Group D
INSERT OR IGNORE INTO teams VALUES ('USA','United States','🇺🇸','CONCACAF','D',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('PAR','Paraguay','🇵🇾','CONMEBOL','D',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('AUS','Australia','🇦🇺','AFC','D',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('TUR','Türkiye','🇹🇷','UEFA','D',NULL,NULL);
-- Group E
INSERT OR IGNORE INTO teams VALUES ('GER','Germany','🇩🇪','UEFA','E',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('CUW','Curaçao','🇨🇼','CONCACAF','E',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('CIV','Ivory Coast','🇨🇮','CAF','E',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('ECU','Ecuador','🇪🇨','CONMEBOL','E',NULL,NULL);
-- Group F
INSERT OR IGNORE INTO teams VALUES ('NED','Netherlands','🇳🇱','UEFA','F',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('JPN','Japan','🇯🇵','AFC','F',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('SWE','Sweden','🇸🇪','UEFA','F',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('TUN','Tunisia','🇹🇳','CAF','F',NULL,NULL);
-- Group G
INSERT OR IGNORE INTO teams VALUES ('BEL','Belgium','🇧🇪','UEFA','G',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('EGY','Egypt','🇪🇬','CAF','G',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('IRN','Iran','🇮🇷','AFC','G',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('NZL','New Zealand','🇳🇿','OFC','G',NULL,NULL);
-- Group H
INSERT OR IGNORE INTO teams VALUES ('ESP','Spain','🇪🇸','UEFA','H',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('CPV','Cabo Verde','🇨🇻','CAF','H',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('KSA','Saudi Arabia','🇸🇦','AFC','H',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('URU','Uruguay','🇺🇾','CONMEBOL','H',NULL,NULL);
-- Group I
INSERT OR IGNORE INTO teams VALUES ('FRA','France','🇫🇷','UEFA','I',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('SEN','Senegal','🇸🇳','CAF','I',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('IRQ','Iraq','🇮🇶','AFC','I',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('NOR','Norway','🇳🇴','UEFA','I',NULL,NULL);
-- Group J
INSERT OR IGNORE INTO teams VALUES ('ARG','Argentina','🇦🇷','CONMEBOL','J',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('ALG','Algeria','🇩🇿','CAF','J',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('AUT','Austria','🇦🇹','UEFA','J',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('JOR','Jordan','🇯🇴','AFC','J',NULL,NULL);
-- Group K
INSERT OR IGNORE INTO teams VALUES ('POR','Portugal','🇵🇹','UEFA','K',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('COD','DR Congo','🇨🇩','CAF','K',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('UZB','Uzbekistan','🇺🇿','AFC','K',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('COL','Colombia','🇨🇴','CONMEBOL','K',NULL,NULL);
-- Group L
INSERT OR IGNORE INTO teams VALUES ('ENG','England','🏴󠁧󠁢󠁥󠁮󠁧󠁿','UEFA','L',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('CRO','Croatia','🇭🇷','UEFA','L',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('GHA','Ghana','🇬🇭','CAF','L',NULL,NULL);
INSERT OR IGNORE INTO teams VALUES ('PAN','Panama','🇵🇦','CONCACAF','L',NULL,NULL);
