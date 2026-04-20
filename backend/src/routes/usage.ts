import { Router } from "express";
import { summary } from "../services/usage";

export const usageRouter: Router = Router();

usageRouter.get("/summary", async (req, res) => {
  const days = Math.min(90, Number((req.query.days as string) ?? "30") || 30);
  const data = await summary(days);
  res.json(data);
});
