/**
 * Thin Cal.com API v2 client. Uses the cal-api-version required by each endpoint.
 */
export class CalApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'CalApiError';
    this.status = status;
    this.body = body;
  }
}

export function createCalClient(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('CAL_API_KEY is missing or invalid');
  }

  const base = (process.env.CAL_API_BASE_URL || 'https://api.cal.com').replace(/\/$/, '');

  async function request(path, { method = 'GET', calApiVersion, query, body } = {}) {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, `${base}/`);
    if (query && typeof query === 'object') {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === '') continue;
        url.searchParams.set(k, String(v));
      }
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'cal-api-version': calApiVersion,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      const msg =
        (parsed && typeof parsed === 'object' && (parsed.message || parsed.error)) ||
        (typeof parsed === 'string' ? parsed : res.statusText);
      throw new CalApiError(String(msg || `HTTP ${res.status}`), {
        status: res.status,
        body: parsed,
      });
    }

    return parsed;
  }

  return {
    listEventTypes(query) {
      return request('/v2/event-types', { calApiVersion: '2024-06-14', query });
    },

    getSlots(query) {
      return request('/v2/slots', { calApiVersion: '2024-09-04', query });
    },

    createBooking(payload) {
      return request('/v2/bookings', {
        method: 'POST',
        calApiVersion: '2026-02-25',
        body: payload,
      });
    },

    cancelBooking(bookingUid, payload) {
      return request(`/v2/bookings/${encodeURIComponent(bookingUid)}/cancel`, {
        method: 'POST',
        calApiVersion: '2026-02-25',
        body: payload ?? {},
      });
    },

    rescheduleBooking(bookingUid, payload) {
      return request(`/v2/bookings/${encodeURIComponent(bookingUid)}/reschedule`, {
        method: 'POST',
        calApiVersion: '2026-02-25',
        body: payload,
      });
    },
  };
}
