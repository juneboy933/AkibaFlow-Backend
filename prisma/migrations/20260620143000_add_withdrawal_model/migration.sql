CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'NEEDS_REVIEW');

CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "originatorConversationId" TEXT,
    "conversationId" TEXT,
    "resultCode" INTEGER,
    "resultDescription" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Withdrawal_transactionId_key" ON "Withdrawal"("transactionId");
CREATE UNIQUE INDEX "Withdrawal_originatorConversationId_key" ON "Withdrawal"("originatorConversationId");
CREATE UNIQUE INDEX "Withdrawal_conversationId_key" ON "Withdrawal"("conversationId");
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");
CREATE INDEX "Withdrawal_goalId_idx" ON "Withdrawal"("goalId");
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");
CREATE INDEX "Withdrawal_createdAt_idx" ON "Withdrawal"("createdAt");

ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
