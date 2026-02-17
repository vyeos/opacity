import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AI_API_KEY: z.string().min(1).optional(),
  AI_API_BASE: z.string().url().default("https://api.openai.com/v1"),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  RSS_FEEDS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    ),
  RSS_MAX_ITEMS: z.coerce.number().int().min(1).max(20).default(5),
  ENABLE_MOCK_SOCIAL: z.coerce.boolean().default(true),
  PRIORITY_THRESHOLD: z.coerce.number().min(0).max(100).default(80),
  HOURLY_THRESHOLD: z.coerce.number().min(0).max(100).default(50)
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  return configSchema.parse(process.env);
}
