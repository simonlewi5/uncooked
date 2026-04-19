import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ActivityType, StructuredErrorResponse } from '@/types'

type QueueItem = {
  eventType: string
  metadata: Record<string, unknown>
  sessionId: string
  durationSeconds: number
}

const FORBIDDEN_METADATA_KEYS = new Set([
  'resumeContent',
  'resumeText',
  'interviewAnswer',
  'answerText',
  'companyName',
  'jobDescription',
  'rawContent',
])

const scrubMetadata = (metadata?: Record<string, unknown>): Record<string, unknown> => {
  if (!metadata) return {}

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.has(key)) continue

    if (
      value === null ||
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'string'
    ) {
      if (typeof value === 'string' && value.length > 120) continue
      sanitized[key] = value
    }
  }

  return sanitized
}

export function useTrackActivity(activityType: ActivityType) {
  const { user } = useAuth()
  const [isPreferenceLoaded, setIsPreferenceLoaded] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [lastError, setLastError] = useState<StructuredErrorResponse | null>(null)

  const queueRef = useRef<QueueItem[]>([])
  const timerRef = useRef<number | null>(null)
  const flushingRef = useRef(false)
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const sessionStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    sessionIdRef.current = crypto.randomUUID()
    sessionStartedAtRef.current = null
  }, [activityType, user?.id])

  useEffect(() => {
    let cancelled = false

    setIsPreferenceLoaded(false)
    setEnabled(true)

    if (!user?.id) {
      setIsPreferenceLoaded(true)
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('analytics_tracking_enabled')
        .eq('id', user.id)
        .single()

      if (cancelled) return

      if (error) {
        setLastError({ message: error.message, code: 'preference_fetch_failed' })
        setIsPreferenceLoaded(true)
        return
      }

      setEnabled(data?.analytics_tracking_enabled !== false)
      setIsPreferenceLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const flushNow = useCallback(async () => {
    if (flushingRef.current) return
    if (!user?.id || !enabled) return
    if (queueRef.current.length === 0) return

    flushingRef.current = true
    const batch = queueRef.current.splice(0, queueRef.current.length)

    const results = await Promise.allSettled(
      batch.map((item) =>
        supabase.functions.invoke('activity-events', {
          body: {
            activity_type: activityType,
            event_type: item.eventType,
            metadata: item.metadata,
            session_id: item.sessionId,
            duration_seconds: item.durationSeconds,
          },
        })
      )
    )

    const failed = results.find((result) => result.status === 'rejected')
    if (failed?.status === 'rejected') {
      const message = failed.reason instanceof Error ? failed.reason.message : 'flush_failed'
      setLastError({ message, code: 'flush_failed' })
    }

    flushingRef.current = false
  }, [activityType, enabled, user?.id])

  const scheduleFlush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void flushNow()
    }, 500)
  }, [flushNow])

  const trackEvent = useCallback(
    (eventType: string, metadata?: Record<string, unknown>, durationOverride?: number) => {
      if (!user?.id || !enabled) return

      queueMicrotask(() => {
        if (sessionStartedAtRef.current === null) {
          sessionStartedAtRef.current = Date.now()
        }

        const elapsedSeconds = durationOverride ?? Math.max(
          0,
          Math.floor((Date.now() - sessionStartedAtRef.current) / 1000)
        )

        queueRef.current.push({
          eventType,
          metadata: scrubMetadata(metadata),
          sessionId: sessionIdRef.current,
          durationSeconds: elapsedSeconds,
        })

        if (queueRef.current.length >= 10) {
          void flushNow()
        } else {
          scheduleFlush()
        }
      })
    },
    [enabled, flushNow, scheduleFlush, user?.id]
  )

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  return useMemo(
    () => ({ trackEvent, isPreferenceLoaded, enabled, lastError }),
    [trackEvent, isPreferenceLoaded, enabled, lastError]
  )
}
