-- CreateEnum
CREATE TYPE "FulfillmentTaskStatus" AS ENUM ('PENDING', 'PLACED', 'SHIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "FulfillmentTask" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplierType" "SupplierType" NOT NULL,
    "status" "FulfillmentTaskStatus" NOT NULL DEFAULT 'PENDING',
    "supplierUrl" TEXT,
    "externalOrderId" TEXT,
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FulfillmentTask_storeId_status_idx" ON "FulfillmentTask"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentTask_orderId_key" ON "FulfillmentTask"("orderId");

-- AddForeignKey
ALTER TABLE "FulfillmentTask" ADD CONSTRAINT "FulfillmentTask_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentTask" ADD CONSTRAINT "FulfillmentTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
