-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'OPEN', 'HIRED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN', 'HIRED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PLANNED', 'COMPLETED');

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freelancer_skills" (
    "profile_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,

    CONSTRAINT "freelancer_skills_pkey" PRIMARY KEY ("profile_id","skill_id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(10000) NOT NULL,
    "budget_paise" BIGINT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_skills" (
    "job_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,

    CONSTRAINT "job_skills_pkey" PRIMARY KEY ("job_id","skill_id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "cover_letter" VARCHAR(5000) NOT NULL,
    "bid_paise" BIGINT NOT NULL,
    "delivery_days" INTEGER NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'SUBMITTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_milestones" (
    "id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "amount_paise" BIGINT NOT NULL,

    CONSTRAINT "proposal_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "freelancer_user_id" UUID NOT NULL,
    "agreed_paise" BIGINT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_milestones" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "contract_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hire_requests" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "proposal_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hire_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE INDEX "freelancer_skills_skill_id_idx" ON "freelancer_skills"("skill_id");

-- CreateIndex
CREATE INDEX "jobs_status_published_at_id_idx" ON "jobs"("status", "published_at", "id");

-- CreateIndex
CREATE INDEX "jobs_status_budget_paise_idx" ON "jobs"("status", "budget_paise");

-- CreateIndex
CREATE INDEX "jobs_organization_id_created_at_idx" ON "jobs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "job_skills_skill_id_idx" ON "job_skills"("skill_id");

-- CreateIndex
CREATE INDEX "proposals_freelancer_user_id_created_at_idx" ON "proposals"("freelancer_user_id", "created_at");

-- CreateIndex
CREATE INDEX "proposals_job_id_status_idx" ON "proposals"("job_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_job_id_freelancer_user_id_key" ON "proposals"("job_id", "freelancer_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_milestones_proposal_id_sequence_key" ON "proposal_milestones"("proposal_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_job_id_key" ON "contracts"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_proposal_id_key" ON "contracts"("proposal_id");

-- CreateIndex
CREATE INDEX "contracts_organization_id_created_at_idx" ON "contracts"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "contracts_freelancer_user_id_created_at_idx" ON "contracts"("freelancer_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "contract_milestones_contract_id_sequence_key" ON "contract_milestones"("contract_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "hire_requests_actor_user_id_key_key" ON "hire_requests"("actor_user_id", "key");

-- AddForeignKey
ALTER TABLE "freelancer_skills" ADD CONSTRAINT "freelancer_skills_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "freelancer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelancer_skills" ADD CONSTRAINT "freelancer_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "client_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_milestones" ADD CONSTRAINT "proposal_milestones_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "client_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_freelancer_user_id_fkey" FOREIGN KEY ("freelancer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hire_requests" ADD CONSTRAINT "hire_requests_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hire_requests" ADD CONSTRAINT "hire_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_budget_positive" CHECK ("budget_paise" BETWEEN 10000 AND 100000000000);
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_published_consistent" CHECK (("status" = 'DRAFT' AND "published_at" IS NULL) OR ("status" <> 'DRAFT' AND "published_at" IS NOT NULL));
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_bid_positive" CHECK ("bid_paise" BETWEEN 10000 AND 100000000000);
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_delivery_days_valid" CHECK ("delivery_days" BETWEEN 1 AND 365);
ALTER TABLE "proposal_milestones" ADD CONSTRAINT "proposal_milestones_amount_positive" CHECK ("amount_paise" > 0 AND "sequence" > 0);
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_agreed_positive" CHECK ("agreed_paise" > 0);
ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_amount_positive" CHECK ("amount_paise" > 0 AND "sequence" > 0);
CREATE INDEX "skills_name_lower_idx" ON "skills" (lower("name"));
