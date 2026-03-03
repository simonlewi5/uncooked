// Smoke test — verifies the test harness is working.
// Real tests live alongside their components (e.g. Foo.test.tsx next to Foo.tsx).
import { describe, it, expect } from 'vitest'

describe('test harness', () => {
  it('works', () => {
    expect(true).toBe(true)
  })
})
