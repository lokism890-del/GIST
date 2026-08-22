import { NextResponse } from 'next/server';
import { getUserEntitlements } from '@/lib/entitlements';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Comment out the real database call just for testing
    // const entitlements = await getUserEntitlements(session.user.id);
    
    // Force the Free Trial state
    return NextResponse.json({
      tier: 'FREE',
      usageCount: 0,
      usageLimit: 5
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch entitlements' }, { status: 500 });
  }
}