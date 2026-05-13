-- =====================================================================
-- Chat users: avatar / display image URL.
--
-- Populated by the SDK on setCurrentUser(), shown in the FAB widget's
-- conversation header so agents know who they're talking to without
-- having to cross-reference the user id.
-- =====================================================================

alter table chat_users
  add column if not exists avatar_url text;
