// Personal Decision & Commitment OS - Type Definitions
// Based on 02_TECHNICAL_SPEC.txt

// =============================================
// ENUMS
// =============================================

export type Role = 'creator' | 'manager' | 'expert' | 'helper' | 'executor';

export type Intent = 
  | 'money'
  | 'time'
  | 'attention'
  | 'work-change'
  | 'support'
  | 'intro'
  | 'errand'
  | 'decision-pressure'
  | 'emotional-load';

export type ActorType = 'friend' | 'client' | 'team' | 'family' | 'unknown';

export type LoadProfile = 'A' | 'B' | 'C';

export type EnergyLevel = 'green' | 'yellow' | 'red';

export type DecisionResultType = 'ALLOW' | 'DEFER' | 'FORBID';

export type CommitmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

// =============================================
// DATA STRUCTURES
// =============================================

export interface ParsedRequest {
  intent: Intent;
  secondaryIntents?: Intent[];
  actorType: ActorType;
  params: {
    amount?: number;
    returnDate?: string;
    agenda?: string;
    duration?: number; // minutes
    twoLinePitch?: string;
  };
  decisionPressure: boolean;
}

export interface UserProfile {
  userId: string;
  primaryRole: Role;
  secondaryRole?: Role;
  loadProfile: LoadProfile;
  moneyPolicy: MoneyPolicy;
  supportPolicy: SupportPolicy;
  hardRules: string[];
  calendarConnected: boolean;
}

export interface MoneyPolicy {
  maxAmount?: number;
  requireReturnDate: boolean;
  allowedActors: ActorType[];
}

export interface SupportPolicy {
  maxWeekly: number;
  allowedActors: ActorType[];
}

export interface DynamicState {
  userId: string;
  energyLevel: EnergyLevel;
}

export interface AggregatedStats {
  dailyCommitments: number;
  weeklyMoneyRequests: number;
  weeklyTimeBlocks: number;
  concurrentProjects: number;
  weeklySupport: number;
}

// =============================================
// RULES ENGINE TYPES
// =============================================

export interface RulesEngineInput {
  parsedRequest: ParsedRequest;
  userProfile: UserProfile;
  dynamicState: DynamicState;
  aggregatedStats: AggregatedStats;
  calendarAvailable?: boolean;
}

export interface RulesEngineOutput {
  result: DecisionResultType;
  reasonCodes: string[];
  templateKey: string;
  requiresCalendar: boolean;
}

// =============================================
// CONFIG TYPES
// =============================================

export interface RoleConfig {
  id: Role;
  name: string;
  description: string;
}

export interface IntentConfig {
  id: Intent;
  name: string;
  resource: string;
  description: string;
}

export interface ProfileLimits {
  daily_commitments: number;
  weekly_money_requests: number;
  weekly_time_blocks: number;
  concurrent_projects: number;
}

export interface ProfileConfig {
  name: string;
  description: string;
  limits: ProfileLimits;
}

export interface TemplateConfig {
  key: string;
  text: string;
  result: DecisionResultType;
}

export interface RulesConfig {
  roles: RoleConfig[];
  intents: IntentConfig[];
  role_intent_matrix: Record<Role, Record<Intent, DecisionResultType | 'CONDITIONAL'>>;
  profiles: Record<LoadProfile, ProfileConfig>;
  policies: Record<string, unknown>;
  templates: Record<string, TemplateConfig>;
  system_rules: Array<{
    id: string;
    description: string;
    gate: number;
    action: string;
  }>;
  energy_rules: Record<EnergyLevel, {
    modifier: string;
    description: string;
  }>;
  actor_trust_levels: Record<ActorType, number>;
}

// =============================================
// ONBOARDING TYPES
// =============================================

export interface OnboardingState {
  step: number;
  primaryRole?: Role;
  secondaryRole?: Role;
  loadProfile?: LoadProfile;
  moneyPolicy?: MoneyPolicy;
  supportPolicy?: SupportPolicy;
  hardRules?: string[];
  calendarConnected?: boolean;
}

export const ONBOARDING_STEPS = [
  'intro',
  'role_diagnostic',
  'load_profile',
  'money_policy',
  'support_policy',
  'hard_rules',
  'calendar_connect',
  'confirm'
] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number];

