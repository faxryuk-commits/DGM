// Personal Decision & Commitment OS - Google Calendar OAuth (Client-side)
// OAuth flow через фронтенд

export interface GoogleCalendarTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

/**
 * Get Google Calendar OAuth URL
 * Client-side only - uses NEXT_PUBLIC_ env vars
 */
export function getGoogleCalendarAuthUrl(userId: string): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/auth/google/callback`
    : '';

  if (!clientId) {
    throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID not configured');
  }

  const scope = encodeURIComponent(
    'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events'
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scope,
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh token
    state: userId, // Pass userId in state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens (client-side)
 * Note: This requires client secret, so should be done server-side
 * But we can use a server endpoint for this
 */
export async function exchangeCodeForTokens(
  code: string,
  userId: string
): Promise<GoogleCalendarTokens> {
  const response = await fetch('/api/auth/google/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to exchange code for tokens');
  }

  return response.json();
}

/**
 * Save tokens to user profile
 */
export async function saveCalendarTokens(
  userId: string,
  tokens: GoogleCalendarTokens
): Promise<void> {
  const response = await fetch('/api/user/calendar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save calendar tokens');
  }
}

