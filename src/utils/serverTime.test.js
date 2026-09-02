import {
    parseServerTime,
    serverTimeMs,
    toIsoUtc,
    withServerTimezone,
} from './serverTime';

describe('withServerTimezone', () => {
    it('reads a naive server datetime as UTC', () => {
        expect(withServerTimezone('2026-09-02T03:38:37')).toBe('2026-09-02T03:38:37Z');
        expect(withServerTimezone('2026-09-02T03:38:37.534879')).toBe('2026-09-02T03:38:37.534879Z');
    });

    it('accepts the space separator the API can emit', () => {
        expect(withServerTimezone('2026-09-02 03:38:37')).toBe('2026-09-02T03:38:37Z');
    });

    it('leaves a value that already names its clock alone', () => {
        expect(withServerTimezone('2026-09-02T03:38:37Z')).toBe('2026-09-02T03:38:37Z');
        expect(withServerTimezone('2026-09-02T03:38:37+00:00')).toBe('2026-09-02T03:38:37+00:00');
        expect(withServerTimezone('2026-09-01T23:38:37-04:00')).toBe('2026-09-01T23:38:37-04:00');
    });

    it('reads a bare date as UTC midnight, not as a negative offset', () => {
        expect(withServerTimezone('2026-09-02')).toBe('2026-09-02Z');
        expect(parseServerTime('2026-09-02').toISOString()).toBe('2026-09-02T00:00:00.000Z');
    });

    it('passes through anything that is not an ISO date-time string', () => {
        expect(withServerTimezone(1756784317000)).toBe(1756784317000);
        expect(withServerTimezone(null)).toBe(null);
        expect(withServerTimezone(undefined)).toBe(undefined);
        expect(withServerTimezone('not a date')).toBe('not a date');
    });
});

describe('parseServerTime', () => {
    it('puts a naive server value and an app-written value on the same clock', () => {
        // The exact pair the sidebar used to sort against each other. Before this they were
        // four hours apart in America/Detroit; they name the same instant.
        const fromServer = parseServerTime('2026-09-02T03:38:37.534');
        const fromApp = parseServerTime('2026-09-02T03:38:37.534Z');
        expect(fromServer.getTime()).toBe(fromApp.getTime());
    });

    it('is null for a value that names no moment', () => {
        expect(parseServerTime(null)).toBeNull();
        expect(parseServerTime('')).toBeNull();
        expect(parseServerTime('not a date')).toBeNull();
    });
});

describe('serverTimeMs', () => {
    it('orders a server timestamp against one the app wrote', () => {
        const older = serverTimeMs('2026-09-02T03:00:00');          // server, naive UTC
        const newer = serverTimeMs('2026-09-02T03:30:00.000Z');     // app, ISO UTC
        expect(newer).toBeGreaterThan(older);
    });

    it('is null rather than NaN, so a comparator stays well defined', () => {
        expect(serverTimeMs(undefined)).toBeNull();
    });
});

describe('toIsoUtc', () => {
    it('normalises a server value for storing next to app-written ones', () => {
        expect(toIsoUtc('2026-09-02T03:38:37')).toBe('2026-09-02T03:38:37.000Z');
    });

    it('is null when the value cannot be read', () => {
        expect(toIsoUtc('nonsense')).toBeNull();
    });
});
