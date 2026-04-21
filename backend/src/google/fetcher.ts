import { prisma } from "../db";
import { encrypt, decrypt } from "../crypto";
import { google } from "./api-client";
import { refreshAccessToken } from "./oauth";
import { logger } from "../utils/logger";
import { audit } from "../services/audit";

export interface GoogleFetchResult {
  accountId: string;
  reviewsSeen: number;
  newReviews: number;
  errors: number;
}

/**
 * Returns a valid access token for the given account, refreshing it with the
 * Google OAuth refresh_token if the stored access_token is expired or will
 * expire in the next 60 seconds.
 */
async function getValidAccessToken(accountId: string): Promise<string> {
  const acc = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  const expiresAt = acc.tokenExpiresAt?.getTime() ?? 0;
  if (expiresAt > Date.now() + 60_000) {
    return decrypt(acc.accessTokenEncrypted);
  }
  if (!acc.refreshTokenEncrypted) {
    throw new Error(`account ${accountId} has no refresh token; re-link via Google OAuth`);
  }
  const refresh = decrypt(acc.refreshTokenEncrypted);
  const tokens = await refreshAccessToken(refresh);
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
  await prisma.account.update({
    where: { id: accountId },
    data: {
      accessTokenEncrypted: encrypt(tokens.access_token),
      tokenExpiresAt: newExpiresAt,
    },
  });
  logger.info("google token refreshed", { accountId });
  return tokens.access_token;
}

export async function fetchGoogleAccount(accountId: string): Promise<GoogleFetchResult> {
  const acc = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  if (acc.source !== "GOOGLE") {
    throw new Error(`account ${accountId} is not a Google account`);
  }
  if (!acc.externalLocationId) {
    throw new Error(`account ${accountId} missing externalLocationId`);
  }

  const token = await getValidAccessToken(accountId);

  // Ensure there's exactly one Post row representing this location — reviews
  // are attached to the location, not to individual posts. Keeps the existing
  // Comment → Post → Account shape intact.
  const post = await prisma.post.upsert({
    where: { platformPostId: acc.externalLocationId },
    create: {
      accountId: acc.id,
      platformPostId: acc.externalLocationId,
      postedAt: null,
      contentPreview: `Google Business Profile · ${acc.pageName}`,
      permalink: null,
    },
    update: {},
  });

  let reviewsSeen = 0;
  let newReviews = 0;
  let errors = 0;

  try {
    const { reviews } = await google.listReviews(acc.externalLocationId, token);
    for (const r of reviews ?? []) {
      reviewsSeen++;
      const stars = google.starToNumber(r.starRating);
      // Review ID inside the v4 API is part of `name` = accounts/X/locations/Y/reviews/Z
      const platformCommentId = r.name;
      const existing = await prisma.comment.findUnique({ where: { platformCommentId } });
      await prisma.comment.upsert({
        where: { platformCommentId },
        create: {
          postId: post.id,
          platformCommentId,
          authorName: r.reviewer?.displayName ?? "Anonymní recenzent",
          authorId: null,
          authorPhotoUrl: r.reviewer?.profilePhotoUrl ?? null,
          text: r.comment ?? `(recenze bez textu, ${stars} ★)`,
          starRating: stars,
          createdAtPlatform: r.createTime ? new Date(r.createTime) : null,
          status: "new",
        },
        update: {
          authorName: r.reviewer?.displayName ?? "Anonymní recenzent",
          authorPhotoUrl: r.reviewer?.profilePhotoUrl ?? null,
          text: r.comment ?? `(recenze bez textu, ${stars} ★)`,
          starRating: stars,
        },
      });
      if (!existing) newReviews++;
    }
  } catch (err) {
    errors++;
    logger.warn("google fetch reviews failed", { accountId, err: String(err) });
  }

  await audit({
    entityType: "Account",
    entityId: acc.id,
    event: "fetch",
    metadata: { source: "GOOGLE", reviewsSeen, newReviews, errors },
  });

  return { accountId, reviewsSeen, newReviews, errors };
}

export async function fetchAllGoogleAccounts(): Promise<GoogleFetchResult[]> {
  const accounts = await prisma.account.findMany({ where: { active: true, source: "GOOGLE" } });
  const results: GoogleFetchResult[] = [];
  for (const acc of accounts) {
    try {
      results.push(await fetchGoogleAccount(acc.id));
    } catch (err) {
      logger.error("fetchGoogleAccount failed", { accountId: acc.id, err: String(err) });
      results.push({ accountId: acc.id, reviewsSeen: 0, newReviews: 0, errors: 1 });
    }
  }
  return results;
}
