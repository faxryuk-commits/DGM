// Personal Decision & Commitment OS - AI Parser
// AI is ONLY a parser and structure extractor.
// AI output MUST be strict JSON.
// Based on 02_TECHNICAL_SPEC.txt

import type { ParsedRequest, Intent, ActorType } from './types';

/**
 * AI Parser - Structure Extractor
 * 
 * AI is allowed to:
 * - Parse raw text
 * - Extract intent
 * - Extract parameters
 * - Detect decision pressure
 * - Decompose complex requests
 * 
 * AI is NOT allowed to:
 * - Decide
 * - Recommend
 * - Judge
 * - Optimize behavior
 * - Change limits or rules
 */

const SYSTEM_PROMPT = `You are a request parser. Your ONLY job is to extract structured data from text.

You must output ONLY valid JSON. No explanations, no recommendations, no decisions.

Extract the following:
1. intent: One of: money, time, attention, work-change, support, intro, errand, decision-pressure, emotional-load
2. secondaryIntents: Array of additional intents (optional)
3. actorType: One of: friend, client, team, family, unknown
4. params: Object with any of: amount (number), returnDate (ISO date string), agenda (string), duration (minutes as number), twoLinePitch (string)
5. decisionPressure: boolean - true if the request contains urgency, ultimatums, guilt, or pressure tactics

Output format:
{
  "intent": "string",
  "secondaryIntents": ["string"] | null,
  "actorType": "string",
  "params": {
    "amount": number | null,
    "returnDate": "string" | null,
    "agenda": "string" | null,
    "duration": number | null,
    "twoLinePitch": "string" | null
  },
  "decisionPressure": boolean
}

Rules:
- NEVER add opinions
- NEVER make recommendations
- NEVER judge the request
- ONLY extract what is explicitly stated or clearly implied
- If unsure about intent, use the most likely one
- If no clear actor relationship, use "unknown"`;

interface LLMResponse {
  intent: string;
  secondaryIntents: string[] | null;
  actorType: string;
  params: {
    amount: number | null;
    returnDate: string | null;
    agenda: string | null;
    duration: number | null;
    twoLinePitch: string | null;
  };
  decisionPressure: boolean;
}

/**
 * Parse raw text into structured request using LLM
 * Returns JSON-only output
 */
export async function parseRequest(rawText: string): Promise<ParsedRequest> {
  const apiKey = process.env.LLM_API_KEY;
  const apiUrl = process.env.LLM_API_URL;

  if (!apiKey || !apiUrl) {
    // Fallback to rule-based parsing if no LLM configured
    return fallbackParser(rawText);
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: rawText },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('LLM API error:', response.status);
      return fallbackParser(rawText);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return fallbackParser(rawText);
    }

    const parsed: LLMResponse = JSON.parse(content);
    return transformToTypedRequest(parsed);
  } catch (error) {
    console.error('AI Parser error:', error);
    return fallbackParser(rawText);
  }
}

/**
 * Transform LLM response to typed ParsedRequest
 */
function transformToTypedRequest(response: LLMResponse): ParsedRequest {
  const validIntents: Intent[] = [
    'money', 'time', 'attention', 'work-change', 'support',
    'intro', 'errand', 'decision-pressure', 'emotional-load'
  ];
  
  const validActorTypes: ActorType[] = ['friend', 'client', 'team', 'family', 'unknown'];

  const intent = validIntents.includes(response.intent as Intent)
    ? (response.intent as Intent)
    : 'attention';

  const actorType = validActorTypes.includes(response.actorType as ActorType)
    ? (response.actorType as ActorType)
    : 'unknown';

  const secondaryIntents = response.secondaryIntents
    ?.filter((i): i is Intent => validIntents.includes(i as Intent))
    ?? undefined;

  return {
    intent,
    secondaryIntents: secondaryIntents?.length ? secondaryIntents : undefined,
    actorType,
    params: {
      amount: response.params.amount ?? undefined,
      returnDate: response.params.returnDate ?? undefined,
      agenda: response.params.agenda ?? undefined,
      duration: response.params.duration ?? undefined,
      twoLinePitch: response.params.twoLinePitch ?? undefined,
    },
    decisionPressure: response.decisionPressure ?? false,
  };
}

/**
 * Fallback rule-based parser when LLM is not available
 * Simple keyword matching - no AI decisions
 */
function fallbackParser(rawText: string): ParsedRequest {
  const text = rawText.toLowerCase();
  
  // Intent detection by keywords
  let intent: Intent = 'attention';
  
  if (text.includes('деньг') || text.includes('займ') || text.includes('руб') || 
      text.includes('money') || text.includes('loan') || text.includes('$') ||
      text.includes('заплат') || text.includes('долг')) {
    intent = 'money';
  } else if (text.includes('встреч') || text.includes('созвон') || text.includes('время') ||
             text.includes('meeting') || text.includes('call') || text.includes('schedule')) {
    intent = 'time';
  } else if (text.includes('помощь') || text.includes('support') || text.includes('помог')) {
    intent = 'support';
  } else if (text.includes('познаком') || text.includes('intro') || text.includes('контакт')) {
    intent = 'intro';
  } else if (text.includes('работ') || text.includes('проект') || text.includes('job') ||
             text.includes('work') || text.includes('change')) {
    intent = 'work-change';
  } else if (text.includes('поручен') || text.includes('errand') || text.includes('сделай')) {
    intent = 'errand';
  }

  // Actor type detection
  let actorType: ActorType = 'unknown';
  
  if (text.includes('друг') || text.includes('friend') || text.includes('товарищ')) {
    actorType = 'friend';
  } else if (text.includes('клиент') || text.includes('client') || text.includes('заказчик')) {
    actorType = 'client';
  } else if (text.includes('команд') || text.includes('team') || text.includes('коллег')) {
    actorType = 'team';
  } else if (text.includes('семь') || text.includes('family') || text.includes('род') ||
             text.includes('мам') || text.includes('пап') || text.includes('брат') ||
             text.includes('сестр')) {
    actorType = 'family';
  }

  // Decision pressure detection
  const pressureKeywords = [
    'срочно', 'urgent', 'немедленно', 'сейчас', 'быстро',
    'только ты', 'только вы', 'пожалуйста', 'очень нужно',
    'deadline', 'asap', 'важно', 'critical'
  ];
  const decisionPressure = pressureKeywords.some(kw => text.includes(kw));

  // Extract amount if money intent
  let amount: number | undefined;
  if (intent === 'money') {
    const amountMatch = rawText.match(/(\d+[\s,.]?\d*)/);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/[\s,]/g, ''));
    }
  }

  // Extract duration if time intent
  let duration: number | undefined;
  if (intent === 'time') {
    const hourMatch = rawText.match(/(\d+)\s*(час|hour|ч|h)/i);
    const minMatch = rawText.match(/(\d+)\s*(мин|min|м|m)/i);
    
    if (hourMatch) {
      duration = parseInt(hourMatch[1]) * 60;
    } else if (minMatch) {
      duration = parseInt(minMatch[1]);
    }
  }

  return {
    intent,
    actorType,
    params: {
      amount,
      duration,
    },
    decisionPressure,
  };
}

