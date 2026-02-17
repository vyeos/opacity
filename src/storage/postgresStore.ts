import type { DeliveryAttempt, EnrichedSignal, SourceKind } from "../shared/types.js";
import type { Store } from "./store.js";

interface PgQueryResult<T = Record<string, unknown>> {
  rows: T[];
}

interface PgPool {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PgQueryResult<T>>;
  end(): Promise<void>;
}

function normalizeSource(value: string): SourceKind | null {
  if (value === "youtube" || value === "x" || value === "rss" || value === "github") {
    return value;
  }
  return null;
}

export class PostgresStore implements Store {
  private pool: PgPool | null = null;

  constructor(private readonly connectionString: string) {}

  async init(): Promise<void> {
    let PoolCtor: new (opts: { connectionString: string }) => PgPool;

    try {
      const runtimeRequire = eval("require") as (name: string) => unknown;
      ({ Pool: PoolCtor } = runtimeRequire("pg") as { Pool: new (opts: { connectionString: string }) => PgPool });
    } catch {
      throw new Error('Postgres driver not installed. Run "pnpm add pg" before using STORAGE_DRIVER=postgres.');
    }

    this.pool = new PoolCtor({ connectionString: this.connectionString });

    await this.query(`
      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        author TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        content_snippet TEXT NOT NULL,
        published_at TEXT NOT NULL,
        tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS analysis (
        signal_id TEXT PRIMARY KEY REFERENCES signals(id) ON DELETE CASCADE,
        summary TEXT NOT NULL,
        what_is_good_json JSONB NOT NULL,
        what_is_bad_json JSONB NOT NULL,
        how_to_use_json JSONB NOT NULL,
        where_to_use_json JSONB NOT NULL,
        who_should_care TEXT NOT NULL,
        actionability_score DOUBLE PRECISION NOT NULL,
        urgency TEXT NOT NULL,
        confidence DOUBLE PRECISION NOT NULL,
        analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS deliveries (
        id BIGSERIAL PRIMARY KEY,
        signal_id TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS mutes (
        source TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async close(): Promise<void> {
    if (!this.pool) return;
    await this.pool.end();
    this.pool = null;
  }

  async hasSignal(signalId: string): Promise<boolean> {
    const result = await this.query<{ id: string }>("SELECT id FROM signals WHERE id = $1 LIMIT 1", [signalId]);
    return result.rows.length > 0;
  }

  async saveEnrichedSignal(signal: EnrichedSignal): Promise<void> {
    await this.query("BEGIN");

    try {
      await this.query(
        `INSERT INTO signals (id, source, author, title, url, content_snippet, published_at, tags_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [
          signal.event.id,
          signal.event.source,
          signal.event.author,
          signal.event.title,
          signal.event.url,
          signal.event.contentSnippet,
          signal.event.publishedAt,
          JSON.stringify(signal.event.tags ?? [])
        ]
      );

      await this.query(
        `INSERT INTO analysis (
          signal_id, summary, what_is_good_json, what_is_bad_json, how_to_use_json, where_to_use_json,
          who_should_care, actionability_score, urgency, confidence
        ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10)
        ON CONFLICT (signal_id) DO UPDATE SET
          summary = EXCLUDED.summary,
          what_is_good_json = EXCLUDED.what_is_good_json,
          what_is_bad_json = EXCLUDED.what_is_bad_json,
          how_to_use_json = EXCLUDED.how_to_use_json,
          where_to_use_json = EXCLUDED.where_to_use_json,
          who_should_care = EXCLUDED.who_should_care,
          actionability_score = EXCLUDED.actionability_score,
          urgency = EXCLUDED.urgency,
          confidence = EXCLUDED.confidence,
          analyzed_at = NOW()`,
        [
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
        ]
      );

      await this.query("COMMIT");
    } catch (error) {
      await this.query("ROLLBACK");
      throw error;
    }
  }

  async recordDeliveries(signalId: string, attempts: DeliveryAttempt[]): Promise<void> {
    if (attempts.length === 0) return;

    await this.query("BEGIN");
    try {
      for (const attempt of attempts) {
        await this.query(
          `INSERT INTO deliveries (signal_id, channel, status, error_message)
           VALUES ($1, $2, $3, $4)`,
          [signalId, attempt.channel, attempt.status, attempt.errorMessage ?? null]
        );
      }
      await this.query("COMMIT");
    } catch (error) {
      await this.query("ROLLBACK");
      throw error;
    }
  }

  async getMutedSources(): Promise<SourceKind[]> {
    const result = await this.query<{ source: string }>("SELECT source FROM mutes");
    return result.rows
      .map((row) => normalizeSource(row.source))
      .filter((value): value is SourceKind => value !== null);
  }

  async muteSource(source: SourceKind): Promise<void> {
    await this.query("INSERT INTO mutes (source) VALUES ($1) ON CONFLICT (source) DO NOTHING", [source]);
  }

  async getSignalSummary(signalId: string): Promise<string | null> {
    const result = await this.query<{ title: string; summary: string; how_to_use_json: unknown }>(
      `SELECT s.title, a.summary, a.how_to_use_json
       FROM signals s
       JOIN analysis a ON a.signal_id = s.id
       WHERE s.id = $1 LIMIT 1`,
      [signalId]
    );

    const row = result.rows[0];
    if (!row) return null;

    const howToUse = Array.isArray(row.how_to_use_json)
      ? row.how_to_use_json.filter((value): value is string => typeof value === "string")
      : [];

    return [`${row.title}`, `Why it matters: ${row.summary}`, `How to use: ${howToUse.join("; ")}`].join("\n");
  }

  private async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PgQueryResult<T>> {
    if (!this.pool) {
      throw new Error("PostgresStore not initialized");
    }
    return this.pool.query<T>(sql, params);
  }
}
