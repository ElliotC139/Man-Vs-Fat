import { config } from "../config";

// developer.whoop.com is unreachable from this sandbox's egress proxy, so
// these endpoint paths and response shapes are implemented from published
// third-party references (community client libraries, API changelog search
// results) rather than a direct read of WHOOP's own docs. fetchRecentCycles
// logs the raw response on any parse failure so a real mismatch is easy to
// spot and patch from Fly logs rather than failing silently.
const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API_BASE = "https://api.prod.whoop.com/developer/v2";
const SCOPES = "read:cycles offline";
const KJ_PER_KCAL = 4.184;

function redirectUri(): string {
  return `${config.APP_BASE_URL}/api/whoop/callback`;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.WHOOP_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface WhoopTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

async function requestToken(body: Record<string, string>): Promise<WhoopTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.WHOOP_CLIENT_ID!,
      client_secret: config.WHOOP_CLIENT_SECRET!,
      ...body,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WHOOP token request failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export function exchangeCodeForTokens(code: string): Promise<WhoopTokens> {
  return requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
}

export function refreshAccessToken(refreshToken: string): Promise<WhoopTokens> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export interface WhoopCycleRecord {
  whoopCycleId: bigint;
  whoopUserId: bigint;
  start: Date;
  end: Date | null;
  kcalBurned: number | null;
  scoreState: string;
}

interface RawCycleRecord {
  id: number | string;
  user_id: number | string;
  start: string;
  end?: string | null;
  score_state?: string;
  score?: { kilojoule?: number } | null;
}

/** Fetches all cycles starting on/after `since`, following pagination. */
export async function fetchRecentCycles(accessToken: string, since: Date): Promise<WhoopCycleRecord[]> {
  const records: WhoopCycleRecord[] = [];
  let nextToken: string | undefined;

  do {
    const params = new URLSearchParams({ limit: "25", start: since.toISOString() });
    if (nextToken) params.set("nextToken", nextToken);

    const res = await fetch(`${API_BASE}/cycle?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`WHOOP cycle fetch failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { records?: RawCycleRecord[]; next_token?: string | null };
    for (const r of data.records ?? []) {
      try {
        const scoreState = r.score_state ?? "UNSCORABLE";
        const kilojoule = r.score?.kilojoule;
        records.push({
          whoopCycleId: BigInt(r.id),
          whoopUserId: BigInt(r.user_id),
          start: new Date(r.start),
          end: r.end ? new Date(r.end) : null,
          kcalBurned: scoreState === "SCORED" && typeof kilojoule === "number" ? Math.round(kilojoule / KJ_PER_KCAL) : null,
          scoreState,
        });
      } catch (parseError) {
        console.error("WHOOP cycle record didn't match the expected shape:", parseError, JSON.stringify(r));
      }
    }
    nextToken = data.next_token ?? undefined;
  } while (nextToken);

  return records;
}
