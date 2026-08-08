import { db } from './db'; // Your database instance (Prisma, Drizzle, etc.)

export async function getUserEntitlements(userId: string) {
  // 1. Fetch User and Polar Subscription Data
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { polarSubscriptionStatus: true }
  });

  if (!user) throw new Error("User not found");

  const isPro = user.polarSubscriptionStatus === 'active';

  // 2. Count Usage for Current Month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usageCount = await db.voiceNote.count({
    where: {
      userId: userId,
      createdAt: { gte: startOfMonth }
    }
  });

  return {
    tier: isPro ? 'PRO' : 'FREE',
    usageCount,
    usageLimit: 5 // Define your free limit here
  };
}