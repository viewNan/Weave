create table if not exists agent_runs (
    id uuid primary key, user_id uuid, conversation_id uuid, skill text,
    model text, status text not null default 'running', input_tokens integer,
    output_tokens integer, cost numeric, started_at timestamptz not null default now(),
    finished_at timestamptz
);
create table if not exists tool_calls (
    id uuid primary key, agent_run_id uuid not null references agent_runs(id) on delete cascade,
    tool_name text not null, arguments jsonb not null default '{}'::jsonb,
    status text not null default 'running', duration_ms integer,
    created_at timestamptz not null default now()
);
create index if not exists tool_calls_run_idx on tool_calls(agent_run_id);
