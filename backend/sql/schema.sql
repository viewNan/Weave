create extension if not exists vector;

create table if not exists workspaces (
    id uuid primary key,
    name text not null,
    owner_id uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists projects (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    name text not null,
    description text,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists documents (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    project_id uuid references projects(id) on delete set null,
    owner_id uuid not null,
    title text not null,
    document_type text not null default 'markdown',
    source_type text not null default 'local_file',
    source_url text,
    visibility text not null default 'private',
    current_version_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists document_versions (
    id uuid primary key,
    document_id uuid not null references documents(id) on delete cascade,
    owner_id uuid not null,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    project_id uuid references projects(id) on delete set null,
    created_by uuid not null,
    version_number integer not null check (version_number > 0),
    content text not null default '',
    storage_path text,
    source_path text,
    metadata jsonb not null default '{}'::jsonb,
    processing_status text not null default 'pending',
    processing_error text,
    processed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (document_id, version_number)
);

alter table documents drop constraint if exists documents_current_version_fk;
alter table documents add constraint documents_current_version_fk
    foreign key (current_version_id) references document_versions(id) on delete set null;

create table if not exists chunks (
    id uuid primary key,
    owner_id uuid not null,
    document_id uuid not null references documents(id) on delete cascade,
    version_id uuid not null references document_versions(id) on delete cascade,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    project_id uuid references projects(id) on delete set null,
    content text not null,
    embedding vector(1536) not null,
    section text,
    page integer,
    chunk_index integer not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (version_id, chunk_index)
);

create table if not exists facts (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    subject text not null,
    predicate text not null,
    value text not null,
    source_document_id uuid references documents(id) on delete set null,
    source_chunk_id uuid references chunks(id) on delete set null,
    valid_from date,
    valid_until date,
    confidence numeric(4,3) check (confidence between 0 and 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists tasks (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    project_id uuid references projects(id) on delete set null,
    title text not null,
    date date,
    status text not null default 'open',
    priority text,
    category text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists drafts (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    project_id uuid references projects(id) on delete set null,
    title text not null,
    master_content text not null default '',
    status text not null default 'draft',
    created_by uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists draft_variants (
    id uuid primary key,
    draft_id uuid not null references drafts(id) on delete cascade,
    platform text not null,
    content text not null default '',
    version integer not null default 1 check (version > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (draft_id, platform, version)
);

create index if not exists chunks_embedding_idx on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists documents_workspace_project_idx on documents (workspace_id, project_id);
create index if not exists chunks_document_version_idx on chunks (document_id, version_id);
create index if not exists facts_workspace_idx on facts (workspace_id);
create index if not exists tasks_workspace_date_idx on tasks (workspace_id, date);
create index if not exists drafts_workspace_idx on drafts (workspace_id);

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$
declare table_name text;
begin
    foreach table_name in array array['workspaces','projects','documents','document_versions','chunks','facts','tasks','drafts','draft_variants'] loop
        execute format('drop trigger if exists set_updated_at on %I', table_name);
        execute format('create trigger set_updated_at before update on %I for each row execute function set_updated_at()', table_name);
    end loop;
end;
$$;

insert into workspaces (id, name, owner_id) values
('00000000-0000-0000-0000-000000000001', 'personal', '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into projects (id, workspace_id, name, description) values
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'default', 'Default local development project')
on conflict (id) do nothing;
