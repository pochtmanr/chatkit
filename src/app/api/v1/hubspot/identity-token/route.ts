import { NextResponse, type NextRequest } from "next/server";
import { createHmac } from "node:crypto";

/**
 * HubSpot Visitor Identification token endpoint.
 *
 * The mobile app calls this after the user logs in so it can hand the
 * resulting token to HubSpot's iOS SDK via
 * `HubspotManager.shared.setUserIdentity(identityToken:email:)`. HubSpot
 * then trusts that the device token belongs to this verified user and
 * can target pushes / persist chat history per identity.
 *
 * Algorithm: HMAC-SHA256(message = email, key = visitor identification
 * secret). The secret is configured in HubSpot under Settings →
 * Conversations → Channels → Live Chat → Use external messaging
 * identification. We read it from the HUBSPOT_VISITOR_IDENTITY_SECRET
 * env var.
 *
 * Reference: https://developers.hubspot.com/docs/api/conversation/visitor-identification
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const secret = process.env.HUBSPOT_VISITOR_IDENTITY_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "server missing HUBSPOT_VISITOR_IDENTITY_SECRET" },
      { status: 500, headers: corsHeaders },
    );
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json(
      { error: "invalid json" },
      { status: 400, headers: corsHeaders },
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "email required" },
      { status: 400, headers: corsHeaders },
    );
  }

  // Hex-encoded HMAC-SHA256 of the email, keyed on the tenant's
  // visitor-identification secret. HubSpot's SDK verifies the same
  // signature server-side when associating the device with a user.
  const token = createHmac("sha256", secret).update(email).digest("hex");

  return NextResponse.json(
    { email, identityToken: token },
    { headers: corsHeaders },
  );
}
