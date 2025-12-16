// Personal Decision & Commitment OS - Google Calendar OAuth Init
// Based on 02_TECHNICAL_SPEC.txt

import { NextRequest, NextResponse } from 'next/server';
import CalendarAdapter from '@/lib/calendar-adapter';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get OAuth URL
    const authUrl = CalendarAdapter.getAuthUrl();
    
    // Add userId as state parameter for callback
    const redirectUrl = new URL(authUrl);
    redirectUrl.searchParams.set('state', userId);

    return NextResponse.json({ authUrl: redirectUrl.toString() });
  } catch (error) {
    console.error('OAuth init error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize OAuth. Check Google Calendar credentials.' },
      { status: 500 }
    );
  }
}

