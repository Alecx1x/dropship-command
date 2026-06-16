-- CreateTable
CREATE TABLE "PortfolioReview" (
    "id" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioReview_createdAt_idx" ON "PortfolioReview"("createdAt");
