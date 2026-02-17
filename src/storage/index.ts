import type { AppConfig } from "../shared/config.js";
import type { Store } from "./store.js";
import { SqliteStore } from "./sqliteStore.js";

export function createStore(config: AppConfig): Store {
  return new SqliteStore(config.SQLITE_DB_PATH);
}
