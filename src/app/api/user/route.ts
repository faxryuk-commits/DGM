// Personal Decision & Commitment OS - User API
// Based on 02_TECHNICAL_SPEC.txt

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET - Get or create user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          dynamicState: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ user });
    }

    // Create new user if no ID provided
    const newUser = await prisma.user.create({
      data: {},
    });

    // Create dynamic state with default energy
    await prisma.dynamicState.create({
      data: {
        userId: newUser.id,
        energyLevel: 'green',
      },
    });

    return NextResponse.json({ user: newUser });
  } catch (error) {
    console.error('User API error:', error);
    return NextResponse.json(
      { error: 'Failed to get/create user' },
      { status: 500 }
    );
  }
}

// POST - Create user profile (onboarding complete)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      primaryRole,
      secondaryRole,
      loadProfile,
      moneyPolicy,
      supportPolicy,
      hardRules,
      calendarConnected,
    } = body;

    if (!userId || !primaryRole || !loadProfile) {
      return NextResponse.json(
        { error: 'userId, primaryRole, and loadProfile are required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create or update profile
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        primaryRole,
        secondaryRole: secondaryRole || null,
        loadProfile,
        moneyPolicy: JSON.stringify(moneyPolicy || { requireReturnDate: true, allowedActors: ['family', 'friend'] }),
        supportPolicy: JSON.stringify(supportPolicy || { maxWeekly: 3, allowedActors: ['family', 'friend', 'team'] }),
        hardRules: JSON.stringify(hardRules || []),
        calendarConnected: calendarConnected || false,
      },
      create: {
        userId,
        primaryRole,
        secondaryRole: secondaryRole || null,
        loadProfile,
        moneyPolicy: JSON.stringify(moneyPolicy || { requireReturnDate: true, allowedActors: ['family', 'friend'] }),
        supportPolicy: JSON.stringify(supportPolicy || { maxWeekly: 3, allowedActors: ['family', 'friend', 'team'] }),
        hardRules: JSON.stringify(hardRules || []),
        calendarConnected: calendarConnected || false,
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('User Profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to create/update profile' },
      { status: 500 }
    );
  }
}

// PATCH - Update energy level
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, energyLevel } = body;

    if (!userId || !energyLevel) {
      return NextResponse.json(
        { error: 'userId and energyLevel are required' },
        { status: 400 }
      );
    }

    const validLevels = ['green', 'yellow', 'red'];
    if (!validLevels.includes(energyLevel)) {
      return NextResponse.json(
        { error: 'energyLevel must be green, yellow, or red' },
        { status: 400 }
      );
    }

    const dynamicState = await prisma.dynamicState.upsert({
      where: { userId },
      update: { energyLevel },
      create: { userId, energyLevel },
    });

    return NextResponse.json({ dynamicState });
  } catch (error) {
    console.error('Update energy API error:', error);
    return NextResponse.json(
      { error: 'Failed to update energy level' },
      { status: 500 }
    );
  }
}

