export type SourceKind = "youtube" | "x" | "rss" | "github";

export type Urgency = "now" | "today" | "weekly";

export interface SignalEvent {
  id: string;
  source: SourceKind;
  author: string;
  title: string;
  url: string;
  contentSnippet: string;
  publishedAt: string;
  tags?: string[];
}

export interface AnalysisResult {
  summary: string;
  whatIsGood: string[];
  whatIsBad: string[];
  howToUse: string[];
  whereToUse: string[];
  whoShouldCare: string;
  actionabilityScore: number;
  urgency: Urgency;
  confidence: number;
}

export interface EnrichedSignal {
  event: SignalEvent;
  analysis: AnalysisResult;
}

export interface NotificationTarget {
  menubar: boolean;
  telegram: boolean;
}

export type DeliveryChannel = "menubar" | "telegram";
export type DeliveryStatus = "sent" | "skipped" | "failed";

export interface DeliveryAttempt {
  channel: DeliveryChannel;
  status: DeliveryStatus;
  errorMessage?: string;
}
