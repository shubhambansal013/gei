import { describe, it, expect, expectTypeOf } from 'vitest';
import type { ModuleId } from '../types';

/**
 * Pin the `ModuleId` union so a future edit that re-introduces DPR /
 * LABOUR or drops WORKERS fails typecheck loudly rather than drifting
 * silently past the canonical `modules` seed in `schema.sql`.
 */
describe('ModuleId union', () => {
  it('includes WORKERS (post-rename) and the other core modules', () => {
    expectTypeOf<'WORKERS'>().toMatchTypeOf<ModuleId>();
    expectTypeOf<'INVENTORY'>().toMatchTypeOf<ModuleId>();
    expectTypeOf<'LOCATION'>().toMatchTypeOf<ModuleId>();
    expectTypeOf<'REPORTS'>().toMatchTypeOf<ModuleId>();
  });

  it('excludes the retired DPR and LABOUR ids', () => {
    // @ts-expect-error DPR must no longer be assignable to ModuleId
    const _dpr: ModuleId = 'DPR';
    // @ts-expect-error LABOUR must no longer be assignable to ModuleId (renamed to WORKERS)
    const _labour: ModuleId = 'LABOUR';
    // Use the bindings so lint doesn't flag them as unused.
    expect(_dpr).toBe('DPR');
    expect(_labour).toBe('LABOUR');
  });

  it('has exactly four member ids', () => {
    const all: readonly ModuleId[] = ['INVENTORY', 'WORKERS', 'LOCATION', 'REPORTS'];
    expect(new Set(all).size).toBe(4);
  });
});
