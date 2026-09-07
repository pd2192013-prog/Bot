-- MathBot D1 schema — Google Sheets ("MathBot_Database") ka replacement.
-- Deploy karte waqt ek baar chalao: wrangler d1 execute mathbot-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  chat_id                  TEXT PRIMARY KEY,
  username                 TEXT DEFAULT '',
  first_name               TEXT DEFAULT '',
  lang                      TEXT DEFAULT '',
  question_count            INTEGER DEFAULT 0,
  limit_reset_at             INTEGER DEFAULT 0,
  unlimited                 INTEGER DEFAULT 0,   -- 0 = FALSE, 1 = TRUE
  plan_id                    TEXT DEFAULT '',
  plan_expiry                INTEGER DEFAULT 0,
  plan_daily_limit            INTEGER DEFAULT 0,
  plan_used_today             INTEGER DEFAULT 0,
  plan_day_reset_at            INTEGER DEFAULT 0,
  custom_limit                INTEGER DEFAULT 0,
  custom_interval_ms            INTEGER DEFAULT 0,
  custom_expiry                INTEGER DEFAULT 0,
  custom_used_in_interval        INTEGER DEFAULT 0,
  custom_interval_reset_at        INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id      TEXT,
  ts           INTEGER,
  user_message TEXT,
  bot_reply    TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_ts   ON messages(ts);

CREATE TABLE IF NOT EXISTS plans (
  plan_id       TEXT PRIMARY KEY,
  name          TEXT,
  price_stars   INTEGER,
  daily_limit   INTEGER,
  validity_days INTEGER,
  exceed_hi     TEXT,
  exceed_en     TEXT,
  active        INTEGER DEFAULT 1,
  subjects      TEXT DEFAULT 'math'
);
