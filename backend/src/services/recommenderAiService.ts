import { env } from "../config/env.js";

export type RecommenderAssistantProvider = "CLOUDFLARE" | "GROQ" | "DETERMINISTIC";

export type RecommenderAssistantEvidence = {
  actionType: "RESTOCK" | "REDUCE_REPLENISHMENT" | "EXPIRY_REVIEW";
  expiryRiskQuantity: number;
  incomingStock: number;
  productName: string;
  rationale: string;
  recommendationSource: string;
  recommendedQuantity: number;
  riskLevel: string;
  sellableStock: number;
  sku: string;
};

export type RecommenderAssistantResult = {
  generatedAt: string;
  provider: RecommenderAssistantProvider;
  summary: string;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
let cached:
  | {
      expiresAt: number;
      key: string;
      value: RecommenderAssistantResult;
    }
  | null = null;

export async function buildRecommenderAssistant(
  evidence: RecommenderAssistantEvidence[]
): Promise<RecommenderAssistantResult> {
  const normalized = evidence.slice(0, 8);
  const key = JSON.stringify(normalized);
  const now = Date.now();
  if (cached && cached.key === key && cached.expiresAt > now) return cached.value;

  const deterministic = deterministicSummary(normalized);
  const result = await tryConfiguredProvider(normalized).catch(() => null);
  const value =
    result ??
    ({
      generatedAt: new Date().toISOString(),
      provider: "DETERMINISTIC",
      summary: deterministic
    } satisfies RecommenderAssistantResult);

  cached = { expiresAt: now + CACHE_TTL_MS, key, value };
  return value;
}

async function tryConfiguredProvider(
  evidence: RecommenderAssistantEvidence[]
): Promise<RecommenderAssistantResult | null> {
  if (env.RECOMMENDER_AI_PROVIDER === "disabled" || evidence.length === 0) return null;

  if (
    (env.RECOMMENDER_AI_PROVIDER === "auto" || env.RECOMMENDER_AI_PROVIDER === "cloudflare") &&
    env.CLOUDFLARE_AI_ACCOUNT_ID &&
    env.CLOUDFLARE_AI_API_TOKEN &&
    env.CLOUDFLARE_AI_MODEL
  ) {
    const cloudflare = await callCloudflare(evidence);
    if (cloudflare) return cloudflare;
  }

  if (
    (env.RECOMMENDER_AI_PROVIDER === "auto" || env.RECOMMENDER_AI_PROVIDER === "groq") &&
    env.GROQ_API_KEY &&
    env.GROQ_AI_MODEL
  ) {
    const groq = await callGroq(evidence);
    if (groq) return groq;
  }

  return null;
}

async function callCloudflare(
  evidence: RecommenderAssistantEvidence[]
): Promise<RecommenderAssistantResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.RECOMMENDER_AI_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_AI_ACCOUNT_ID}/ai/run/${env.CLOUDFLARE_AI_MODEL}`,
      {
        body: JSON.stringify({
          messages: [
            { role: "system", content: assistantSystemPrompt() },
            { role: "user", content: JSON.stringify(evidence) }
          ],
          temperature: 0.1
        }),
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_AI_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        method: "POST",
        signal: controller.signal
      }
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      result?: { response?: string };
      success?: boolean;
    };
    const summary = payload.result?.response?.trim();
    if (!payload.success || !summary) return null;
    return {
      generatedAt: new Date().toISOString(),
      provider: "CLOUDFLARE",
      summary: sanitizeSummary(summary)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGroq(
  evidence: RecommenderAssistantEvidence[]
): Promise<RecommenderAssistantResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.RECOMMENDER_AI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      body: JSON.stringify({
        max_tokens: 220,
        messages: [
          { role: "system", content: assistantSystemPrompt() },
          { role: "user", content: JSON.stringify(evidence) }
        ],
        model: env.GROQ_AI_MODEL,
        temperature: 0.1
      }),
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const summary = payload.choices?.[0]?.message?.content?.trim();
    if (!summary) return null;
    return {
      generatedAt: new Date().toISOString(),
      provider: "GROQ",
      summary: sanitizeSummary(summary)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function assistantSystemPrompt() {
  return [
    "You are the concise decision-assistance layer of an inventory recommender system.",
    "Use only the structured evidence supplied by the application.",
    "Do not invent demand, stock, prices, causes, quantities, or dates.",
    "Never change the recommended quantity calculated by the deterministic engine.",
    "Summarize the highest-priority inventory action and the evidence behind it in at most 80 words.",
    "If evidence is insufficient, say that monitoring is recommended instead of guessing."
  ].join(" ");
}

function deterministicSummary(evidence: RecommenderAssistantEvidence[]) {
  if (evidence.length === 0) {
    return "No inventory recommendation currently requires owner action. Forecast demand is covered by the present replenishment policy.";
  }

  const totalUnits = evidence.reduce(
    (sum, item) => sum + Math.max(0, item.recommendedQuantity),
    0
  );
  const critical = evidence.filter((item) => item.riskLevel === "CRITICAL").length;
  const high = evidence.filter((item) => item.riskLevel === "HIGH").length;
  const top = evidence[0]!;
  const priority =
    critical > 0
      ? `${critical} critical`
      : high > 0
        ? `${high} high-priority`
        : `${evidence.length} active`;

  const unitSummary =
    totalUnits > 0
      ? `, including ${totalUnits.toLocaleString()} suggested replenishment unit${totalUnits === 1 ? "" : "s"}`
      : "";
  return `${priority} inventory recommendation${evidence.length === 1 ? "" : "s"} require review${unitSummary}. Highest priority: ${top.productName} — ${top.rationale}`;
}

function sanitizeSummary(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 900);
}
