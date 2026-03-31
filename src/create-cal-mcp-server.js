import * as z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createCalClient, CalApiError } from './cal-api.js';
import { log } from './logger.js';

function errText(err) {
  if (err instanceof CalApiError) {
    return JSON.stringify(
      {
        error: err.message,
        status: err.status,
        body: err.body,
      },
      null,
      2
    );
  }
  return err?.message || String(err);
}

export function createCalMcpServer() {
  const apiKey = process.env.CAL_API_KEY;
  const cal = createCalClient(apiKey);

  const server = new McpServer(
    {
      name: 'cal-com-scheduling',
      version: '1.0.0',
    },
    {
      instructions:
        'Cal.com scheduling: call list_event_types to discover event types (id, slug, username). ' +
        'get_availability needs start and end (date or ISO UTC) plus eventTypeId OR eventTypeSlug with username/teamSlug as per Cal.com docs. ' +
        'Bookings use UTC ISO times for start.',
    }
  );

  server.registerTool(
    'list_event_types',
    {
      description:
        'List event types for the authenticated account. Optional filters: username, eventSlug, sortCreatedAt (asc|desc).',
      inputSchema: z.object({
        username: z.string().optional().describe('Cal.com username to filter'),
        eventSlug: z.string().optional().describe('Requires username if set'),
        orgSlug: z.string().optional(),
        sortCreatedAt: z.enum(['asc', 'desc']).optional(),
      }),
    },
    async (args) => {
      try {
        const data = await cal.listEventTypes(args);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        log.error('list_event_types', 'Cal.com request failed', e);
        return { isError: true, content: [{ type: 'text', text: errText(e) }] };
      }
    }
  );

  server.registerTool(
    'get_availability',
    {
      description:
        'Get available booking slots for an event type. Requires start and end (YYYY-MM-DD or ISO UTC). ' +
        'Provide eventTypeId OR (eventTypeSlug + username or teamSlug). See Cal.com /v2/slots docs for dynamic/org options.',
      inputSchema: z.object({
        start: z.string().describe('Range start (UTC), e.g. 2026-04-01 or 2026-04-01T00:00:00Z'),
        end: z.string().describe('Range end (UTC)'),
        eventTypeId: z.coerce.number().int().positive().optional(),
        eventTypeSlug: z.string().optional(),
        username: z.string().optional(),
        teamSlug: z.string().optional(),
        organizationSlug: z.string().optional(),
        usernames: z.string().optional().describe('Comma-separated for dynamic event types'),
        timeZone: z.string().optional(),
        duration: z.coerce.number().optional(),
        format: z.enum(['time', 'range']).optional(),
        bookingUidToReschedule: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        const { start, end, ...rest } = args;
        if (!start || !end) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Validation error: start and end are required' }],
          };
        }
        const data = await cal.getSlots({ start, end, ...rest });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        log.error('get_availability', 'Cal.com request failed', e);
        return { isError: true, content: [{ type: 'text', text: errText(e) }] };
      }
    }
  );

  server.registerTool(
    'create_booking',
    {
      description:
        'Create a booking. Needs start (ISO UTC), attendee (name, email, timeZone), and eventTypeId OR slug + username/teamSlug.',
      inputSchema: z.object({
        start: z.string().describe('Booking start in ISO 8601 UTC'),
        attendee: z.object({
          name: z.string(),
          email: z.string().email(),
          timeZone: z.string(),
        }),
        eventTypeId: z.coerce.number().int().positive().optional(),
        eventTypeSlug: z.string().optional(),
        username: z.string().optional(),
        teamSlug: z.string().optional(),
        organizationSlug: z.string().optional(),
        guests: z.array(z.string().email()).optional(),
        lengthInMinutes: z.coerce.number().optional(),
        metadata: z.record(z.string(), z.string()).optional(),
      }),
    },
    async (args) => {
      try {
        const data = await cal.createBooking(args);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        log.error('create_booking', 'Cal.com request failed', e);
        return { isError: true, content: [{ type: 'text', text: errText(e) }] };
      }
    }
  );

  server.registerTool(
    'cancel_booking',
    {
      description: 'Cancel a booking by bookingUid (from create_booking / Cal.com).',
      inputSchema: z.object({
        bookingUid: z.string().min(1),
        cancellationReason: z.string().optional(),
        cancelSubsequentBookings: z.boolean().optional(),
      }),
    },
    async ({ bookingUid, cancellationReason, cancelSubsequentBookings }) => {
      try {
        const body = {};
        if (cancellationReason !== undefined) body.cancellationReason = cancellationReason;
        if (cancelSubsequentBookings !== undefined) body.cancelSubsequentBookings = cancelSubsequentBookings;
        const data = await cal.cancelBooking(bookingUid, body);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        log.error('cancel_booking', 'Cal.com request failed', e);
        return { isError: true, content: [{ type: 'text', text: errText(e) }] };
      }
    }
  );

  server.registerTool(
    'reschedule_booking',
    {
      description: 'Reschedule a booking to a new start time (ISO UTC). Optional rescheduledBy email and reschedulingReason.',
      inputSchema: z.object({
        bookingUid: z.string().min(1),
        start: z.string().describe('New start time ISO 8601 UTC'),
        rescheduledBy: z.string().email().optional(),
        reschedulingReason: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        const { bookingUid, ...body } = args;
        const data = await cal.rescheduleBooking(bookingUid, body);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        log.error('reschedule_booking', 'Cal.com request failed', e);
        return { isError: true, content: [{ type: 'text', text: errText(e) }] };
      }
    }
  );

  return server;
}
