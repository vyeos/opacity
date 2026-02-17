import type { AppConfig } from "../shared/config.js";
import type { SignalEvent } from "../shared/types.js";

interface XUserResponse {
  data?: {
    id: string;
    username: string;
    name: string;
  };
}

interface XTweetsResponse {
  data?: Array<{
    id: string;
    text: string;
    created_at?: string;
  }>;
}

function makeTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 90) return normalized;
  return `${normalized.slice(0, 87)}...`;
}

function sanitizeSnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}

export class XCollector {
  constructor(private readonly config: AppConfig) {}

  async collect(): Promise<SignalEvent[]> {
    if (!this.config.X_BEARER_TOKEN || this.config.X_FOLLOWED_USERNAMES.length === 0) {
      return [];
    }

    const allSignals: SignalEvent[] = [];

    for (const username of this.config.X_FOLLOWED_USERNAMES) {
      try {
        const user = await this.fetchUser(username);
        if (!user?.id) {
          console.warn(`X user lookup returned no user for ${username}`);
          continue;
        }

        const tweets = await this.fetchTweets(user.id);
        for (const tweet of tweets) {
          const tweetUrl = `https://x.com/${user.username}/status/${tweet.id}`;
          const createdAt = tweet.created_at ?? new Date().toISOString();
          const text = sanitizeSnippet(tweet.text);

          allSignals.push({
            id: `x-${tweet.id}`,
            source: "x",
            author: `@${user.username}`,
            title: makeTitle(text),
            url: tweetUrl,
            contentSnippet: text,
            publishedAt: createdAt,
            tags: ["x", "social"]
          });
        }
      } catch (error) {
        console.warn(`X collector error for @${username}`, error);
      }
    }

    return allSignals;
  }

  private async fetchUser(username: string): Promise<{ id: string; username: string; name: string } | null> {
    const response = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}`, {
      headers: {
        authorization: `Bearer ${this.config.X_BEARER_TOKEN}`
      }
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`X user lookup failed (${response.status}) for ${username}: ${body}`);
      return null;
    }

    const json = (await response.json()) as XUserResponse;
    return json.data ?? null;
  }

  private async fetchTweets(userId: string): Promise<Array<{ id: string; text: string; created_at?: string }>> {
    const params = new URLSearchParams({
      max_results: String(this.config.X_MAX_ITEMS),
      "tweet.fields": "created_at",
      exclude: "replies,retweets"
    });

    const response = await fetch(`https://api.x.com/2/users/${encodeURIComponent(userId)}/tweets?${params.toString()}`, {
      headers: {
        authorization: `Bearer ${this.config.X_BEARER_TOKEN}`
      }
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`X tweets fetch failed (${response.status}) for user ${userId}: ${body}`);
      return [];
    }

    const json = (await response.json()) as XTweetsResponse;
    return json.data ?? [];
  }
}
