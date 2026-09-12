-- Password reset / change, and the manual notification queue.
--
-- `reset_token` is kept separate from `invite_token` deliberately: a pending
-- invite and a password reset are different states, and one shared field would
-- let a reset silently consume an unaccepted invite.
--
-- `password_changed_at` is stamped on every change. Sessions are revoked
-- explicitly at that moment (see lib/adminIdentity.ts revokeAllSessions) — a
-- password change that leaves old sessions alive is not a password change.
--
-- `notification_outbox` exists because no email or SMS provider is configured
-- yet. Every message the product wants to send is queued here and dispatched by
-- hand from the admin panel. `action_url` holds a one-time credential, which is
-- why the route serving this table is super-admin-only.

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "password_changed_at" TIMESTAMP(3),
ADD COLUMN     "reset_expires_at" TIMESTAMP(3),
ADD COLUMN     "reset_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_reset_token_key" ON "admin_users"("reset_token");

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "to_email" TEXT,
    "to_phone" TEXT,
    "template" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "action_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "related_type" TEXT,
    "related_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "sent_by" TEXT,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_outbox_status_created_at_idx" ON "notification_outbox"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_outbox_related_type_related_id_idx" ON "notification_outbox"("related_type", "related_id");
