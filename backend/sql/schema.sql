create extension if not exists vector;

create table if not exists workspaces (
    id uuid primary key,
    workspace_id uuid not null,
    owner_id uuid not null,
    project_id uuid,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists projects (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    owner_id uuid not null,
    project_id uuid,
    name text not null,
    description text,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists documents (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    owner_id uuid not null,
    project_id uuid references projects(id) on delete set null,
    title text not null,
    document_type text not null default 'markdown',
    source_type text not null default 'local_file',
    source_url text,
    current_version_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists document_versions (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    owner_id uuid not null,
    project_id uuid references projects(id) on delete set null,
    document_id uuid not null references documents(id) on delete cascade,
    version_number integer not null,
    content text not null,
    storage_path text,
    source_path text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (document_id, version_number)
);

alter table document_versions add column if not exists storage_path text;

do $$
begin
    if not exists (
        select 1
        from information_schema.table_constraints
        where constraint_name = 'documents_current_version_fk'
    ) then
        alter table documents
            add constraint documents_current_version_fk
            foreign key (current_version_id)
            references document_versions(id)
            on delete set null;
    end if;
end;
$$;

create table if not exists chunks (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    owner_id uuid not null,
    project_id uuid references projects(id) on delete set null,
    document_id uuid not null references documents(id) on delete cascade,
    version_id uuid not null references document_versions(id) on delete cascade,
    content text not null,
    embedding vector(1536) not null,
    chunk_index integer not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (version_id, chunk_index)
);

create index if not exists chunks_embedding_idx
    on chunks
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

create index if not exists documents_workspace_project_idx
    on documents (workspace_id, project_id);

create index if not exists chunks_document_version_idx
    on chunks (document_id, version_id);

create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists set_workspaces_updated_at on workspaces;
create trigger set_workspaces_updated_at
before update on workspaces
for each row execute function set_updated_at();

drop trigger if exists set_projects_updated_at on projects;
create trigger set_projects_updated_at
before update on projects
for each row execute function set_updated_at();

drop trigger if exists set_documents_updated_at on documents;
create trigger set_documents_updated_at
before update on documents
for each row execute function set_updated_at();

drop trigger if exists set_document_versions_updated_at on document_versions;
create trigger set_document_versions_updated_at
before update on document_versions
for each row execute function set_updated_at();

drop trigger if exists set_chunks_updated_at on chunks;
create trigger set_chunks_updated_at
before update on chunks
for each row execute function set_updated_at();

insert into workspaces (id, workspace_id, owner_id, name)
values (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'personal'
)
on conflict (id) do nothing;

insert into projects (id, workspace_id, owner_id, project_id, name, description)
values (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'default',
    'Default local development project'
)
on conflict (id) do nothing;
