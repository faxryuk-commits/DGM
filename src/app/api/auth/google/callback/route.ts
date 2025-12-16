// Personal Decision & Commitment OS - Google Calendar OAuth Callback
// Based on 02_TECHNICAL_SPEC.txt

import { NextRequest, NextResponse } from 'next/server';
import CalendarAdapter from '@/lib/calendar-adapter';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // userId
    const error = searchParams.get('error');

    // Get base URL from request
    const baseUrl = new URL(request.url).origin;

    if (error) {
      return NextResponse.redirect(
        `${baseUrl}/?error=${encodeURIComponent('Calendar connection cancelled')}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${baseUrl}/?error=missing_params`
      );
    }

    // Exchange code for tokens
    const { accessToken, refreshToken } = await CalendarAdapter.exchangeCodeForTokens(code);

    // Save tokens to user profile
    await prisma.userProfile.update({
      where: { userId: state },
      data: {
        calendarConnected: true,
        calendarToken: accessToken, // In production, encrypt this!
        calendarRefreshToken: refreshToken, // In production, encrypt this!
      },
    });

    // Redirect back to app
    const baseUrl = new URL(request.url).origin;
    return NextResponse.redirect(
      `${baseUrl}/?calendar_connected=true`
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    const baseUrl = new URL(request.url).origin;
    return NextResponse.redirect(
      `${baseUrl}/?error=oauth_failed`
    );
  }
}

