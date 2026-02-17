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

export class MockAnalyzer implements Analyzer {
  async analyze(event: SignalEvent): Promise<AnalysisResult> {
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
}
