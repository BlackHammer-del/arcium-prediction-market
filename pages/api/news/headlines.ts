import type { NextApiRequest, NextApiResponse } from "next";
import { MARKET_CATEGORIES, type MarketCategory } from "../../../lib/shared/market-types";

interface NewsHeadline {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  summary?: string;
}

const CATEGORY_QUERIES: Record<MarketCategory, string> = {
  Crypto: "crypto OR bitcoin OR ethereum regulation",
  Football: "premier league OR champions league OR football transfer",
  Politics: "election OR senate OR parliament policy bill",
  Macro: "inflation OR central bank OR rates OR unemployment",
  Tech: "artificial intelligence OR big tech OR semiconductor",
};

const FALLBACK_HEADLINES: NewsHeadline[] = [
  {
    title: "Federal Reserve signals data-dependent stance ahead of next meeting",
    source: "Fallback Feed",
    publishedAt: "2026-03-05T10:00:00.000Z",
    url: "https://example.com/macro-fed-preview",
    summary: "Macro uncertainty remains elevated, supporting rate-path prediction markets.",
  },
  {
    title: "Major exchange reports rising BTC derivatives open interest",
    source: "Fallback Feed",
    publishedAt: "2026-03-05T08:00:00.000Z",
    url: "https://example.com/crypto-open-interest",
    summary: "Crypto volatility headlines can seed short-horizon probability markets.",
  },
  {
    title: "Top clubs enter late-stage talks before transfer deadline",
    source: "Fallback Feed",
    publishedAt: "2026-03-04T21:00:00.000Z",
    url: "https://example.com/football-transfer-window",
    summary: "Football event flow supports frequent outcome-based market creation.",
  },
];

function parseCategory(value: string | string[] | undefined): MarketCategory | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  return MARKET_CATEGORIES.includes(raw as MarketCategory) ? (raw as MarketCategory) : undefined;
}

function parseLimit(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 8;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 8;
  return Math.max(1, Math.min(parsed, 20));
}

function normalizeNewsApiHeadlines(payload: any): NewsHeadline[] {
  if (!Array.isArray(payload?.articles)) return [];
  return payload.articles
    .filter((article: any) => typeof article?.title === "string" && typeof article?.url === "string")
    .map((article: any) => ({
      title: article.title,
      source: article?.source?.name ?? "NewsAPI",
      publishedAt: article?.publishedAt ?? new Date().toISOString(),
      url: article.url,
      summary: typeof article?.description === "string" ? article.description : undefined,
    }));
}

function normalizeGNewsHeadlines(payload: any): NewsHeadline[] {
  if (!Array.isArray(payload?.articles)) return [];
  return payload.articles
    .filter((article: any) => typeof article?.title === "string" && typeof article?.url === "string")
    .map((article: any) => ({
      title: article.title,
      source: article?.source?.name ?? "GNews",
      publishedAt: article?.publishedAt ?? new Date().toISOString(),
      url: article.url,
      summary: typeof article?.description === "string" ? article.description : undefined,
    }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: `Method ${req.method ?? "UNKNOWN"} Not Allowed` });
    return;
  }

  const category = parseCategory(req.query.category);
  const limit = parseLimit(req.query.limit);
  const provider = (process.env.NEWS_API_PROVIDER ?? "gnews").toLowerCase();
  const apiKey = process.env.NEWS_API_KEY;
  const query = category ? CATEGORY_QUERIES[category] : "breaking news markets odds policy sports";

  if (!apiKey) {
    res.status(200).json({
      provider: "fallback",
      query,
      headlines: FALLBACK_HEADLINES.slice(0, limit),
      note: "Set NEWS_API_KEY and optional NEWS_API_PROVIDER=newsapi|gnews for live data.",
    });
    return;
  }

  try {
    let url = "";
    let headers: Record<string, string> = {};

    if (provider === "newsapi") {
      url =
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}` +
        `&language=en&pageSize=${limit}&sortBy=publishedAt`;
      headers = { "X-Api-Key": apiKey };
    } else {
      url =
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}` +
        `&lang=en&max=${limit}&token=${encodeURIComponent(apiKey)}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Live news provider responded with ${response.status}`);
    }

    const payload = await response.json();
    const headlines =
      provider === "newsapi" ? normalizeNewsApiHeadlines(payload) : normalizeGNewsHeadlines(payload);

    res.status(200).json({
      provider,
      query,
      headlines: headlines.slice(0, limit),
    });
    return;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unable to fetch live news.";
    res.status(200).json({
      provider: "fallback",
      query,
      headlines: FALLBACK_HEADLINES.slice(0, limit),
      note: message,
    });
  }
}
