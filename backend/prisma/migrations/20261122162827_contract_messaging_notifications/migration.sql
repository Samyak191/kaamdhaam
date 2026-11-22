-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PROPOSAL_RECEIVED', 'PROPOSAL_SHORTLISTED', 'PROPOSAL_REJECTED', 'FREELANCER_HIRED', 'CONTRACT_CREATED', 'MESSAGE_RECEIVED', 'MILESTONE_SUBMITTED', 'REVISION_REQUESTED', 'MILESTONE_APPROVED', 'CONTRACT_COMPLETED', 'CONTRACT_CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MilestoneStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "MilestoneStatus" ADD VALUE 'REVISION_REQUESTED';
ALTER TYPE "MilestoneStatus" ADD VALUE 'APPROVED';
ALTER TYPE "MilestoneStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "contract_milestones" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "revision_number" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "submitted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "completed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "milestone_submissions" (
    "id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "deliverable_url" VARCHAR(2048),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision_reason" VARCHAR(2000),
    "revision_requested_at" TIMESTAMP(3),

    CONSTRAINT "milestone_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "last_sequence" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sequence" BIGINT NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_reads" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_sequence" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_reads_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "related_entity_type" VARCHAR(60) NOT NULL,
    "related_entity_id" UUID NOT NULL,
    "dedupe_key" VARCHAR(240) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "milestone_submissions_milestone_id_revision_number_key" ON "milestone_submissions"("milestone_id", "revision_number");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_contract_id_key" ON "conversations"("contract_id");

-- CreateIndex
CREATE INDEX "conversations_organization_id_updated_at_idx" ON "conversations"("organization_id", "updated_at");

-- CreateIndex
CREATE INDEX "conversations_freelancer_user_id_updated_at_idx" ON "conversations"("freelancer_user_id", "updated_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversation_id_sequence_key" ON "messages"("conversation_id", "sequence");

-- CreateIndex
CREATE INDEX "conversation_reads_user_id_idx" ON "conversation_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_created_at_id_idx" ON "notifications"("recipient_user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_read_at_idx" ON "notifications"("recipient_user_id", "read_at");

-- AddForeignKey
ALTER TABLE "milestone_submissions" ADD CONSTRAINT "milestone_submissions_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "contract_milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "client_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_revision_nonnegative" CHECK ("revision_number" >= 0);
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_sequence_nonnegative" CHECK ("last_sequence" >= 0);
ALTER TABLE "messages" ADD CONSTRAINT "messages_sequence_positive" CHECK ("sequence" > 0);
ALTER TABLE "messages" ADD CONSTRAINT "messages_body_nonempty" CHECK (length(btrim("body")) BETWEEN 1 AND 4000);
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_sequence_nonnegative" CHECK ("last_read_sequence" >= 0);
ALTER TABLE "milestone_submissions" ADD CONSTRAINT "milestone_submissions_revision_positive" CHECK ("revision_number" > 0);
INSERT INTO "conversations" ("id", "contract_id", "organization_id", "freelancer_user_id", "created_at", "updated_at")
SELECT gen_random_uuid(), c."id", c."organization_id", c."freelancer_user_id", c."created_at", CURRENT_TIMESTAMP
FROM "contracts" c WHERE NOT EXISTS (SELECT 1 FROM "conversations" x WHERE x."contract_id" = c."id");
