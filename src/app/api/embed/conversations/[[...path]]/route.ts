import { NextResponse } from "next/server";

// Round 5 retired this namespace. Every method on every path returns
// 410 with a discoverable hint pointing at the new authenticated
// surface. See prompts/round-5/2-surface-split.md §"Step 5".
function gone() {
  return NextResponse.json(
    {
      error:
        "endpoint moved to /api/embed/customer/conversations and now requires a widget JWT. see prompts/round-5/6-host-integration.md",
    },
    { status: 410 },
  );
}

export const GET = async () => gone();
export const POST = async () => gone();
export const PUT = async () => gone();
export const PATCH = async () => gone();
export const DELETE = async () => gone();
