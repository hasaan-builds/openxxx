import crypto from 'node:crypto';
import type { AccountProfile, PostItem } from '../src/lib/types';

interface PendingPkce {
  verifier: string;
  redirectUri: string;
  createdAt: number;
}

const pkceStore = new Map<string, PendingPkce>();

export function isXOAuthConfigured(): boolean {
  return Boolean(process.env.X_CLIENT_ID?.trim());
}

export function getDefaultCallbackUrl(): string {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/auth/x/callback`;
}

export function createXOAuthUrl(redirectUri: string): string {
  const clientId = process.env.X_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error(
      'X_CLIENT_ID is not configured yet. Add your free X Developer Client ID in environment variables, or stay in Safe Sandbox Mode.'
    );
  }

  const state = crypto.randomBytes(16).toString('hex');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  pkceStore.set(state, { verifier, redirectUri, createdAt: Date.now() });
  // Prune old entries (>15 min)
  for (const [key, val] of pkceStore.entries()) {
    if (Date.now() - val.createdAt > 15 * 60 * 1000) pkceStore.delete(key);
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  return `https://x.com/i/oauth2/authorize?${params.toString()}`;
}

export async function exchangeXCodeForTokens(
  code: string,
  state: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  user?: { id: string; name: string; username: string };
}> {
  const pending = pkceStore.get(state);
  if (!pending) {
    throw new Error('OAuth session expired or invalid state. Please try connecting again.');
  }
  pkceStore.delete(state);

  const clientId = process.env.X_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.X_CLIENT_SECRET?.trim() || '';

  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: pending.redirectUri,
    code_verifier: pending.verifier,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }

  const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || 'Failed to exchange X authorization code.');
  }

  let user: { id: string; name: string; username: string } | undefined;
  try {
    const meRes = await fetch('https://api.x.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (meRes.ok) {
      const meJson = (await meRes.json()) as { data?: { id: string; name: string; username: string } };
      user = meJson.data;
    }
  } catch {
    // Non-fatal if /users/me fails
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : undefined,
    user,
  };
}

/**
 * Automatically renews the X OAuth 2.0 access token using the stored refresh_token
 * so scheduled autopilot posts continue seamlessly without expiring after 2 hours.
 */
export async function refreshXAccessTokenIfNeeded(
  account: AccountProfile
): Promise<{ refreshed: boolean; accessToken?: string; refreshToken?: string; expiresAt?: string }> {
  if (!account.xAccessToken) return { refreshed: false };
  if (!account.xRefreshToken || !account.xTokenExpiresAt) {
    return { refreshed: false, accessToken: account.xAccessToken };
  }

  const expiresMs = new Date(account.xTokenExpiresAt).getTime();
  // Refresh if expiring within 5 minutes
  if (Number.isFinite(expiresMs) && expiresMs - Date.now() > 5 * 60 * 1000) {
    return { refreshed: false, accessToken: account.xAccessToken };
  }

  const clientId = process.env.X_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.X_CLIENT_SECRET?.trim() || '';
  if (!clientId) {
    return { refreshed: false, accessToken: account.xAccessToken };
  }

  const body = new URLSearchParams({
    refresh_token: account.xRefreshToken,
    grant_type: 'refresh_token',
    client_id: clientId,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }

  const res = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  if (!res.ok) {
    return { refreshed: false, accessToken: account.xAccessToken };
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    return { refreshed: false, accessToken: account.xAccessToken };
  }

  account.xAccessToken = data.access_token;
  if (data.refresh_token) account.xRefreshToken = data.refresh_token;
  if (data.expires_in) {
    account.xTokenExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  }

  return {
    refreshed: true,
    accessToken: account.xAccessToken,
    refreshToken: account.xRefreshToken,
    expiresAt: account.xTokenExpiresAt,
  };
}

/**
 * Publishes a single tweet or chained thread via Official X API v2
 * (or runs cleanly in Safe Sandbox Mode when X is not connected).
 */
export async function publishPostToX(
  post: PostItem,
  account: AccountProfile
): Promise<{ mode: 'sandbox' | 'live'; tweetIds: string[]; tokenRefreshed?: boolean }> {
  const isLive = account.xConnected && account.xMode === 'live' && Boolean(account.xAccessToken);

  if (!isLive) {
    // Safe Sandbox Mode — zero accidental live tweets before X OAuth is armed
    const fakeIds = post.blocks.map((_, i) => `sandbox-${Date.now()}-${i + 1}`);
    return { mode: 'sandbox', tweetIds: fakeIds };
  }

  const refreshResult = await refreshXAccessTokenIfNeeded(account);
  const accessToken = refreshResult.accessToken || account.xAccessToken!;

  const tweetIds: string[] = [];
  let replyToId: string | undefined;

  for (const block of post.blocks) {
    const payload: Record<string, unknown> = { text: block };
    if (replyToId) {
      payload.reply = { in_reply_to_tweet_id: replyToId };
    }

    const res = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json()) as { data?: { id: string }; detail?: string; title?: string };
    if (!res.ok || !json.data?.id) {
      if (res.status === 402 || res.status === 403) {
        throw new Error(
          `X API (${res.status}): ${json.detail || json.title || 'Check that your X Developer App has Read+Write permissions and active Pay-Per-Use credits under console.x.com -> Billing.'}`
        );
      }
      throw new Error(json.detail || json.title || `X API v2 returned status ${res.status}`);
    }

    tweetIds.push(json.data.id);
    replyToId = json.data.id;
  }

  // If Auto-Plug is enabled with immediate/short delay (<= 1 min), chain plug reply right away
  if (post.automations.autoPlugEnabled && post.automations.autoPlugText.trim() && replyToId) {
    try {
      const plugRes = await fetch('https://api.x.com/2/tweets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: post.automations.autoPlugText.trim(),
          reply: { in_reply_to_tweet_id: replyToId },
        }),
      });
      if (plugRes.ok) {
        const plugJson = (await plugRes.json()) as { data?: { id: string } };
        if (plugJson.data?.id) tweetIds.push(plugJson.data.id);
      }
    } catch {
      // Auto-plug failure shouldn't fail main post
    }
  }

  return { mode: 'live', tweetIds, tokenRefreshed: refreshResult.refreshed };
}
