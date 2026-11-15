-- AlterTable
ALTER TABLE "Project" ADD COLUMN "apiKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_apiKey_key" ON "Project"("apiKey");
