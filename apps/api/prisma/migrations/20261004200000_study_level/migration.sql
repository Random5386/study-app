-- CreateEnum
CREATE TYPE "StudyLevel" AS ENUM ('HIGH_SCHOOL', 'COLLEGE', 'UNIVERSITY', 'POSTGRAD');

-- DropIndex
DROP INDEX "Summary_documentId_style_promptVersion_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "schoolGrade" INTEGER,
ADD COLUMN     "studyLevel" "StudyLevel";

-- AlterTable
ALTER TABLE "Summary" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE UNIQUE INDEX "Summary_documentId_style_promptVersion_audience_key" ON "Summary"("documentId", "style", "promptVersion", "audience");
