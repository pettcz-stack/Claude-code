import { config } from "../config";

const FB_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_engagement",
  "pages_manage_posts",
  "pages_read_user_content",
  "instagram_basic",
  "instagram_manage_comments",
];

export function buildAuthUrl(state: string): string {
  const url = new URL(`https://www.facebook.com/${config.meta.graphVersion}/dialog/oauth`);
  url.searchParams.set("client_id", config.meta.appId);
  url.searchParams.set("redirect_uri", config.meta.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", FB_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}
