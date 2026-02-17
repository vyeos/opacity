import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { DeliveryAttempt, EnrichedSignal, SourceKind } from "../shared/types.js";

export class SqliteStore {
  private db: DatabaseSync | null = null;

  constructor(private readonly dbPath: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        author TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        content_snippet TEXT NOT NULL,
        published_at TEXT NOT NULL,
        tags_json TEXT,
        collected_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS analysis (
        signal_id TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        what_is_good_json TEXT NOT NULL,
        what_is_bad_json TEXT NOT NULL,
        how_to_use_json TEXT NOT NULL,
        where_to_use_json TEXT NOT NULL,
        who_should_care TEXT NOT NULL,
        actionability_score REAL NOT NULL,
        urgency TEXT NOT NULL,
        confidence REAL NOT NULL,
        analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(signal_id) REFERENCES signals(id)
      );

      CREATE TABLE IF NOT EXISTS deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signal_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(signal_id) REFERENCES signals(id)
      );

      CREATE TABLE IF NOT EXISTS mutes (
        source TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  async hasSignal(signalId: string): Promise<boolean> {
    const row = this.assertDb()
      .prepare("SELECT id FROM signals WHERE id = ? LIMIT 1")
      .get(signalId) as { id?: string } | undefined;
    return Boolean(row?.id);
  }

  async saveEnrichedSignal(signal: EnrichedSignal): Promise<void> {
    const db = this.assertDb();
    try {
      db.exec("BEGIN");
      db.prepare(
        `INSERT OR IGNORE INTO signals (id, source, author, title, url, content_snippet, published_at, tags_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        signal.event.id,
        signal.event.source,
        signal.event.author,
        signal.event.title,
        signal.event.url,
        signal.event.contentSnippet,
        signal.event.publishedAt,
        JSON.stringify(signal.event.tags ?? [])
      );

      db.prepare(
        `INSERT INTO analysis (
            signal_id, summary, what_is_good_json, what_is_bad_json, how_to_use_json, where_to_use_json,
            who_should_care, actionability_score, urgency, confidence
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(signal_id) DO UPDATE SET
            summary=excluded.summary,
            what_is_good_json=excluded.what_is_good_json,
            what_is_bad_json=excluded.what_is_bad_json,
            how_to_use_json=excluded.how_to_use_json,
            where_to_use_json=excluded.where_to_use_json,
            who_should_care=excluded.who_should_care,
            actionability_score=excluded.actionability_score,
            urgency=excluded.urgency,
            confidence=excluded.confidence,
            analyzed_at=datetime('now')`
      ).run(
        signal.event.id,
        signal.analysis.summary,
        JSON.stringify(signal.analysis.whatIsGood),
        JSON.stringify(signal.analysis.whatIsBad),
        JSON.stringify(signal.analysis.howToUse),
        JSON.stringify(signal.analysis.whereToUse),
        signal.analysis.whoShouldCare,
        signal.analysis.actionabilityScore,
        signal.analysis.urgency,
        signal.analysis.confidence
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  async recordDeliveries(signalId: string, attempts: DeliveryAttempt[]): Promise<void> {
    if (attempts.length === 0) return;

    const db = this.assertDb();
    const stmt = db.prepare(
      `INSERT INTO deliveries (signal_id, channel, status, error_message)
       VALUES (?, ?, ?, ?)`
    );

    try {
      db.exec("BEGIN");
      for (const attempt of attempts) {
        stmt.run(signalId, attempt.channel, attempt.status, attempt.errorMessage ?? null);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  async getMutedSources(): Promise<SourceKind[]> {
    const rows = this.assertDb().prepare("SELECT source FROM mutes").all() as Array<{ source: string }>;
    return rows
      .map((row) => row.source)
      .filter((source): source is SourceKind =>
        source === "youtube" || source === "x" || source === "rss" || source === "github"
      );
  }

  async muteSource(source: SourceKind): Promise<void> {
    this.assertDb().prepare("INSERT OR IGNORE INTO mutes (source) VALUES (?)").run(source);
  }

  async getSignalSummary(signalId: string): Promise<string | null> {
    const row = this.assertDb()
      .prepare(
        `SELECT s.title, a.summary, a.how_to_use_json
         FROM signals s
         JOIN analysis a ON a.signal_id = s.id
         WHERE s.id = ? LIMIT 1`
      )
      .get(signalId) as { title: string; summary: string; how_to_use_json: string } | undefined;

    if (!row) return null;

    const howToUse = JSON.parse(row.how_to_use_json) as string[];
    return [`${row.title}`, `Why it matters: ${row.summary}`, `How to use: ${howToUse.join("; ")}`].join("\n");
  }

  private assertDb(): DatabaseSync {
    if (!this.db) {
      throw new Error("SqliteStore not initialized");
    }
    return this.db;
  }
}
