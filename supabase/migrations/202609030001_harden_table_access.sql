-- Apply the server-only access policy to projects that already ran the initial
-- migration before RLS was added there. These statements are idempotent.
alter table projects enable row level security;
alter table tasks enable row level security;
alter table work_logs enable row level security;

revoke all on table projects from anon, authenticated;
revoke all on table tasks from anon, authenticated;
revoke all on table work_logs from anon, authenticated;
