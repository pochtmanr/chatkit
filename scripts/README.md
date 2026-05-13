# Scripts

## migrate-firestore-chats.ts

One-time import of chat history from Firestore into Supabase. Idempotent
— re-running skips already-imported rows.

### Prerequisites

1. Apply the SQL migration that adds the idempotency columns:

   ```sh
   psql "$DATABASE_URL" -f supabase/migrations/0009_firestore_migration_ids.sql
   ```

   Or paste it into the Supabase SQL editor.

2. Have ready:
   - `FIREBASE_SERVICE_ACCOUNT` — full JSON of a Firebase service account
     with read access to the `messages`, `users`, and `orders`
     collections. You already have this on your LocalDelivery Vercel —
     copy the same value.
   - `SUPABASE_URL` — your chat-admin Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key for that project
     (Supabase dashboard → Settings → API). **Not** the anon key.
   - `TENANT_ID` — the chat-admin tenant UUID the chats belong to.
     Currently: `9cb99e94-828e-41ec-ab47-46a0064c6a82`.

### Running

```sh
cd holylabs-chat-admin
export FIREBASE_SERVICE_ACCOUNT='{...}'
export SUPABASE_URL='https://...supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='ey...'
export TENANT_ID='9cb99e94-828e-41ec-ab47-46a0064c6a82'

npx tsx scripts/migrate-firestore-chats.ts
```

Progress prints per conversation. Total takes a few minutes for a few
thousand messages; longer if the dataset is large.

### What it imports

- **Support chats** at `messages/<user>/<admin>/<msgId>` (and the
  reverse `<admin>/<user>` pair) → `conversations.kind = 'support'`,
  one conversation per end-user.
- **Order chats** at `orders/<orderId>/orderMessages/<msgId>` →
  `conversations.kind = 'order'`, one conversation per order, with
  participants `[clientId, deliveryManId]`.

### Re-running after a failure

Safe. The `firestore_id` unique index on `messages` + `conversations`
ensures every doc is imported at most once. Subsequent runs will
report `inserted=0 skipped=N` for fully-imported threads.
