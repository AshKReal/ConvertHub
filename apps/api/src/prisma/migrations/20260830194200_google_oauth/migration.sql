
-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('GOOGLE');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "identities" (
    "id" VARCHAR(26) NOT NULL,
    "user_id" VARCHAR(26) NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "provider_uid" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identities_user_id_idx" ON "identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "identities_provider_provider_uid_key" ON "identities"("provider", "provider_uid");

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

