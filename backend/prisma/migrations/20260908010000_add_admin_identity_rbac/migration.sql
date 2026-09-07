-- Additive only. Nothing dropped, nothing altered destructively.
-- NOT applied to production by this session — the 8 pre-existing migrations
-- ahead of this one are still unresolved in `_prisma_migrations` (bookkeeping
-- drift documented in PROGRESS.md), and resolving that is a production-DB
-- action this session's permission classifier correctly declined to run
-- unsupervised. Apply when you're back:
--
--   npx prisma migrate resolve --applied "0_baseline"
--   npx prisma migrate resolve --applied "20260809152425_add_comprehensive_property_fields"
--   npx prisma migrate resolve --applied "20260818_add_chat_session_fk_to_callback"
--   npx prisma migrate resolve --applied "20260818_add_property_feedback"
--   npx prisma migrate resolve --applied "add_lead_objections"
--   npx prisma migrate resolve --applied "add_message_edit_tracking"
--   npx prisma migrate resolve --applied "drop_fabricated_defaults"
--   npx prisma migrate resolve --applied "phase0_conversation_memory"
--   npx prisma migrate deploy

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ANALYST', 'SALES', 'BUILDER', 'PARTNER');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actor_admin_id" TEXT;

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "AdminRole" NOT NULL,
    "builder_id" TEXT,
    "partner_id" TEXT,
    "linked_supabase_user_id" TEXT,
    "invited_by_admin_id" TEXT,
    "invite_token" TEXT,
    "invite_expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_linked_supabase_user_id_key" ON "admin_users"("linked_supabase_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_invite_token_key" ON "admin_users"("invite_token");

-- CreateIndex
CREATE INDEX "admin_users_role_idx" ON "admin_users"("role");

-- CreateIndex
CREATE INDEX "admin_users_builder_id_idx" ON "admin_users"("builder_id");

-- CreateIndex
CREATE INDEX "admin_users_partner_id_idx" ON "admin_users"("partner_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_admin_id_idx" ON "audit_logs"("actor_admin_id");

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "channel_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
