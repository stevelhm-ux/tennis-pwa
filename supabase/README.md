# Supabase Setup

1. Create a Supabase project.
2. In SQL editor, run `schema.sql`.
3. Enable Email (magic link) and optionally Apple/Google providers.
4. Create a workspace and add yourself as owner:
```sql
insert into public.workspaces (name) values ('Family Team') returning id;
-- Replace ids
insert into public.workspace_members (workspace_id, user_id, role) values ('<workspace_uuid>', '<your_auth_users_id>', 'owner');
```
5. Put keys in `.env`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
6. Start the app; points will sync and stream in real-time.
