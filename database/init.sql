CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  jira_project_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(trim(name)) BETWEEN 1 AND 300),
  CHECK (
    jira_project_key IS NULL
    OR (jira_project_key = upper(jira_project_key) AND length(trim(jira_project_key)) BETWEEN 1 AND 100)
  )
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  jira_url TEXT NOT NULL,
  jira_key TEXT NOT NULL UNIQUE COLLATE NOCASE,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK (length(trim(jira_url)) BETWEEN 1 AND 2048),
  CHECK (length(trim(jira_key)) BETWEEN 1 AND 100),
  CHECK (jira_key = upper(jira_key)),
  CHECK (length(trim(summary)) BETWEEN 1 AND 300),
  CHECK (
    (status = 'done' AND completed_at IS NOT NULL)
    OR (status <> 'done' AND completed_at IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS work_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  worked_on TEXT NOT NULL,
  note TEXT NOT NULL,
  minutes_spent INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(trim(note)) BETWEEN 1 AND 2000),
  CHECK (minutes_spent IS NULL OR minutes_spent BETWEEN 1 AND 1440)
);

CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_updated_at_idx ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS work_logs_task_id_idx ON work_logs(task_id);
CREATE INDEX IF NOT EXISTS work_logs_worked_on_idx ON work_logs(worked_on);
