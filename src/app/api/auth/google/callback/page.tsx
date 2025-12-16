// Personal Decision & Commitment OS - Google Calendar OAuth Callback
// Client-side callback page - handles OAuth redirect
// Based on 02_TECHNICAL_SPEC.txt

"use client";

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exchangeCodeForTokens, saveCalendarTokens } from '@/lib/calendar-oauth';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state'); // userId
      const error = searchParams.get('error');

      if (error) {
        router.push(`/?error=${encodeURIComponent('Calendar connection cancelled')}`);
        return;
      }

      if (!code || !state) {
        router.push('/?error=missing_params');
        return;
      }

      try {
        // Exchange code for tokens (via server API)
        const tokens = await exchangeCodeForTokens(code, state);

        // Save tokens to user profile
        await saveCalendarTokens(state, tokens);

        // Redirect back to app
        router.push('/?calendar_connected=true');
      } catch (error) {
        console.error('OAuth callback error:', error);
        router.push('/?error=oauth_failed');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Подключение календаря...</p>
      </div>
    </div>
  );
}

export default function GoogleCalendarCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}

