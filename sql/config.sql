CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  role          TEXT DEFAULT 'user',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
);

INSERT INTO users (username, email, password_hash, display_name, role)
VALUES
  ('system', 'system@example.com', 'dummy_hash', 'System User', 'system');
-- id가 1번일 것

CREATE TABLE app_config (
  id SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  updated_at  TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, category)  -- 사용자+카테고리 조합 1행만
);

INSERT INTO app_config (user_id, category, folder_path)
VALUES
  (1, 'search',      'SearchFiles')      -- 홈/SearchFiles
  -- , (1, 'backup',     'Backups'),         -- 홈/Backups
  -- (1, 'search',     'Documents/Search') -- 홈/Documents/Search
ON CONFLICT (user_id, category)
DO UPDATE SET
  folder_path = EXCLUDED.folder_path,
  updated_at  = now();
