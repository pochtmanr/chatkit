-- =====================================================================
-- holylabs-chat-sdk · HubSpot link table — conversation_id type fix
--
-- Migration 0002 declared conversation_hubspot_links.conversation_id as
-- uuid, assuming chat conversations always have UUID ids. They don't —
-- the chat SDK uses arbitrary opaque strings (order ids like
-- "order:abc123", support thread keys like "support:user-42", etc).
-- Inserting non-UUID values into a uuid column rejects the row with
-- `invalid input syntax for type uuid`.
--
-- Switch to text. Existing rows (if any — there shouldn't be, since
-- every insert has been failing) get cast safely; uuid → text always
-- works.
--
-- Run in Supabase Dashboard → SQL Editor (project tqekzwpaxvnkbluhkjql).
-- =====================================================================

alter table conversation_hubspot_links
  alter column conversation_id type text using conversation_id::text;
