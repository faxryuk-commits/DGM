// Personal Decision & Commitment OS - Rules Engine
// Pure function. Gate order MUST NOT CHANGE.
// Based on 02_TECHNICAL_SPEC.txt

import type {
  RulesEngineInput,
  RulesEngineOutput,
  DecisionResultType,
  Intent,
  Role,
  LoadProfile,
  EnergyLevel,
} from './types';
import rulesConfig from '@/config/rules.json';

type MatrixResult = DecisionResultType | 'CONDITIONAL';

/**
 * Rules Engine - Pure Function
 * 
 * Input:
 * - ParsedRequest
 * - UserProfile
 * - DynamicState
 * - AggregatedStats
 * 
 * Gate order (MUST NOT CHANGE):
 * 1. System rules
 * 2. Role × Intent
 * 3. Energy gate
 * 4. Load limits
 * 5. Intent policies
 * 6. Calendar availability
 * 
 * Output:
 * - result
 * - reasonCodes
 * - templateKey
 * - requiresCalendar
 */
export function evaluateDecision(input: RulesEngineInput): RulesEngineOutput {
  const { parsedRequest, userProfile, dynamicState, aggregatedStats, calendarAvailable } = input;
  
  const reasonCodes: string[] = [];
  let result: DecisionResultType = 'ALLOW';
  let templateKey = 'allow_default';
  let requiresCalendar = false;

  // =============================================
  // GATE 1: System Rules
  // =============================================
  const gate1Result = applySystemRules(parsedRequest, userProfile, reasonCodes);
  if (gate1Result === 'FORBID') {
    return {
      result: 'FORBID',
      reasonCodes,
      templateKey: 'forbid_policy',
      requiresCalendar: false,
    };
  }

  // =============================================
  // GATE 2: Role × Intent Matrix
  // =============================================
  const matrixResult = getRoleIntentResult(
    userProfile.primaryRole,
    parsedRequest.intent
  );
  
  if (matrixResult === 'FORBID') {
    reasonCodes.push('ROLE_INTENT_FORBID');
    return {
      result: 'FORBID',
      reasonCodes,
      templateKey: 'forbid_policy',
      requiresCalendar: false,
    };
  }
  
  if (matrixResult === 'CONDITIONAL') {
    result = 'DEFER';
    reasonCodes.push('ROLE_INTENT_CONDITIONAL');
  } else if (matrixResult === 'ALLOW') {
    result = 'ALLOW';
  }

  // =============================================
  // GATE 3: Energy Gate
  // =============================================
  const gate3Result = applyEnergyGate(dynamicState.energyLevel, result, reasonCodes);
  result = gate3Result.result;
  templateKey = gate3Result.templateKey || templateKey;
  
  if (result === 'FORBID' && dynamicState.energyLevel === 'red') {
    return {
      result: 'FORBID',
      reasonCodes,
      templateKey: 'forbid_energy',
      requiresCalendar: false,
    };
  }

  // =============================================
  // GATE 4: Load Limits
  // =============================================
  const gate4Result = applyLoadLimits(
    userProfile.loadProfile,
    parsedRequest.intent,
    aggregatedStats,
    reasonCodes
  );
  
  if (gate4Result === 'FORBID') {
    return {
      result: 'FORBID',
      reasonCodes,
      templateKey: 'forbid_no_capacity',
      requiresCalendar: false,
    };
  }
  
  if (gate4Result === 'DEFER' && result === 'ALLOW') {
    result = 'DEFER';
  }

  // =============================================
  // GATE 5: Intent Policies
  // =============================================
  const gate5Result = applyIntentPolicies(
    parsedRequest,
    userProfile,
    reasonCodes
  );
  
  if (gate5Result.result === 'FORBID') {
    return {
      result: 'FORBID',
      reasonCodes,
      templateKey: gate5Result.templateKey,
      requiresCalendar: false,
    };
  }
  
  if (gate5Result.result === 'DEFER') {
    result = 'DEFER';
    templateKey = gate5Result.templateKey;
  }
  
  requiresCalendar = gate5Result.requiresCalendar;

  // =============================================
  // GATE 6: Calendar Availability
  // =============================================
  if (requiresCalendar) {
    const gate6Result = applyCalendarGate(
      calendarAvailable,
      userProfile.calendarConnected,
      reasonCodes
    );
    
    if (gate6Result === 'DEFER') {
      result = 'DEFER';
      templateKey = 'defer_need_time';
    }
  }

  // Final template selection
  if (result === 'ALLOW') {
    templateKey = 'allow_default';
  } else if (result === 'DEFER' && templateKey === 'allow_default') {
    templateKey = 'defer_need_time';
  }

  return {
    result,
    reasonCodes,
    templateKey,
    requiresCalendar,
  };
}

// =============================================
// GATE 1: System Rules
// =============================================
function applySystemRules(
  parsedRequest: RulesEngineInput['parsedRequest'],
  userProfile: RulesEngineInput['userProfile'],
  reasonCodes: string[]
): DecisionResultType | null {
  // Check hard rules
  for (const hardRule of userProfile.hardRules) {
    const rulePattern = hardRule.toLowerCase();
    const intentMatch = parsedRequest.intent.toLowerCase();
    
    if (rulePattern.includes(intentMatch) || intentMatch.includes(rulePattern)) {
      reasonCodes.push(`HARD_RULE_MATCH:${hardRule}`);
      return 'FORBID';
    }
  }

  // Check decision pressure
  if (parsedRequest.decisionPressure) {
    reasonCodes.push('PRESSURE_DETECTED');
  }

  return null;
}

// =============================================
// GATE 2: Role × Intent Matrix
// =============================================
function getRoleIntentResult(role: Role, intent: Intent): MatrixResult {
  const matrix = rulesConfig.role_intent_matrix as Record<string, Record<string, MatrixResult>>;
  const roleMatrix = matrix[role];
  
  if (!roleMatrix) {
    return 'DEFER';
  }
  
  return roleMatrix[intent] || 'DEFER';
}

// =============================================
// GATE 3: Energy Gate
// =============================================
function applyEnergyGate(
  energyLevel: EnergyLevel,
  currentResult: DecisionResultType,
  reasonCodes: string[]
): { result: DecisionResultType; templateKey?: string } {
  // red → CONDITIONAL becomes FORBID
  // red → no new commitments
  if (energyLevel === 'red') {
    reasonCodes.push('ENERGY_RED');
    if (currentResult === 'DEFER' || currentResult === 'ALLOW') {
      return { result: 'FORBID', templateKey: 'forbid_energy' };
    }
  }

  // yellow → prefer deferrals
  if (energyLevel === 'yellow' && currentResult === 'ALLOW') {
    reasonCodes.push('ENERGY_YELLOW');
    // Don't automatically change to DEFER, but flag it
  }

  return { result: currentResult };
}

// =============================================
// GATE 4: Load Limits
// =============================================
function applyLoadLimits(
  loadProfile: LoadProfile,
  intent: Intent,
  stats: RulesEngineInput['aggregatedStats'],
  reasonCodes: string[]
): DecisionResultType | null {
  const profile = rulesConfig.profiles[loadProfile];
  if (!profile) return null;

  const limits = profile.limits;

  // Check daily commitments
  if (stats.dailyCommitments >= limits.daily_commitments) {
    reasonCodes.push('DAILY_LIMIT_REACHED');
    return 'FORBID';
  }

  // Check weekly money requests
  if (intent === 'money' && stats.weeklyMoneyRequests >= limits.weekly_money_requests) {
    reasonCodes.push('WEEKLY_MONEY_LIMIT');
    return 'FORBID';
  }

  // Check weekly time blocks
  if (intent === 'time' && stats.weeklyTimeBlocks >= limits.weekly_time_blocks) {
    reasonCodes.push('WEEKLY_TIME_LIMIT');
    return 'FORBID';
  }

  // Check concurrent projects
  if (intent === 'work-change' && stats.concurrentProjects >= limits.concurrent_projects) {
    reasonCodes.push('PROJECT_LIMIT_REACHED');
    return 'DEFER';
  }

  return null;
}

// =============================================
// GATE 5: Intent Policies
// =============================================
function applyIntentPolicies(
  parsedRequest: RulesEngineInput['parsedRequest'],
  userProfile: RulesEngineInput['userProfile'],
  reasonCodes: string[]
): { result: DecisionResultType | null; templateKey: string; requiresCalendar: boolean } {
  const intent = parsedRequest.intent;
  let requiresCalendar = false;
  let templateKey = 'allow_default';

  // Money policy
  if (intent === 'money') {
    const moneyPolicy = userProfile.moneyPolicy;
    
    // Check if actor is allowed
    if (!moneyPolicy.allowedActors.includes(parsedRequest.actorType)) {
      reasonCodes.push('ACTOR_NOT_ALLOWED_FOR_MONEY');
      return { result: 'FORBID', templateKey: 'money_forbid', requiresCalendar: false };
    }
    
    // Check if return date is required but missing
    if (moneyPolicy.requireReturnDate && !parsedRequest.params.returnDate) {
      reasonCodes.push('MISSING_RETURN_DATE');
      return { result: 'DEFER', templateKey: 'money_defer', requiresCalendar: false };
    }
    
    // Check max amount
    if (moneyPolicy.maxAmount && parsedRequest.params.amount) {
      if (parsedRequest.params.amount > moneyPolicy.maxAmount) {
        reasonCodes.push('EXCEEDS_MAX_AMOUNT');
        return { result: 'FORBID', templateKey: 'money_forbid', requiresCalendar: false };
      }
    }
  }

  // Time policy - requires calendar
  if (intent === 'time') {
    requiresCalendar = true;
    
    if (!parsedRequest.params.duration) {
      reasonCodes.push('MISSING_DURATION');
      return { result: 'DEFER', templateKey: 'defer_need_info', requiresCalendar: true };
    }
  }

  // Intro policy - requires two-line pitch
  if (intent === 'intro') {
    if (!parsedRequest.params.twoLinePitch) {
      reasonCodes.push('MISSING_PITCH');
      return { result: 'DEFER', templateKey: 'intro_need_pitch', requiresCalendar: false };
    }
  }

  // Support policy
  if (intent === 'support') {
    const supportPolicy = userProfile.supportPolicy;
    
    if (!supportPolicy.allowedActors.includes(parsedRequest.actorType)) {
      reasonCodes.push('ACTOR_NOT_ALLOWED_FOR_SUPPORT');
      return { result: 'FORBID', templateKey: 'forbid_policy', requiresCalendar: false };
    }
  }

  // Attention and work-change may require calendar
  if (intent === 'attention' || intent === 'work-change') {
    if (parsedRequest.params.duration) {
      requiresCalendar = true;
    }
  }

  return { result: null, templateKey, requiresCalendar };
}

// =============================================
// GATE 6: Calendar Availability
// =============================================
function applyCalendarGate(
  calendarAvailable: boolean | undefined,
  calendarConnected: boolean,
  reasonCodes: string[]
): DecisionResultType | null {
  if (!calendarConnected) {
    reasonCodes.push('CALENDAR_NOT_CONNECTED');
    return 'DEFER';
  }

  if (calendarAvailable === false) {
    reasonCodes.push('NO_CALENDAR_SLOT');
    return 'DEFER';
  }

  return null;
}

// =============================================
// UTILITY: Get template text
// =============================================
export function getTemplateText(templateKey: string): string {
  const template = rulesConfig.templates[templateKey as keyof typeof rulesConfig.templates];
  return template?.text || rulesConfig.templates.allow_default.text;
}

// =============================================
// UTILITY: Get all templates
// =============================================
export function getAllTemplates(): typeof rulesConfig.templates {
  return rulesConfig.templates;
}

