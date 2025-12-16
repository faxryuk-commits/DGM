// Personal Decision & Commitment OS - Save Calendar Tokens
// Based on 02_TECHNICAL_SPEC.txt

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, accessToken, refreshToken } = body;

    if (!userId || !accessToken) {
      return NextResponse.json(
        { error: 'userId and accessToken are required' },
        { status: 400 }
      );
    }

    // Update user profile with calendar tokens
    await prisma.userProfile.update({
      where: { userId },
      data: {
        calendarConnected: true,
        calendarToken: accessToken, // In production, encrypt this!
        calendarRefreshToken: refreshToken || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save calendar tokens error:', error);
    return NextResponse.json(
      { error: 'Failed to save calendar tokens' },
      { status: 500 }
    );
  }
}

