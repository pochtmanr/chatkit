import { NextResponse } from "next/server";

// Reserves the /api/embed/agent/* namespace so customer code never lands
// here by mistake. The real agent embed API is round 6's scope; until
// then every method on every subpath returns 501 with a discoverable
// message. Grep for "/api/embed/agent" to find the boundary.
function notImplemented() {
  return NextResponse.json(
    { error: "agent embed API is reserved for round 6" },
    { status: 501 },
  );
}

export const GET = async () => notImplemented();
export const POST = async () => notImplemented();
export const PUT = async () => notImplemented();
export const PATCH = async () => notImplemented();
export const DELETE = async () => notImplemented();
