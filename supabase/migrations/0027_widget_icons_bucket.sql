begin;

-- widget-icons bucket — mirrors business-logos:
--   - public read for the iframe.
--   - writes only via the service role from the dashboard server action.
--     We don't expose a client-side upload policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'widget-icons',
  'widget-icons',
  true,
  1 * 1024 * 1024,
  array['image/png','image/webp','image/svg+xml']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'widget_icons_public_read'
  ) then
    create policy widget_icons_public_read
      on storage.objects for select
      using ( bucket_id = 'widget-icons' );
  end if;
end $$;

commit;
