const DEFAULT_BASE = "https://chat-admin.holylabs.dev";

export type ClientOptions = {
  baseUrl: string;
  apiKey: string;
};

export function readOptionsFromEnv(): ClientOptions {
  const apiKey = process.env.CHATKIT_MCP_KEY;
  if (!apiKey) {
    console.error("[chatkit-mcp] CHATKIT_MCP_KEY env var is required.");
    console.error("Create one in Settings → MCP at https://chat-admin.holylabs.dev/dashboard/settings/mcp");
    process.exit(1);
  }
  const baseUrl = (process.env.CHATKIT_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "");
  return { baseUrl, apiKey };
}

export async function callTool<T = unknown>(opts: ClientOptions, tool: string, body: unknown): Promise<T> {
  const res = await fetch(`${opts.baseUrl}/api/mcp/${encodeURIComponent(tool)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
      /* */
    }
    throw new Error(`${tool} ${res.status}: ${message}`);
  }
  try {
    const json = JSON.parse(text) as { ok: boolean; data?: T; error?: string };
    if (!json.ok) throw new Error(json.error ?? "unknown error");
    return json.data as T;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("invalid response");
  }
}
