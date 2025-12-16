// Personal Decision & Commitment OS - Parse API
// AI extracts structure, outputs JSON only
// Based on 02_TECHNICAL_SPEC.txt

import { NextRequest, NextResponse } from 'next/server';
import { parseRequest } from '@/lib/ai-parser';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rawText, userId } = body;

    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json(
        { error: 'rawText is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Parse the request using AI
    const parsedData = await parseRequest(rawText);

    // Store the incoming request
    const incomingRequest = await prisma.incomingRequest.create({
      data: {
        userId,
        rawText,
        parsedData: JSON.stringify(parsedData),
      },
    });

    return NextResponse.json({
      requestId: incomingRequest.id,
      parsedData,
    });
  } catch (error) {
    console.error('Parse API error:', error);
    return NextResponse.json(
      { error: 'Failed to parse request' },
      { status: 500 }
    );
  }
}

