begin;

-- 1. Columns.
alter table businesses
  add column if not exists logo_url        text,
  add column if not exists address_line1   text,
  add column if not exists address_line2   text,
  add column if not exists city            text,
  add column if not exists region          text,
  add column if not exists postal_code     text,
  add column if not exists country         text,
  add column if not exists contact_email   text,
  add column if not exists contact_phone   text,
  add column if not exists website_url     text,
  add column if not exists about           text;

-- Optional sanity check: country is ISO-3166-1 alpha-2 when set.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_country_iso_chk'
  ) then
    alter table businesses
      add constraint businesses_country_iso_chk
        check (country is null or country ~ '^[A-Z]{2}$');
  end if;
end $$;

-- 2. Storage bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-logos',
  'business-logos',
  true,                                                  -- public read
  5 * 1024 * 1024,                                       -- 5 MB
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do nothing;

-- 3. Storage policies.
--    Public read of every object in the bucket.
--    Writes (insert/update/delete) only via the service role; we don't
--    expose a client-side upload path. The server action uploads via
--    getServiceClient(), which carries the service key, bypassing RLS.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'business_logos_public_read'
  ) then
    create policy business_logos_public_read
      on storage.objects for select
      using ( bucket_id = 'business-logos' );
  end if;
end $$;

commit;
