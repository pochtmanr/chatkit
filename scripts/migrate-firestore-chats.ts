/**
 * One-time migration: copy chat history from Firestore into Supabase.
 *
 * Imports two kinds of conversations:
 *   1. Support: messages/{userUid}/{adminUid} (and the reverse pair)
 *      → conversations.kind = 'support', external_ref = userUid
 *   2. Order: orders/{orderId}/orderMessages
 *      → conversations.kind = 'order', external_ref = orderId
 *
 * Idempotent: each conversation + message carries a `firestore_id`
 * unique-per-tenant. Re-runs skip already-imported rows. Safe to
 * re-run after a partial failure.
 *
 * Run:
 *   FIREBASE_SERVICE_ACCOUNT='{...}' \
 *   SUPABASE_URL='https://xyz.supabase.co' \
 *   SUPABASE_SERVICE_ROLE_KEY='ey...' \
 *   TENANT_ID='9cb99e94-828e-41ec-ab47-46a0064c6a82' \
 *   npx tsx scripts/migrate-firestore-chats.ts
 *
 * Prerequisites:
 *   - Migration 0009_firestore_migration_ids.sql applied
 *   - Firebase service account with read access to messages/* and orders/*
 *   - Supabase service role key (NOT anon — RLS bypass needed for inserts)
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore, type DocumentSnapshot } from "firebase-admin/firestore";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ADMIN_ROLES = new Set(["super_admin", "store_admin"]);

interface FirestoreMessage {
  id: string;
  senderUid?: string;
  senderId?: string;
  receiverId?: string;
  message?: string;
  attachments?: string[];
  messageType?: string;
  createdAt?: { toDate: () => Date } | Date | number | string;
  isMessageRead?: boolean;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function tsToISO(ts: FirestoreMessage["createdAt"]): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === "object" && "toDate" in ts) return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  if (typeof ts === "number") return new Date(ts).toISOString();
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  }
  return new Date().toISOString();
}

function senderOf(m: FirestoreMessage): string | null {
  return m.senderUid ?? m.senderId ?? null;
}

// ---------------------------------------------------------------------
// Conversation upsert — finds-or-creates by (tenant, kind, external_ref)
// ---------------------------------------------------------------------
async function ensureConversation(
  sb: SupabaseClient,
  tenantId: string,
  kind: "support" | "order",
  externalRef: string,
  participants: string[],
): Promise<string> {
  const { data: existing } = await sb
    .from("conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("kind", kind)
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: inserted, error } = await sb
    .from("conversations")
    .insert({
      tenant_id: tenantId,
      kind,
      external_ref: externalRef,
      participants,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    throw new Error(
      `failed to create conversation (${kind}/${externalRef}): ${error?.message ?? "no row"}`,
    );
  }
  return inserted.id;
}

// ---------------------------------------------------------------------
// Message insert (idempotent via firestore_id)
// ---------------------------------------------------------------------
async function insertMessages(
  sb: SupabaseClient,
  tenantId: string,
  conversationId: string,
  messages: FirestoreMessage[],
): Promise<{ inserted: number; skipped: number }> {
  if (messages.length === 0) return { inserted: 0, skipped: 0 };
  const rows = messages
    .filter((m) => senderOf(m) !== null) // can't migrate without a sender
    .map((m) => ({
      tenant_id: tenantId,
      conversation_id: conversationId,
      sender_id: senderOf(m)!,
      receiver_id: m.receiverId ?? null,
      body: m.message ?? null,
      message_type: m.messageType === "image" ? "image" : "text",
      media_url:
        Array.isArray(m.attachments) && m.attachments.length > 0
          ? m.attachments[0]
          : null,
      created_at: tsToISO(m.createdAt),
      firestore_id: m.id,
    }));

  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  // upsert on the (tenant, firestore_id) unique index. Re-runs skip.
  const { data, error } = await sb
    .from("messages")
    .upsert(rows, {
      onConflict: "tenant_id,firestore_id",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) throw new Error(`insert messages failed: ${error.message}`);

  const inserted = data?.length ?? 0;
  return { inserted, skipped: rows.length - inserted };
}

// ---------------------------------------------------------------------
// Stage 1: support chats — messages/{a}/{b}/{msgId}
// ---------------------------------------------------------------------
async function migrateSupportChats(
  fs: Firestore,
  sb: SupabaseClient,
  tenantId: string,
): Promise<void> {
  console.log("[support] Loading admin UIDs...");
  const adminsSnap = await fs
    .collection("users")
    .where("role", "in", ["super_admin", "store_admin"])
    .get();
  const adminUids = adminsSnap.docs.map((d) => d.id);
  // Also include any user flagged superAdmin: true (legacy role-less data)
  const superSnap = await fs
    .collection("users")
    .where("superAdmin", "==", true)
    .get();
  superSnap.docs.forEach((d) => {
    if (!adminUids.includes(d.id)) adminUids.push(d.id);
  });
  console.log(`[support] Found ${adminUids.length} admin UIDs`);

  // The Firestore layout is messages/{senderId}/{receiverId}/{msgId}.
  // Top-level docs in `messages/` are placeholder docs — what we want is
  // the subcollections under each. Iterating all top-level docs surfaces
  // every "thread owner" (both admins-as-sender and users-as-sender).
  const ownersSnap = await fs.collection("messages").get();
  console.log(`[support] Found ${ownersSnap.size} thread owners`);

  // Build map of userUid → admin pair → messages (merged from both
  // directions so we collapse them into one Supabase conversation).
  const supportByUser = new Map<string, FirestoreMessage[]>();

  for (const ownerDoc of ownersSnap.docs) {
    const ownerUid = ownerDoc.id;
    const isAdminOwner = adminUids.includes(ownerUid);
    const subcols = await ownerDoc.ref.listCollections();
    for (const sub of subcols) {
      const otherUid = sub.id;
      const isAdminOther = adminUids.includes(otherUid);
      if (isAdminOwner === isAdminOther) continue; // user-to-user or admin-to-admin: skip
      const userUid = isAdminOwner ? otherUid : ownerUid;

      const msgsSnap = await sub.orderBy("createdAt", "asc").get();
      if (msgsSnap.empty) continue;
      const messages: FirestoreMessage[] = msgsSnap.docs.map(
        (d: DocumentSnapshot) => ({ id: d.id, ...d.data() }) as FirestoreMessage,
      );
      const existing = supportByUser.get(userUid) ?? [];
      existing.push(...messages);
      supportByUser.set(userUid, existing);
    }
  }

  let totalInserted = 0;
  let totalSkipped = 0;
  for (const [userUid, messages] of supportByUser) {
    const sorted = messages.slice().sort(
      (a, b) => Date.parse(tsToISO(a.createdAt)) - Date.parse(tsToISO(b.createdAt)),
    );
    const convId = await ensureConversation(sb, tenantId, "support", userUid, [
      userUid,
    ]);
    const { inserted, skipped } = await insertMessages(
      sb,
      tenantId,
      convId,
      sorted,
    );
    totalInserted += inserted;
    totalSkipped += skipped;
    console.log(
      `[support] user=${userUid} conv=${convId.slice(0, 8)} inserted=${inserted} skipped=${skipped}`,
    );

    // Cache last_message preview on the conversation.
    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1];
      await sb
        .from("conversations")
        .update({
          last_message: last.message ?? "[image]",
          last_at: tsToISO(last.createdAt),
        })
        .eq("id", convId);
    }
  }
  console.log(
    `[support] DONE — inserted=${totalInserted} skipped=${totalSkipped} conversations=${supportByUser.size}`,
  );
}

// ---------------------------------------------------------------------
// Stage 2: order chats — orders/{orderId}/orderMessages/{msgId}
// ---------------------------------------------------------------------
async function migrateOrderChats(
  fs: Firestore,
  sb: SupabaseClient,
  tenantId: string,
): Promise<void> {
  console.log("[order] Loading orders...");
  const ordersSnap = await fs.collection("orders").get();
  console.log(`[order] Found ${ordersSnap.size} orders`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let convsCreated = 0;
  for (const orderDoc of ordersSnap.docs) {
    const orderId = orderDoc.id;
    const order = orderDoc.data();
    const msgsSnap = await orderDoc.ref
      .collection("orderMessages")
      .orderBy("createdAt", "asc")
      .get();
    if (msgsSnap.empty) continue;

    const messages: FirestoreMessage[] = msgsSnap.docs.map(
      (d: DocumentSnapshot) => ({ id: d.id, ...d.data() }) as FirestoreMessage,
    );
    const participants = [
      order.clientId,
      order.deliveryManId ?? order.driverId,
    ].filter((v): v is string => !!v);

    const convId = await ensureConversation(
      sb,
      tenantId,
      "order",
      orderId,
      participants,
    );
    convsCreated += 1;
    const { inserted, skipped } = await insertMessages(
      sb,
      tenantId,
      convId,
      messages,
    );
    totalInserted += inserted;
    totalSkipped += skipped;
    console.log(
      `[order] order=${orderId} conv=${convId.slice(0, 8)} inserted=${inserted} skipped=${skipped}`,
    );

    const last = messages[messages.length - 1];
    await sb
      .from("conversations")
      .update({
        last_message: last.message ?? "[image]",
        last_at: tsToISO(last.createdAt),
      })
      .eq("id", convId);
  }
  console.log(
    `[order] DONE — inserted=${totalInserted} skipped=${totalSkipped} conversations=${convsCreated}`,
  );
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------
async function main(): Promise<void> {
  const serviceAccount: ServiceAccount = JSON.parse(requireEnv("FIREBASE_SERVICE_ACCOUNT"));
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const tenantId = requireEnv("TENANT_ID");

  initializeApp({ credential: cert(serviceAccount) });
  const fs = getFirestore();
  const sb = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  console.log(`Migrating into tenant ${tenantId}`);
  await migrateSupportChats(fs, sb, tenantId);
  await migrateOrderChats(fs, sb, tenantId);
  console.log("ALL DONE");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
