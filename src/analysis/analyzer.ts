import type { AppConfig } from "../shared/config.js";
import type { AnalysisResult, SignalEvent, Urgency } from "../shared/types.js";

export interface Analyzer {
  analyze(event: SignalEvent): Promise<AnalysisResult>;
}

function inferUrgency(score: number): Urgency {
  if (score >= 80) return "now";
  if (score >= 50) return "today";
  return "weekly";
}

function keywordScore(title: string, snippet: string): number {
  const text = `${title} ${snippet}`.toLowerCase();
  const hotWords = ["launch", "release", "breaking", "new", "api", "model", "shipping", "open source"];
  return hotWords.reduce((score, word) => score + (text.includes(word) ? 12 : 0), 20);
}

export function fallbackAnalysis(event: SignalEvent): AnalysisResult {
  const score = Math.min(100, keywordScore(event.title, event.contentSnippet));
  return {
    summary: `${event.author} posted about: ${event.title}`,
    whatIsGood: ["Potentially relevant update", "Fast to evaluate from source link"],
    whatIsBad: ["Could be hype without depth", "May not fit current stack"],
    howToUse: ["Read source in 2 minutes", "Tag as experiment or ignore"],
    whereToUse: ["Product discovery", "Engineering roadmap", "Content strategy"],
    whoShouldCare: "Builders tracking fast-moving dev and AI ecosystems",
    actionabilityScore: score,
    urgency: inferUrgency(score),
    confidence: 0.62
  };
}

export class MockAnalyzer implements Analyzer {
  async analyze(event: SignalEvent): Promise<AnalysisResult> {
    return fallbackAnalysis(event);
  }
}

const analysisResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    whatIsGood: { type: "array", items: { type: "string" } },
    whatIsBad: { type: "array", items: { type: "string" } },
    howToUse: { type: "array", items: { type: "string" } },
    whereToUse: { type: "array", items: { type: "string" } },
    whoShouldCare: { type: "string" },
    actionabilityScore: { type: "number" },
    urgency: { type: "string", enum: ["now", "today", "weekly"] },
    confidence: { type: "number" }
  },
  required: [
    "summary",
    "whatIsGood",
    "whatIsBad",
    "howToUse",
    "whereToUse",
    "whoShouldCare",
    "actionabilityScore",
    "urgency",
    "confidence"
  ]
} as const;

function normalizeResponse(payload: unknown, fallback: AnalysisResult): AnalysisResult {
  if (typeof payload !== "object" || payload === null) return fallback;
  const raw = payload as Partial<AnalysisResult>;

  const score =
    typeof raw.actionabilityScore === "number" ? Math.max(0, Math.min(100, raw.actionabilityScore)) : fallback.actionabilityScore;
  const urgency: Urgency =
    raw.urgency === "now" || raw.urgency === "today" || raw.urgency === "weekly" ? raw.urgency : inferUrgency(score);

  const toStringArray = (value: unknown, fb: string[]): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 5) : fb;

  return {
    summary: typeof raw.summary === "string" ? raw.summary : fallback.summary,
    whatIsGood: toStringArray(raw.whatIsGood, fallback.whatIsGood),
    whatIsBad: toStringArray(raw.whatIsBad, fallback.whatIsBad),
    howToUse: toStringArray(raw.howToUse, fallback.howToUse),
    whereToUse: toStringArray(raw.whereToUse, fallback.whereToUse),
    whoShouldCare: typeof raw.whoShouldCare === "string" ? raw.whoShouldCare : fallback.whoShouldCare,
    actionabilityScore: score,
    urgency,
    confidence: typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : fallback.confidence
  };
}

export class OpenAICompatibleAnalyzer implements Analyzer {
  constructor(private readonly config: AppConfig) {}

  async analyze(event: SignalEvent): Promise<AnalysisResult> {
    const fallback = fallbackAnalysis(event);

    if (!this.config.ENABLE_AI_ANALYSIS) {
      return fallback;
    }

    const prompt = [
      "Analyze this signal for a developer/creator intelligence inbox.",
      "Output JSON only.",
      `source: ${event.source}`,
      `author: ${event.author}`,
      `title: ${event.title}`,
      `snippet: ${event.contentSnippet}`,
      `url: ${event.url}`
    ].join("\n");

    try {
      const response = await fetch(`${this.config.AI_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.AI_API_KEY}`
        },
        body: JSON.stringify({
          model: this.config.AI_MODEL,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are a concise product+engineering analyst. Return strictly valid JSON with this schema and no prose."
            },
            {
              role: "user",
              content: JSON.stringify({ schema: analysisResponseSchema, signal: prompt })
            }
          ]
        })
      });

      if (!response.ok) {
        console.warn(`AI analyze request failed (${response.status}) for signal ${event.id}`);
        return fallback;
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = json.choices?.[0]?.message?.content;
      if (!content) return fallback;

      const parsed = JSON.parse(content) as unknown;
      return normalizeResponse(parsed, fallback);
    } catch (error) {
      console.warn(`AI analyze request error for signal ${event.id}`, error);
      return fallback;
    }
  }
}
