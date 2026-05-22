"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const COOKIE = "workbench_manager";
const COOKIE_OPTS = {
  httpOnly: false,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/** Toggles the owner-only "manager view" preference. The cookie is
 *  readable from the browser so the client toggle can mirror state on
 *  first paint without a round-trip; it's set httpOnly: false on purpose
 *  for that reason. */
export async function setManagerView(on: boolean): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, on ? "1" : "0", COOKIE_OPTS);
  revalidatePath("/workbench", "layout");
}
