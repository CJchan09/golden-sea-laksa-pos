import { describe, expect, it } from 'vitest';
import { resolvePublicDemoMode } from './demo-mode';

describe('resolvePublicDemoMode', () => {
  it('enables the public experience when explicitly configured', () => {
    expect(resolvePublicDemoMode('true', false)).toBe(true);
  });

  it('lets an explicit private setting override development defaults', () => {
    expect(resolvePublicDemoMode('false', true)).toBe(false);
  });

  it('defaults local development to the friction-free demo', () => {
    expect(resolvePublicDemoMode(undefined, true)).toBe(true);
  });

  it('keeps unconfigured production builds private', () => {
    expect(resolvePublicDemoMode(undefined, false)).toBe(false);
  });
});
