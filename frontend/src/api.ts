export interface Classification {
  id: string;
  category: "spam" | "vulgarity" | "brand_attack" | "legitimate_criticism" | "neutral" | "positive";
  confidence: number;
  reasoning: string;
  recommendedAction: "hide" | "delete" | "keep" | "review";
  detectedLanguage?: string | null;
  modelUsed: string;
  classifiedAt: string;
}

export interface ActionRecord {
  id: string;
  actionType: "hide" | "delete" | "keep" | "reply" | "unhide";
  performedBy: string;
  performedAt: string;
  success: boolean;
  errorMessage?: string | null;
}

export interface CommentItem {
  id: string;
  text: string;
  authorName: string | null;
  authorId: string | null;
  status: "new" | "classified" | "actioned" | "ignored";
  fetchedAt: string;
  createdAtPlatform: string | null;
  post: {
    id: string;
    platformPostId: string;
    permalink: string | null;
    contentPreview: string | null;
    account: {
      id: string;
      platform: "FB" | "IG";
      pageName: string;
    };
  };
  classification: Classification | null;
  actions: ActionRecord[];
}

export interface Account {
  id: string;
  platform: "FB" | "IG";
  pageId: string;
  pageName: string;
  active: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Rule {
  id: string;
  name: string;
  category: string;
  minConfidence: number;
  action: "hide" | "delete";
  enabled: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listComments: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    return request<{ items: CommentItem[]; total: number }>(`/api/comments?${qs.toString()}`);
  },
  summary: () =>
    request<{
      totalPending: number;
      actioned24h: number;
      byCategoryLast7d: Array<{ category: string; count: number }>;
    }>("/api/comments/stats/summary"),
  action: (id: string, action: string, replyMessage?: string) =>
    request<{ success: boolean; error?: string }>(`/api/comments/${id}/action`, {
      method: "POST",
      body: JSON.stringify({ action, replyMessage }),
    }),
  getComment: (id: string) =>
    request<{
      id: string;
      text: string;
      authorName: string | null;
      authorId: string | null;
      status: string;
      fetchedAt: string;
      createdAtPlatform: string | null;
      platformCommentId: string;
      post: {
        id: string;
        platformPostId: string;
        permalink: string | null;
        contentPreview: string | null;
        account: { id: string; platform: string; pageName: string };
      };
      classifications: Array<{
        id: string;
        category: string;
        confidence: number;
        reasoning: string;
        recommendedAction: string;
        detectedLanguage: string | null;
        modelUsed: string;
        classifiedAt: string;
      }>;
      actions: Array<{
        id: string;
        actionType: string;
        performedBy: string;
        performedAt: string;
        success: boolean;
        errorMessage: string | null;
      }>;
    }>(`/api/comments/${id}`),
  suggestReply: (id: string) =>
    request<{ suggestion: string }>(`/api/comments/${id}/suggest-reply`, { method: "POST" }),
  listTemplates: (category?: string) =>
    request<
      Array<{
        id: string;
        name: string;
        category: string | null;
        body: string;
        language: string | null;
        enabled: boolean;
      }>
    >(`/api/templates${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  renderTemplate: (id: string, vars: Record<string, string>) =>
    request<{ rendered: string }>(`/api/templates/${id}/render`, {
      method: "POST",
      body: JSON.stringify({ vars }),
    }),
  reclassify: (id: string, smart = false) =>
    request<{ id: string; category: string; confidence: number }>(`/api/comments/${id}/reclassify`, {
      method: "POST",
      body: JSON.stringify({ smart }),
    }),
  bulkAction: (ids: string[], action: string) =>
    request<{ results: Array<{ id: string; success: boolean; error?: string }> }>(
      `/api/comments/bulk-action`,
      {
        method: "POST",
        body: JSON.stringify({ ids, action }),
      }
    ),
  listAccounts: () => request<Account[]>("/api/accounts"),
  patchAccount: (id: string, body: { active?: boolean }) =>
    request<Account>(`/api/accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAccount: (id: string) => request<{ ok: true }>(`/api/accounts/${id}`, { method: "DELETE" }),
  triggerFetch: (id: string) =>
    request<{ accountId: string; postsSeen: number; newComments: number; errors: number }>(
      `/api/accounts/${id}/fetch`,
      { method: "POST" }
    ),
  listRules: () => request<Rule[]>("/api/rules"),
  createRule: (body: Omit<Rule, "id">) =>
    request<Rule>("/api/rules", { method: "POST", body: JSON.stringify(body) }),
  updateRule: (id: string, body: Partial<Omit<Rule, "id">>) =>
    request<Rule>(`/api/rules/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRule: (id: string) => request<{ ok: true }>(`/api/rules/${id}`, { method: "DELETE" }),
  getPause: () => request<{ paused: boolean }>("/api/rules/settings/pause"),
  setPause: (paused: boolean) =>
    request<{ paused: boolean }>("/api/rules/settings/pause", {
      method: "POST",
      body: JSON.stringify({ paused }),
    }),
  listLists: () =>
    request<Array<{ id: string; kind: string; value: string; createdAt: string }>>("/api/rules/lists"),
  addListEntry: (kind: string, value: string) =>
    request<{ id: string }>("/api/rules/lists", {
      method: "POST",
      body: JSON.stringify({ kind, value }),
    }),
  deleteListEntry: (id: string) =>
    request<{ ok: true }>(`/api/rules/lists/${id}`, { method: "DELETE" }),
  listEvidence: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    return request<{
      items: Array<{
        id: string;
        commentId: string;
        category: string;
        capturedAt: string;
        contentHash: string;
        permalinkAtCapture: string | null;
      }>;
    }>(`/api/audit/evidence?${qs.toString()}`);
  },
  listActions: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    return request<{
      items: Array<
        ActionRecord & {
          comment: {
            text: string;
            authorName: string | null;
            post: { account: { platform: string; pageName: string } };
          };
        }
      >;
    }>(`/api/audit/actions?${qs.toString()}`);
  },
  adminStatus: () =>
    request<{ activeAccounts: number; pending: number; actions24h: number }>("/api/admin/status"),
  adminTestNotify: () => request<{ ok: true }>("/api/admin/test-notification", { method: "POST" }),
  adminPollRun: () =>
    request<{
      fetched: Array<{ accountId: string; postsSeen: number; newComments: number; errors: number }>;
      classified: number;
    }>("/api/admin/poll/run", { method: "POST" }),
  adminTokenCheck: () => request<{ ok: true }>("/api/admin/tokens/check", { method: "POST" }),
  adminBulkReclassify: (hours?: number, limit = 500) =>
    request<{ attempted: number; done: number; failed: number }>("/api/admin/reclassify/bulk", {
      method: "POST",
      body: JSON.stringify({ hours, limit }),
    }),
  adminReady: () =>
    request<{ ok: boolean; checks: Record<string, { ok: boolean; detail?: string }> }>(
      "/health/ready"
    ),
  adminRetention: (days: number) =>
    request<{ anonymized: number; retentionDays: number }>("/api/admin/retention/run", {
      method: "POST",
      body: JSON.stringify({ days }),
    }),
  statsOverview: (days = 7) =>
    request<{
      windowDays: number;
      totalComments: number;
      totalActions: number;
      byCategory: Array<{ category: string; count: number }>;
      byAction: Array<{ actionType: string; count: number }>;
      topNegativeAuthors: Array<{ authorName: string; count: number }>;
      perDay: Array<{ day: string; count: number }>;
      avgResponseSeconds: number;
    }>(`/api/stats/overview?days=${days}`),
};
