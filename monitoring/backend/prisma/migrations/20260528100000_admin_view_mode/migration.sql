-- AdminUser: persistovaný UI pohled (Basic vs Pro)
-- Default 'pro' pro existující účty zachová aktuální chování.
ALTER TABLE "AdminUser" ADD COLUMN "viewMode" TEXT NOT NULL DEFAULT 'pro';
