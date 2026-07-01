import { Router } from "express";
import { prisma } from "../db.js";
import {
  getPriceMap,
  getOverview,
  getSoldEstimates,
} from "../analytics/priceMap.js";
import { getCalibration } from "../analytics/calibration.js";

export const api = Router();

api.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Kalibrace nabídka→prodej (medián inzerce vs. medián katastru) po městě a typu.
api.get("/calibration", async (req, res, next) => {
  try {
    const minCount = Math.max(1, Number(req.query.minCount) || 5);
    res.json(await getCalibration(minCount));
  } catch (e) {
    next(e);
  }
});

// Realizované ceny z katastru (poslední importované).
api.get("/realized-prices", async (req, res, next) => {
  try {
    const where: Record<string, unknown> = {};
    if (typeof req.query.propertyType === "string")
      where.propertyType = req.query.propertyType;
    if (typeof req.query.kuCode === "string") where.kuCode = req.query.kuCode;
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const rows = await prisma.realizedPrice.findMany({
      where,
      orderBy: { dealDate: "desc" },
      take: limit,
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

api.get("/stats/overview", async (_req, res, next) => {
  try {
    res.json(await getOverview());
  } catch (e) {
    next(e);
  }
});

api.get("/price-map", async (req, res, next) => {
  try {
    const dealType = typeof req.query.dealType === "string" ? req.query.dealType : undefined;
    const propertyType =
      typeof req.query.propertyType === "string" ? req.query.propertyType : undefined;
    res.json(await getPriceMap({ dealType, propertyType }));
  } catch (e) {
    next(e);
  }
});

api.get("/sold-estimates", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    res.json(await getSoldEstimates(limit));
  } catch (e) {
    next(e);
  }
});

api.get("/listings", async (req, res, next) => {
  try {
    const where: Record<string, unknown> = {};
    if (typeof req.query.status === "string") where.status = req.query.status;
    else where.status = "active";
    if (typeof req.query.dealType === "string") where.dealType = req.query.dealType;
    if (typeof req.query.propertyType === "string")
      where.propertyType = req.query.propertyType;
    if (typeof req.query.city === "string") where.city = req.query.city;

    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const listings = await prisma.listing.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      take: limit,
    });
    res.json(listings);
  } catch (e) {
    next(e);
  }
});

api.get("/listings/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { priceHistory: { orderBy: { seenAt: "asc" } } },
    });
    if (!listing) {
      res.status(404).json({ error: "nenalezeno" });
      return;
    }
    res.json(listing);
  } catch (e) {
    next(e);
  }
});
