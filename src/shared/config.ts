import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    ENABLE_AI_ANALYSIS: z.coerce.boolean().default(false),
    AI_API_KEY: z.string().min(1).optional(),
    AI_API_BASE: z.string().url().default("https://generativelanguage.googleapis.com/v1beta/openai"),
    AI_MODEL: z.string().default("gemini-2.0-flash"),
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_CHAT_ID: z.string().min(1).optional(),
    ENABLE_TELEGRAM_WEBHOOK: z.coerce.boolean().default(false),
    TELEGRAM_WEBHOOK_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
    RUN_CONTINUOUS: z.coerce.boolean().default(false),
    RUN_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    ENABLE_X_COLLECTION: z.coerce.boolean().default(false),
    X_BEARER_TOKEN: z.string().optional(),
    X_FOLLOWED_USERNAMES: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((entry) => entry.trim().replace(/^@/, ""))
          .filter((entry) => entry.length > 0)
      ),
    X_MAX_ITEMS: z.coerce.number().int().min(1).max(20).default(5),
    YOUTUBE_CHANNEL_IDS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      ),
    YOUTUBE_MAX_ITEMS: z.coerce.number().int().min(1).max(20).default(3),
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
    SQLITE_DB_PATH: z.string().default("./data/opacity.db"),
    PRIORITY_THRESHOLD: z.coerce.number().min(0).max(100).default(80),
    HOURLY_THRESHOLD: z.coerce.number().min(0).max(100).default(50)
  })
  .superRefine((config, ctx) => {
    if (config.ENABLE_AI_ANALYSIS && !config.AI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AI_API_KEY"],
        message: "AI_API_KEY is required when ENABLE_AI_ANALYSIS=true"
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  return configSchema.parse(process.env);
}
