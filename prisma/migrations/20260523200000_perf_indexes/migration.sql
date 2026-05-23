-- Hot-path indexes for high-frequency queries that were doing full scans.

-- Shell counts unread notifications for the current user on every page.
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- Dashboard "delivered today" + per-courier delivered-value aggregations
-- filter by deliveredAt — without an index this scans the whole Delivery table.
CREATE INDEX IF NOT EXISTS "Delivery_deliveredAt_idx" ON "Delivery"("deliveredAt");
