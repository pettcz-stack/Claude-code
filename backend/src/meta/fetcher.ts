import { prisma } from "../db";
import { decrypt } from "../crypto";
import { graph } from "./graph-client";
import { takeSlot, withBackoff } from "./rate-limit";
import { logger } from "../utils/logger";
import { audit } from "../services/audit";

interface FetchResult {
  accountId: string;
  postsSeen: number;
  newComments: number;
  errors: number;
}

export async function fetchAllAccounts(): Promise<FetchResult[]> {
  const accounts = await prisma.account.findMany({ where: { active: true } });
  const results: FetchResult[] = [];
  for (const acc of accounts) {
    try {
      const r = await fetchAccount(acc.id);
      results.push(r);
    } catch (err) {
      logger.error("fetchAccount failed", { accountId: acc.id, err: String(err) });
      results.push({ accountId: acc.id, postsSeen: 0, newComments: 0, errors: 1 });
    }
  }
  return results;
}

export async function fetchAccount(accountId: string): Promise<FetchResult> {
  const acc = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  const token = decrypt(acc.accessTokenEncrypted);

  let postsSeen = 0;
  let newComments = 0;
  let errors = 0;

  if (!takeSlot(acc.pageId)) {
    logger.warn("rate-limited, skipping fetch", { accountId });
    return { accountId, postsSeen: 0, newComments: 0, errors: 0 };
  }

  if (acc.platform === "FB") {
    const posts = await withBackoff(() => graph.listRecentPosts(acc.pageId, token));
    for (const p of posts.data) {
      postsSeen++;
      const post = await prisma.post.upsert({
        where: { platformPostId: p.id },
        create: {
          accountId: acc.id,
          platformPostId: p.id,
          postedAt: p.created_time ? new Date(p.created_time) : null,
          contentPreview: p.message?.slice(0, 280),
          permalink: p.permalink_url,
        },
        update: {
          contentPreview: p.message?.slice(0, 280),
          permalink: p.permalink_url,
        },
      });
      try {
        const comments = await withBackoff(() => graph.listPostComments(p.id, token));
        for (const c of comments.data) {
          const created = await prisma.comment.upsert({
            where: { platformCommentId: c.id },
            create: {
              postId: post.id,
              platformCommentId: c.id,
              authorName: c.from?.name,
              authorId: c.from?.id,
              text: c.message ?? "",
              createdAtPlatform: c.created_time ? new Date(c.created_time) : null,
              parentCommentId: c.parent?.id,
              status: "new",
            },
            update: {},
          });
          if (created.status === "new" && created.fetchedAt.getTime() > Date.now() - 60_000) {
            newComments++;
          }
        }
      } catch (err) {
        errors++;
        logger.warn("fetch comments failed", { postId: p.id, err: String(err) });
      }
    }
  } else if (acc.platform === "IG") {
    const media = await withBackoff(() => graph.listIgMedia(acc.pageId, token));
    for (const m of media.data) {
      postsSeen++;
      const post = await prisma.post.upsert({
        where: { platformPostId: m.id },
        create: {
          accountId: acc.id,
          platformPostId: m.id,
          postedAt: m.timestamp ? new Date(m.timestamp) : null,
          contentPreview: m.caption?.slice(0, 280),
          permalink: m.permalink,
        },
        update: {
          contentPreview: m.caption?.slice(0, 280),
          permalink: m.permalink,
        },
      });
      try {
        const comments = await withBackoff(() => graph.listIgMediaComments(m.id, token));
        for (const c of comments.data) {
          const created = await prisma.comment.upsert({
            where: { platformCommentId: c.id },
            create: {
              postId: post.id,
              platformCommentId: c.id,
              authorName: c.username ?? c.from?.username,
              authorId: c.from?.id,
              text: c.text ?? "",
              createdAtPlatform: c.timestamp ? new Date(c.timestamp) : null,
              status: "new",
            },
            update: {},
          });
          if (created.status === "new" && created.fetchedAt.getTime() > Date.now() - 60_000) {
            newComments++;
          }
        }
      } catch (err) {
        errors++;
        logger.warn("fetch ig comments failed", { mediaId: m.id, err: String(err) });
      }
    }
  }

  await audit({
    entityType: "Account",
    entityId: acc.id,
    event: "fetch",
    metadata: { postsSeen, newComments, errors },
  });

  return { accountId: acc.id, postsSeen, newComments, errors };
}
