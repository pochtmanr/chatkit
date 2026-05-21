import { z } from "zod";

type JsonSchema = Record<string, unknown>;

export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      properties[k] = leafSchema(v);
      if (!v.isOptional()) required.push(k);
    }
    return {
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    };
  }
  return leafSchema(schema);
}

function leafSchema(s: z.ZodTypeAny): JsonSchema {
  if (s instanceof z.ZodOptional || s instanceof z.ZodNullable) {
    return leafSchema(s._def.innerType);
  }
  if (s instanceof z.ZodString) return { type: "string" };
  if (s instanceof z.ZodNumber) return { type: "number" };
  if (s instanceof z.ZodBoolean) return { type: "boolean" };
  if (s instanceof z.ZodEnum) return { type: "string", enum: s._def.values };
  if (s instanceof z.ZodArray) return { type: "array", items: leafSchema(s._def.type) };
  if (s instanceof z.ZodObject) return zodToJsonSchema(s);
  return { type: "string" };
}
