import { config } from "../config";
import { logger } from "../utils/logger";

const BASE = () => `https://graph.facebook.com/${config.meta.graphVersion}`;

export class GraphApiError extends Error {
  status: number;
  code?: number;
  subcode?: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
    const maybe = (payload as { error?: { code?: number; error_subcode?: number } } | undefined)?.error;
    this.code = maybe?.code;
    this.subcode = maybe?.error_subcode;
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, params: QueryParams): string {
  const url = new URL(path.startsWith("http") ? path : `${BASE()}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function request<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: QueryParams,
  body?: unknown
): Promise<T> {
  const url = buildUrl(path, params);
  const init: RequestInit = {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  };

  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    logger.warn("graph api error", { path, status: res.status, json });
    throw new GraphApiError(`Graph API ${method} ${path} failed (${res.status})`, res.status, json);
  }
  return json as T;
}

export interface PageListItem {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

export const graph = {
  exchangeCodeForToken: async (code: string): Promise<{ access_token: string; expires_in?: number }> => {
    return request("GET", "/oauth/access_token", {
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: config.meta.redirectUri,
      code,
    });
  },

  exchangeForLongLived: async (shortLived: string): Promise<{ access_token: string; expires_in?: number }> => {
    return request("GET", "/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      fb_exchange_token: shortLived,
    });
  },

  listPages: async (userAccessToken: string): Promise<PageListItem[]> => {
    const res = await request<{ data: PageListItem[] }>("GET", "/me/accounts", {
      access_token: userAccessToken,
      fields: "id,name,access_token,instagram_business_account",
    });
    return res.data ?? [];
  },

  debugToken: async (token: string, appToken: string): Promise<unknown> => {
    return request("GET", "/debug_token", {
      input_token: token,
      access_token: appToken,
    });
  },

  listRecentPosts: async (pageId: string, pageAccessToken: string, limit = 25) => {
    return request<{ data: Array<{ id: string; message?: string; created_time?: string; permalink_url?: string }> }>(
      "GET",
      `/${pageId}/posts`,
      {
        access_token: pageAccessToken,
        fields: "id,message,created_time,permalink_url",
        limit,
      }
    );
  },

  listPostComments: async (postId: string, pageAccessToken: string, limit = 50) => {
    return request<{
      data: Array<{
        id: string;
        from?: { id?: string; name?: string };
        message?: string;
        created_time?: string;
        parent?: { id: string };
      }>;
    }>("GET", `/${postId}/comments`, {
      access_token: pageAccessToken,
      fields: "id,from,message,created_time,parent",
      limit,
      order: "reverse_chronological",
    });
  },

  listIgMedia: async (igUserId: string, pageAccessToken: string, limit = 25) => {
    return request<{ data: Array<{ id: string; caption?: string; timestamp?: string; permalink?: string }> }>(
      "GET",
      `/${igUserId}/media`,
      {
        access_token: pageAccessToken,
        fields: "id,caption,timestamp,permalink",
        limit,
      }
    );
  },

  listIgMediaComments: async (mediaId: string, pageAccessToken: string, limit = 50) => {
    return request<{
      data: Array<{
        id: string;
        username?: string;
        text?: string;
        timestamp?: string;
        from?: { id?: string; username?: string };
      }>;
    }>("GET", `/${mediaId}/comments`, {
      access_token: pageAccessToken,
      fields: "id,username,text,timestamp,from",
      limit,
    });
  },

  hideComment: async (commentId: string, pageAccessToken: string): Promise<{ success: boolean }> => {
    return request("POST", `/${commentId}`, {
      access_token: pageAccessToken,
      is_hidden: true,
    });
  },

  unhideComment: async (commentId: string, pageAccessToken: string): Promise<{ success: boolean }> => {
    return request("POST", `/${commentId}`, {
      access_token: pageAccessToken,
      is_hidden: false,
    });
  },

  deleteComment: async (commentId: string, pageAccessToken: string): Promise<{ success: boolean }> => {
    return request("DELETE", `/${commentId}`, {
      access_token: pageAccessToken,
    });
  },

  replyToComment: async (
    commentId: string,
    message: string,
    pageAccessToken: string
  ): Promise<{ id: string }> => {
    return request("POST", `/${commentId}/comments`, {
      access_token: pageAccessToken,
      message,
    });
  },
};
