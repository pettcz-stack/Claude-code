import { logger } from "../utils/logger";

// Google Business Profile API has two relevant endpoints:
// - Account Management (listing accounts, locations)
// - Reviews (v4 My Business API, still supported for reviews as of 2026)
//
// https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews

export class GoogleApiError extends Error {
  status: number;
  payload?: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  accessToken: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    logger.warn("google api error", { url, status: res.status, json });
    throw new GoogleApiError(`Google API ${method} ${url} failed (${res.status})`, res.status, json);
  }
  return json as T;
}

export interface GoogleAccount {
  name: string; // e.g. "accounts/1234567890"
  accountName: string;
  type: string;
}

export interface GoogleLocation {
  name: string; // e.g. "accounts/X/locations/Y"
  title: string;
  storefrontAddress?: { addressLines?: string[]; locality?: string };
  websiteUri?: string;
  metadata?: { mapsUri?: string; newReviewUri?: string };
}

export interface GoogleReview {
  reviewId: string;
  reviewer: {
    profilePhotoUrl?: string;
    displayName: string;
    isAnonymous?: boolean;
  };
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
  name: string; // full resource name
}

const GBP = "https://mybusiness.googleapis.com/v4";
const ACC_MGMT = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";

export const google = {
  listAccounts: async (accessToken: string): Promise<GoogleAccount[]> => {
    const res = await request<{ accounts?: GoogleAccount[] }>("GET", `${ACC_MGMT}/accounts`, accessToken);
    return res.accounts ?? [];
  },

  listLocations: async (accountName: string, accessToken: string): Promise<GoogleLocation[]> => {
    // accountName is already "accounts/X"
    const url = `${INFO}/${accountName}/locations?readMask=name,title,storefrontAddress,websiteUri,metadata`;
    const res = await request<{ locations?: GoogleLocation[] }>("GET", url, accessToken);
    return res.locations ?? [];
  },

  listReviews: async (
    locationName: string,
    accessToken: string
  ): Promise<{ reviews: GoogleReview[]; averageRating?: number; totalReviewCount?: number }> => {
    // The v4 API still handles reviews. Format: accounts/X/locations/Y/reviews
    const url = `${GBP}/${locationName}/reviews?pageSize=50`;
    return request("GET", url, accessToken);
  },

  replyToReview: async (reviewName: string, comment: string, accessToken: string): Promise<unknown> => {
    // reviewName = "accounts/X/locations/Y/reviews/Z"
    const url = `${GBP}/${reviewName}/reply`;
    return request("PUT", url, accessToken, { comment });
  },

  /**
   * Google Business Profile does NOT expose a "flag as inappropriate" endpoint
   * in their public API. To report a review, the business owner must click
   * "Flag as inappropriate" in the Google Business Profile UI or Google Maps.
   *
   * This helper returns a deep-link URL into Google Maps where the review is
   * visible and can be flagged manually. Operator clicks it from our UI →
   * Google Maps opens → three-dot menu → Report review.
   */
  buildMapsReviewUrl: (locationMapsUri: string | undefined): string | null => {
    return locationMapsUri ?? null;
  },

  starToNumber: (s: GoogleReview["starRating"]): number => {
    const m: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    return m[s] ?? 0;
  },
};
