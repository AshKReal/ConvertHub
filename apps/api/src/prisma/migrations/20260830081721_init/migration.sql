-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(26) NOT NULL,
    "storage_used_bytes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" VARCHAR(26) NOT NULL,
    "user_id" VARCHAR(26),
    "storage_key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "extension" VARCHAR(8) NOT NULL,
    "original_filename" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversions" (
    "id" VARCHAR(26) NOT NULL,
    "user_id" VARCHAR(26),
    "target" VARCHAR(8) NOT NULL,
    "direction_id" VARCHAR(32),
    "status" "ConversionStatus" NOT NULL,
    "error_code" VARCHAR(64),
    "duration_ms" INTEGER NOT NULL,
    "file_id" VARCHAR(26),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "idx_files_user_cursor" ON "files"("user_id", "id");

-- CreateIndex
CREATE INDEX "idx_conversions_user_cursor" ON "conversions"("user_id", "id");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (partial — вручную, Prisma 6 schema DSL не умеет @@index(where:),
-- только preview partialIndexes с v7.4; ARCHITECTURE.md §10, спека 003)
CREATE INDEX "idx_files_expiring" ON "files"("expires_at") WHERE "expires_at" IS NOT NULL;
