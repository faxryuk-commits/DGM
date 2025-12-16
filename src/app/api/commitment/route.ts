// Personal Decision & Commitment OS - Commitment API
// Commitment created ONLY if: Decision = ALLOW, User confirms, Calendar slot exists (if needed)
// Based on 02_TECHNICAL_SPEC.txt

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET - Get user's commitments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const where: { userId: string; status?: string | { in: string[] } } = { userId };
    
    if (status) {
      where.status = status;
    } else {
      // Default: active commitments only
      where.status = { in: ['pending', 'confirmed'] };
    }

    const commitments = await prisma.commitment.findMany({
      where,
      include: {
        request: {
          include: {
            decisionResult: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ commitments });
  } catch (error) {
    console.error('Get commitments API error:', error);
    return NextResponse.json(
      { error: 'Failed to get commitments' },
      { status: 500 }
    );
  }
}

// POST - Create commitment (user confirms)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, scheduledAt, duration } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId is required' },
        { status: 400 }
      );
    }

    // Get the request and decision
    const incomingRequest = await prisma.incomingRequest.findUnique({
      where: { id: requestId },
      include: {
        decisionResult: true,
        commitment: true,
      },
    });

    if (!incomingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // Check if commitment already exists
    if (incomingRequest.commitment) {
      return NextResponse.json(
        { error: 'Commitment already exists for this request' },
        { status: 400 }
      );
    }

    // Check decision result
    if (!incomingRequest.decisionResult) {
      return NextResponse.json(
        { error: 'No decision found for this request' },
        { status: 400 }
      );
    }

    // Commitment created ONLY if Decision = ALLOW
    if (incomingRequest.decisionResult.result !== 'ALLOW') {
      return NextResponse.json(
        { error: 'Cannot create commitment. Decision is not ALLOW.' },
        { status: 400 }
      );
    }

    // Parse request data to get type
    const parsedData = JSON.parse(incomingRequest.parsedData);

    // Create commitment
    const commitment = await prisma.commitment.create({
      data: {
        userId: incomingRequest.userId,
        requestId,
        type: parsedData.intent,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        duration: duration || parsedData.params?.duration || null,
        status: 'confirmed',
      },
    });

    // Update decision history
    await prisma.decisionHistory.updateMany({
      where: {
        userId: incomingRequest.userId,
        intent: parsedData.intent,
        commitmentCreated: false,
      },
      data: {
        commitmentCreated: true,
      },
    });

    return NextResponse.json({ commitment });
  } catch (error) {
    console.error('Create commitment API error:', error);
    return NextResponse.json(
      { error: 'Failed to create commitment' },
      { status: 500 }
    );
  }
}

// PATCH - Update commitment status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { commitmentId, status } = body;

    if (!commitmentId || !status) {
      return NextResponse.json(
        { error: 'commitmentId and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const commitment = await prisma.commitment.update({
      where: { id: commitmentId },
      data: { status },
    });

    return NextResponse.json({ commitment });
  } catch (error) {
    console.error('Update commitment API error:', error);
    return NextResponse.json(
      { error: 'Failed to update commitment' },
      { status: 500 }
    );
  }
}

