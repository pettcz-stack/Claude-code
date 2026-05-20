import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth.js';
import { floorToHour } from '../src/services/aggregate.js';
import { minutesLabel } from '../src/util.js';

describe('auth – hashování hesla', () => {
  it('ověří správné heslo a odmítne špatné', () => {
    const stored = hashPassword('Tajne123');
    expect(verifyPassword('Tajne123', stored)).toBe(true);
    expect(verifyPassword('spatne', stored)).toBe(false);
  });

  it('stejné heslo dává různý hash (salt)', () => {
    expect(hashPassword('x')).not.toBe(hashPassword('x'));
  });
});

describe('aggregate – floorToHour', () => {
  it('zarovná na začátek hodiny v UTC', () => {
    const r = floorToHour(new Date('2026-05-20T09:37:42.123Z'));
    expect(r.toISOString()).toBe('2026-05-20T09:00:00.000Z');
  });
});

describe('util – minutesLabel', () => {
  it('formátuje minuty', () => {
    expect(minutesLabel(45)).toBe('45 min');
    expect(minutesLabel(90)).toBe('1 h 30 min');
  });
});
