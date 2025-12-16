// Personal Decision & Commitment OS - Google Calendar Adapter
// Calendar is the final arbiter
// Based on 02_TECHNICAL_SPEC.txt

export interface CalendarSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
}

/**
 * Google Calendar Adapter
 * Handles calendar integration for slot selection
 */
export class CalendarAdapter {
  private accessToken: string | null = null;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || null;
  }

  /**
   * Check if calendar is connected
   */
  isConnected(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Get OAuth URL for Google Calendar
   */
  static getAuthUrl(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      throw new Error('Google Calendar credentials not configured');
    }

    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events');
    
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline`;
  }

  /**
   * Exchange code for tokens
   */
  static async exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google Calendar credentials not configured');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  /**
   * Get available slots for a given date range
   */
  async getAvailableSlots(
    startDate: Date,
    endDate: Date,
    durationMinutes: number
  ): Promise<CalendarSlot[]> {
    if (!this.accessToken) {
      return this.getMockSlots(startDate, endDate, durationMinutes);
    }

    try {
      // Get busy times from Google Calendar
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            items: [{ id: 'primary' }],
          }),
        }
      );

      if (!response.ok) {
        return this.getMockSlots(startDate, endDate, durationMinutes);
      }

      const data = await response.json();
      const busyTimes = data.calendars?.primary?.busy || [];

      return this.calculateAvailableSlots(
        startDate,
        endDate,
        durationMinutes,
        busyTimes
      );
    } catch (error) {
      console.error('Calendar API error:', error);
      return this.getMockSlots(startDate, endDate, durationMinutes);
    }
  }

  /**
   * Create calendar event
   */
  async createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent | null> {
    if (!this.accessToken) {
      return {
        id: `mock-${Date.now()}`,
        ...event,
      };
    }

    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: event.title,
            description: event.description,
            start: {
              dateTime: event.start.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: event.end.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          }),
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      return {
        id: data.id,
        title: data.summary,
        start: new Date(data.start.dateTime),
        end: new Date(data.end.dateTime),
        description: data.description,
      };
    } catch (error) {
      console.error('Create event error:', error);
      return null;
    }
  }

  /**
   * Calculate available slots from busy times
   */
  private calculateAvailableSlots(
    startDate: Date,
    endDate: Date,
    durationMinutes: number,
    busyTimes: Array<{ start: string; end: string }>
  ): CalendarSlot[] {
    const slots: CalendarSlot[] = [];
    const slotDuration = durationMinutes * 60 * 1000;
    
    // Working hours: 9 AM to 6 PM
    const workStart = 9;
    const workEnd = 18;

    let current = new Date(startDate);
    
    while (current < endDate) {
      const hour = current.getHours();
      
      // Only during working hours
      if (hour >= workStart && hour < workEnd) {
        const slotEnd = new Date(current.getTime() + slotDuration);
        
        // Check if slot overlaps with busy times
        const isBusy = busyTimes.some(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return current < busyEnd && slotEnd > busyStart;
        });

        slots.push({
          start: new Date(current),
          end: slotEnd,
          available: !isBusy,
        });
      }

      // Move to next slot (30 min intervals)
      current = new Date(current.getTime() + 30 * 60 * 1000);
    }

    return slots;
  }

  /**
   * Generate mock slots when calendar not connected
   */
  private getMockSlots(
    startDate: Date,
    endDate: Date,
    durationMinutes: number
  ): CalendarSlot[] {
    const slots: CalendarSlot[] = [];
    const slotDuration = durationMinutes * 60 * 1000;
    
    let current = new Date(startDate);
    current.setHours(9, 0, 0, 0);

    while (current < endDate) {
      const hour = current.getHours();
      
      if (hour >= 9 && hour < 18) {
        const slotEnd = new Date(current.getTime() + slotDuration);
        
        // Random availability for mock
        const available = Math.random() > 0.3;

        slots.push({
          start: new Date(current),
          end: slotEnd,
          available,
        });
      }

      current = new Date(current.getTime() + 30 * 60 * 1000);
      
      // Skip to next day if past working hours
      if (current.getHours() >= 18) {
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
      }
    }

    return slots.slice(0, 20); // Limit to 20 slots
  }
}

export default CalendarAdapter;

