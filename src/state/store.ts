import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { SourceKind } from "../shared/types.js";

export interface AppState {
  seenEventIds: string[];
  mutedSources: SourceKind[];
}

const defaultState: AppState = {
  seenEventIds: [],
  mutedSources: []
};

export class StateStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<AppState> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<AppState>;
      return {
        seenEventIds: Array.isArray(parsed.seenEventIds)
          ? parsed.seenEventIds.filter((id): id is string => typeof id === "string")
          : [],
        mutedSources: Array.isArray(parsed.mutedSources)
          ? parsed.mutedSources.filter(
              (source): source is SourceKind =>
                source === "youtube" || source === "x" || source === "rss" || source === "github"
            )
          : []
      };
    } catch {
      return { ...defaultState };
    }
  }

  async save(state: AppState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf-8");
  }

  async appendSeenEvent(state: AppState, eventId: string, maxIds = 5000): Promise<AppState> {
    if (state.seenEventIds.includes(eventId)) {
      return state;
    }

    const nextState: AppState = {
      ...state,
      seenEventIds: [eventId, ...state.seenEventIds].slice(0, maxIds)
    };

    await this.save(nextState);
    return nextState;
  }
}
