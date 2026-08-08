import { NextResponse } from 'next/server';
import { getUserEntitlements } from '@/lib/entitlements';
import { getSession } from '@/lib/auth'; // Your auth logic

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const entitlements = await getUserEntitlements(session.user.id);
    return NextResponse.json(entitlements);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch entitlements' }, { status: 500 });
  }
}