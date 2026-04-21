import { config } from "../config";

// Google OAuth 2.0 scopes for Business Profile.
// https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews
const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "openid",
  "email",
  "profile",
];

export function buildAuthUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.google.clientId);
  url.searchParams.set("redirect_uri", config.google.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: config.google.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as GoogleTokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
  }
  return (await res.json()) as GoogleTokens;
}
