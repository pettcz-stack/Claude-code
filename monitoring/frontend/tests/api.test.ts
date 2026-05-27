/**
 * Unit testy pro api.ts. Zaměřuje se na to, co je důležité ze security
 * pohledu: že selfReportPublic / selfAudit posílají token v Authorization
 * headeru, NE v query stringu (regrese S1 by mohla vrátit token do URL).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from '../src/api';

describe('api – self-service token nesmí být v URL (S1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('selfReportPublic posílá token v Authorization headeru', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ report: {}, tips: {}, modes: {} }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }),
    );
    await api.selfReportPublic('super-secret-token', '2026-05-01T00:00Z', '2026-05-02T00:00Z');
    const [url, options] = fetchSpy.mock.calls[0];
    expect(String(url)).not.toContain('super-secret-token');
    expect(String(url)).not.toContain('token=');
    const headers = (options as RequestInit)?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer super-secret-token');
  });

  it('selfAudit posílá token v Authorization headeru', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ enabled: true, rows: [] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }),
    );
    await api.selfAudit('audit-token-xyz');
    const [url, options] = fetchSpy.mock.calls[0];
    expect(String(url)).not.toContain('audit-token-xyz');
    expect(String(url)).not.toContain('token=');
    const headers = (options as RequestInit)?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer audit-token-xyz');
  });

  it('changePassword vyhodí čitelnou chybu při wrong_old_password', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'wrong_old_password' }), {
        status: 403, headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(api.changePassword('old', 'new-strong-password')).rejects.toThrow(/wrong_old_password/);
  });
});
