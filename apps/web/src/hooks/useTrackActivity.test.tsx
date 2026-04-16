import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.fn()
const singleMock = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: (...args: unknown[]) => singleMock(...args),
        }),
      }),
    }),
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}))

import { useTrackActivity } from './useTrackActivity'

describe('useTrackActivity', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    invokeMock.mockReset()
    singleMock.mockReset()
    singleMock.mockResolvedValue({ data: { analytics_tracking_enabled: true }, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not fire events while preference is not loaded', async () => {
    singleMock.mockImplementationOnce(() => new Promise(() => {}))

    const { result } = renderHook(() => useTrackActivity('resume'))

    act(() => {
      result.current.trackEvent('resume_saved', { source: 'manual' })
    })

    await vi.advanceTimersByTimeAsync(600)
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('does not fire events when analytics tracking is disabled', async () => {
    singleMock.mockResolvedValueOnce({ data: { analytics_tracking_enabled: false }, error: null })

    const { result } = renderHook(() => useTrackActivity('resume'))

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      result.current.trackEvent('resume_saved', { source: 'manual' })
    })

    await vi.advanceTimersByTimeAsync(600)
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('strips forbidden metadata before enqueueing', async () => {
    invokeMock.mockResolvedValue({ data: {}, error: null })

    const { result } = renderHook(() => useTrackActivity('interview'))

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      result.current.trackEvent('question_answered', {
        answerText: 'private',
        lengthBucket: 'short',
      })
    })

    await vi.advanceTimersByTimeAsync(600)

    expect(invokeMock).toHaveBeenCalledTimes(1)
    const payload = invokeMock.mock.calls[0][1].body as { metadata: Record<string, unknown> }
    expect(payload.metadata.answerText).toBeUndefined()
    expect(payload.metadata.lengthBucket).toBe('short')
  })

  it('flushes batched events after 500ms debounce', async () => {
    invokeMock.mockResolvedValue({ data: {}, error: null })

    const { result } = renderHook(() => useTrackActivity('research'))

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      result.current.trackEvent('board_write', { action: 'context_add' })
      result.current.trackEvent('note_saved', { section: 'notes' })
    })

    expect(invokeMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(499)
    expect(invokeMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(invokeMock).toHaveBeenCalledTimes(2)
  })

  it('does not throw when flush fails', async () => {
    invokeMock.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useTrackActivity('resume'))

    await act(async () => {
      await Promise.resolve()
    })

    expect(() => {
      result.current.trackEvent('resume_saved', { source: 'manual' })
    }).not.toThrow()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
  })
})
