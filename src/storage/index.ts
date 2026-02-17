import type { AppConfig } from "../shared/config.js";
import type { Store } from "./store.js";
import { PostgresStore } from "./postgresStore.js";
import { SqliteStore } from "./sqliteStore.js";

export function createStore(config: AppConfig): Store {
  if (config.STORAGE_DRIVER === "postgres") {
    return new PostgresStore(config.POSTGRES_URL as string);
  }

  return new SqliteStore(config.SQLITE_DB_PATH);
}
