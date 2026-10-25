-- Additive: existing businesses keep NULL (not featured). No data is rewritten.
ALTER TABLE "Business" ADD COLUMN "featuredRank" INTEGER;

-- Postgres treats NULLs as distinct, so any number of unfeatured rows is allowed
-- while two businesses in one program can never share a featured position.
CREATE UNIQUE INDEX "Business_programId_featuredRank_key" ON "Business"("programId", "featuredRank");

-- The Browse page shows at most 9 featured businesses.
ALTER TABLE "Business" ADD CONSTRAINT "Business_featuredRank_range" CHECK ("featuredRank" IS NULL OR ("featuredRank" BETWEEN 1 AND 9));
