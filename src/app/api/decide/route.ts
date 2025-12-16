// Personal Decision & Commitment OS - Decision API
// Applies rules engine, returns decision
// Based on 02_TECHNICAL_SPEC.txt

import { NextRequest, NextResponse } from 'next/server';
import { evaluateDecision, getTemplateText } from '@/lib/rules-engine';
import prisma from '@/lib/db';
import type { ParsedRequest, UserProfile, DynamicState, AggregatedStats, MoneyPolicy, SupportPolicy, EnergyLevel, Role, LoadProfile } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, energyLevel } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId is required' },
        { status: 400 }
      );
    }

    // Get the incoming request
    const incomingRequest = await prisma.incomingRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          include: {
            profile: true,
            dynamicState: true,
          },
        },
      },
    });

    if (!incomingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    const user = incomingRequest.user;
    if (!user.profile) {
      return NextResponse.json(
        { error: 'User profile not found. Complete onboarding first.' },
        { status: 400 }
      );
    }

    // Update energy level if provided
    const currentEnergyLevel: EnergyLevel = energyLevel || user.dynamicState?.energyLevel || 'green';
    
    if (energyLevel && user.dynamicState) {
      await prisma.dynamicState.update({
        where: { userId: user.id },
        data: { energyLevel },
      });
    }

    // Parse stored data
    const parsedRequest: ParsedRequest = JSON.parse(incomingRequest.parsedData);
    
    const moneyPolicy: MoneyPolicy = JSON.parse(user.profile.moneyPolicy);
    const supportPolicy: SupportPolicy = JSON.parse(user.profile.supportPolicy);
    const hardRules: string[] = JSON.parse(user.profile.hardRules);

    const userProfile: UserProfile = {
      userId: user.id,
      primaryRole: user.profile.primaryRole as Role,
      secondaryRole: user.profile.secondaryRole as Role | undefined,
      loadProfile: user.profile.loadProfile as LoadProfile,
      moneyPolicy,
      supportPolicy,
      hardRules,
      calendarConnected: user.profile.calendarConnected,
    };

    const dynamicState: DynamicState = {
      userId: user.id,
      energyLevel: currentEnergyLevel,
    };

    // Get aggregated stats
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const [dailyCommitments, weeklyCommitments] = await Promise.all([
      prisma.commitment.count({
        where: {
          userId: user.id,
          createdAt: { gte: startOfDay },
          status: { in: ['pending', 'confirmed'] },
        },
      }),
      prisma.commitment.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: startOfWeek },
          status: { in: ['pending', 'confirmed'] },
        },
        include: {
          request: true,
        },
      }),
    ]);

    const aggregatedStats: AggregatedStats = {
      dailyCommitments,
      weeklyMoneyRequests: weeklyCommitments.filter(c => {
        const data = JSON.parse(c.request.parsedData);
        return data.intent === 'money';
      }).length,
      weeklyTimeBlocks: weeklyCommitments.filter(c => {
        const data = JSON.parse(c.request.parsedData);
        return data.intent === 'time';
      }).length,
      concurrentProjects: weeklyCommitments.filter(c => {
        const data = JSON.parse(c.request.parsedData);
        return data.intent === 'work-change';
      }).length,
      weeklySupport: weeklyCommitments.filter(c => {
        const data = JSON.parse(c.request.parsedData);
        return data.intent === 'support';
      }).length,
    };

    // Evaluate decision using rules engine
    const decision = evaluateDecision({
      parsedRequest,
      userProfile,
      dynamicState,
      aggregatedStats,
      calendarAvailable: undefined, // Will be checked in calendar step
    });

    // Store decision result
    const decisionResult = await prisma.decisionResult.create({
      data: {
        requestId,
        result: decision.result,
        reasonCodes: JSON.stringify(decision.reasonCodes),
        templateKey: decision.templateKey,
      },
    });

    // Store in decision history
    await prisma.decisionHistory.create({
      data: {
        userId: user.id,
        intent: parsedRequest.intent,
        roleAtTime: userProfile.primaryRole,
        loadProfile: userProfile.loadProfile,
        energyLevel: currentEnergyLevel,
        decisionResult: decision.result,
        commitmentCreated: false,
      },
    });

    return NextResponse.json({
      decisionId: decisionResult.id,
      result: decision.result,
      reasonCodes: decision.reasonCodes,
      templateKey: decision.templateKey,
      templateText: getTemplateText(decision.templateKey),
      requiresCalendar: decision.requiresCalendar,
    });
  } catch (error) {
    console.error('Decision API error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate decision' },
      { status: 500 }
    );
  }
}

