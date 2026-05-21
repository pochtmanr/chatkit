import { z } from "zod";

export const ListConversationsInput = z.object({
  inbox_id: z.string().uuid().optional(),
  status: z.enum(["new", "active", "waiting_customer", "waiting_support", "done", "transferred"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const GetConversationInput = z.object({
  conversation_id: z.string().uuid(),
});

export const ListMessagesInput = z.object({
  conversation_id: z.string().uuid(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const SendReplyInput = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().min(1).max(8000),
});

export const ChangeStatusInput = z.object({
  conversation_id: z.string().uuid(),
  status: z.enum(["new", "active", "waiting_customer", "waiting_support", "done", "transferred"]),
});

export const GetStatsInput = z.object({
  range: z.enum(["7d", "30d", "90d", "all"]).optional(),
});

export const SearchMessagesInput = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(100).optional(),
});

export const EmptyInput = z.object({});
