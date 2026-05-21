import "server-only";
import argon2 from "argon2";
import { randomBytes, timingSafeEqual } from "node:crypto";

const PREFIX = "mcp_live_";

export type KeyParts = {
  raw: string;
  prefix: string;
};

export function generateKey(): KeyParts {
  const body = randomBytes(16).toString("hex");
  const raw = `${PREFIX}${body}`;
  return { raw, prefix: raw.slice(0, 16) };
}

export async function hashKey(raw: string): Promise<string> {
  return argon2.hash(raw, { type: argon2.argon2id });
}

export async function verifyKey(
  rawProvided: string,
  hashStored: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hashStored, rawProvided);
  } catch {
    return false;
  }
}

export function extractKeyFromAuthHeader(
  authHeader: string | null,
): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(mcp_live_[0-9a-f]{32})\s*$/i.exec(authHeader);
  return match?.[1] ?? null;
}

export function prefixOf(raw: string): string {
  return raw.slice(0, 16);
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
