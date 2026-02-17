import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    ENABLE_AI_ANALYSIS: z.coerce.boolean().default(false),
    AI_API_KEY: z.string().min(1).optional(),
    AI_API_BASE: z.string().url().default("https://api.openai.com/v1"),
    AI_MODEL: z.string().default("gpt-4o-mini"),
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_CHAT_ID: z.string().min(1).optional(),
    TELEGRAM_WEBHOOK_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
    STORAGE_DRIVER: z.enum(["sqlite", "postgres"]).default("sqlite"),
    POSTGRES_URL: z.string().optional(),
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

    if (config.STORAGE_DRIVER === "postgres" && !config.POSTGRES_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["POSTGRES_URL"],
        message: "POSTGRES_URL is required when STORAGE_DRIVER=postgres"
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  return configSchema.parse(process.env);
}
