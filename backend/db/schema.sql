CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  team TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  site TEXT NOT NULL,
  role TEXT NOT NULL,
  shift_id TEXT REFERENCES shifts(id),
  parking_eligibility BOOLEAN NOT NULL DEFAULT TRUE,
  vehicle_connected BOOLEAN NOT NULL DEFAULT TRUE,
  home_location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_documents (
  id SERIAL PRIMARY KEY,
  policy_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_chunks (
  id BIGSERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS commute_plans (
  id BIGSERIAL PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id),
  shift_id TEXT REFERENCES shifts(id),
  estimated_arrival_time TIMESTAMPTZ,
  charging_stop TEXT,
  arrival_battery_percent INTEGER,
  risk_score INTEGER,
  plan_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mcp_tool_logs (
  id BIGSERIAL PRIMARY KEY,
  tool_name TEXT NOT NULL,
  input_json JSONB NOT NULL,
  output_json JSONB,
  latency_ms INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_chunks_document_id ON policy_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_logs_tool_name ON mcp_tool_logs(tool_name);
