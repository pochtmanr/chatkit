import { z } from "zod";
import {
  ListConversationsInput,
  GetConversationInput,
  ListMessagesInput,
  SendReplyInput,
  ChangeStatusInput,
  GetStatsInput,
  SearchMessagesInput,
  EmptyInput,
} from "./types.js";
import { callTool, type ClientOptions } from "./client.js";

export type ToolDef<I extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  inputSchema: I;
  remoteName: string;
  formatResult: (data: unknown) => string;
};

function asJson(data: unknown): string {
  return "```json\n" + JSON.stringify(data, null, 2) + "\n```";
}

export const TOOLS: ToolDef[] = [
  {
    name: "list_businesses",
    description: "List businesses this MCP key has access to. Currently always returns one — the business the key belongs to.",
    inputSchema: EmptyInput,
    remoteName: "list_businesses",
    formatResult: asJson,
  },
  {
    name: "list_inboxes",
    description: "List active inboxes in the business. Each inbox is an integration unit with its own API key and webhook URL.",
    inputSchema: EmptyInput,
    remoteName: "list_inboxes",
    formatResult: asJson,
  },
  {
    name: "list_conversations",
    description: "List conversations. Filter by inbox_id and/or status. Defaults to 50 most-recent across all inboxes.",
    inputSchema: ListConversationsInput,
    remoteName: "list_conversations",
    formatResult: asJson,
  },
  {
    name: "get_conversation",
    description: "Fetch one conversation with its 50 most recent messages and metadata.",
    inputSchema: GetConversationInput,
    remoteName: "get_conversation",
    formatResult: asJson,
  },
  {
    name: "list_messages",
    description: "Paginated message history for a conversation. Returns up to `limit` messages in chronological order.",
    inputSchema: ListMessagesInput,
    remoteName: "list_messages",
    formatResult: asJson,
  },
  {
    name: "send_reply",
    description: "Post a reply to the conversation as the agent. Returns the new message id. Triggers an outbound webhook + flips the conversation to waiting_customer.",
    inputSchema: SendReplyInput,
    remoteName: "send_reply",
    formatResult: asJson,
  },
  {
    name: "change_status",
    description: "Update the conversation status. Allowed values: new, active, waiting_customer, waiting_support, done, transferred. Fires the conversation_status_changed webhook.",
    inputSchema: ChangeStatusInput,
    remoteName: "change_status",
    formatResult: asJson,
  },
  {
    name: "list_chat_users",
    description: "End-users (customers) in the business. PII — only call when you actually need it.",
    inputSchema: EmptyInput,
    remoteName: "list_chat_users",
    formatResult: asJson,
  },
  {
    name: "get_stats",
    description: "Aggregate stats for the business over a time range (7d, 30d, 90d, all). Includes conversation counts, resolution times, per-inbox breakdown.",
    inputSchema: GetStatsInput,
    remoteName: "get_stats",
    formatResult: asJson,
  },
  {
    name: "search_messages",
    description: "Case-insensitive substring search across message bodies in the business. Returns up to `limit` matches.",
    inputSchema: SearchMessagesInput,
    remoteName: "search_messages",
    formatResult: asJson,
  },
];

export async function runTool(opts: ClientOptions, tool: ToolDef, args: unknown): Promise<string> {
  const parsed = tool.inputSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join("; ")}`;
  }
  const data = await callTool(opts, tool.remoteName, parsed.data);
  return tool.formatResult(data);
}
