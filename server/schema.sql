-- Tabelas do Genésio (criadas sozinhas quando a API sobe; pode rodar de novo sem problema)
CREATE TABLE IF NOT EXISTS users (
  id         serial PRIMARY KEY,
  name       text NOT NULL,                      -- nome como a pessoa escreveu
  name_key   text NOT NULL UNIQUE,               -- nome em minúsculas (não deixa repetir "Ana" e "ana")
  pass_hash  text NOT NULL,                      -- senha com hash scrypt (nunca a senha em si)
  coins      bigint NOT NULL DEFAULT 0,          -- GenesisCoins somadas de todas as fases
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scores (
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        text NOT NULL,                      -- ex.: genesio-best-normal, genesio-flow-best, genesio-climb-best
  value      bigint NOT NULL,                    -- o melhor resultado (só aumenta)
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,                   -- sha256 do token guardado no aparelho
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
