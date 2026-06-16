-- CreateTable
CREATE TABLE "LaunchTask" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaunchTask_storeId_idx" ON "LaunchTask"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchTask_storeId_key_key" ON "LaunchTask"("storeId", "key");

-- AddForeignKey
ALTER TABLE "LaunchTask" ADD CONSTRAINT "LaunchTask_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
