create extension if not exists citext;
create extension if not exists pgcrypto;

create type task_status as enum ('todo', 'in_progress', 'done');

create table projects (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  jira_project_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_length check (char_length(btrim(name::text)) between 1 and 300),
  constraint projects_jira_key_uppercase check (
    jira_project_key is null
    or (jira_project_key = upper(jira_project_key) and char_length(btrim(jira_project_key)) between 1 and 100)
  )
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  jira_url text not null,
  jira_key text not null unique,
  summary text not null,
  status task_status not null default 'todo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint tasks_jira_url_length check (char_length(btrim(jira_url)) between 1 and 2048),
  constraint tasks_jira_url_valid check (jira_url ~* '^https?://[^[:space:]]+$'),
  constraint tasks_jira_key_length check (char_length(btrim(jira_key)) between 1 and 100),
  constraint tasks_jira_key_uppercase check (jira_key = upper(jira_key)),
  constraint tasks_summary_length check (char_length(btrim(summary)) between 1 and 300)
);

alter table tasks add constraint tasks_completion_consistent check (
  (status = 'done' and completed_at is not null)
  or (status <> 'done' and completed_at is null)
);

create table work_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  worked_on date not null,
  note text not null,
  minutes_spent integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_logs_note_length check (char_length(btrim(note)) between 1 and 2000)
);

alter table work_logs add constraint work_logs_minutes_range check (
  minutes_spent is null or minutes_spent between 1 and 1440
);

create index tasks_status_idx on tasks(status);
create index tasks_project_id_idx on tasks(project_id);
create index tasks_updated_at_idx on tasks(updated_at desc);
create index work_logs_task_id_idx on work_logs(task_id);
create index work_logs_worked_on_idx on work_logs(worked_on desc);

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
before update on projects
for each row execute function set_updated_at();

create trigger tasks_set_updated_at
before update on tasks
for each row execute function set_updated_at();

create trigger work_logs_set_updated_at
before update on work_logs
for each row execute function set_updated_at();
