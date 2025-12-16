// Personal Decision & Commitment OS - Calendar API
// Calendar is the final arbiter
// Based on 02_TECHNICAL_SPEC.txt

import { NextRequest, NextResponse } from 'next/server';
import CalendarAdapter from '@/lib/calendar-adapter';
import prisma from '@/lib/db';

// GET - Get available calendar slots
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const duration = parseInt(searchParams.get('duration') || '60');
    const days = parseInt(searchParams.get('days') || '7');
    const userId = searchParams.get('userId');

    // Get access token from user profile if userId provided
    let accessToken: string | undefined;
    if (userId) {
      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { calendarToken: true, calendarConnected: true },
      });
      
      if (profile?.calendarConnected && profile.calendarToken) {
        accessToken = profile.calendarToken;
      }
    }

    const calendar = new CalendarAdapter(accessToken);
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const slots = await calendar.getAvailableSlots(startDate, endDate, duration);
    const availableSlots = slots.filter(s => s.available);

    // Convert Date objects to ISO strings for JSON
    const slotsFormatted = availableSlots.map(slot => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      available: slot.available,
    }));

    return NextResponse.json({
      slots: slotsFormatted,
      total: slots.length,
      available: availableSlots.length,
    });
  } catch (error) {
    console.error('Calendar API error:', error);
    return NextResponse.json(
      { error: 'Failed to get calendar slots' },
      { status: 500 }
    );
  }
}

// POST - Create calendar event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, start, end, description, userId } = body;

    if (!title || !start || !end) {
      return NextResponse.json(
        { error: 'title, start, and end are required' },
        { status: 400 }
      );
    }

    // Get access token from user profile
    let accessToken: string | undefined;
    if (userId) {
      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { calendarToken: true, calendarConnected: true },
      });
      
      if (profile?.calendarConnected && profile.calendarToken) {
        accessToken = profile.calendarToken;
      }
    }

    const calendar = new CalendarAdapter(accessToken);
    
    const event = await calendar.createEvent({
      title,
      start: new Date(start),
      end: new Date(end),
      description,
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Create calendar event API error:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}

