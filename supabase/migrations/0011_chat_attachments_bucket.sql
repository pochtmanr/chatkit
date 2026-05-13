-- =====================================================================
-- Storage bucket for chat attachments.
--
-- - Public read so message bubble <img> tags can load the URL without
--   signing (chat messages reference the URL by value).
-- - Inserts are restricted; only the service role can write (the
--   widget proxies uploads through /api/embed/conversations/:id/upload
--   on chat-admin so we can do auth + size checks server-side).
--
-- Apply manually in Supabase SQL editor.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do update set public = excluded.public;

-- RLS policies: anyone can SELECT (public read); only service role
-- can INSERT/UPDATE/DELETE. We don't expose a direct-upload path to
-- the browser.
do $$
begin
  -- public read
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'chat_attachments_public_read'
  ) then
    create policy chat_attachments_public_read on storage.objects
      for select using (bucket_id = 'chat-attachments');
  end if;
end $$;
