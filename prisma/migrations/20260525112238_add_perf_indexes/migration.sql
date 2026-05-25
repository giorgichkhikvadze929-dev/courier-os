-- Composite indexes for the hottest admin queries.
--   Delivery (status, courierId): active-load groupBy on dashboard + assign
--   Delivery (zone):              zone-history groupBy on /admin/assign
--   AuditLog (entity, action, createdAt): /admin/denied filter+sort

CREATE INDEX "Delivery_status_courierId_idx" ON "Delivery"("status", "courierId");
CREATE INDEX "Delivery_zone_idx"               ON "Delivery"("zone");
CREATE INDEX "AuditLog_entity_action_createdAt_idx" ON "AuditLog"("entity", "action", "createdAt");
