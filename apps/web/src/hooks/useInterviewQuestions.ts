import { useState, useCallback, useEffect, useRef } from 'react'
import type { InterviewQuestion, InterviewStyle } from '@/types'
import type { ExtractedQuestion } from '@/utils/extractQuestions'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface UseInterviewQuestionsReturn {
  questions: InterviewQuestion[]
  isGenerating: boolean
  generateQuestions: (
    jobDescription: string,
    companyName: string,
    style: InterviewStyle,
    sessionId: string | null,
    companyProfileId: string | null,
  ) => Promise<void>
  addExtractedQuestions: (
    extracted: ExtractedQuestion[],
    sessionId: string | null,
    companyName: string,
    companyProfileId: string | null,
    chatMessageId: string,
  ) => Promise<void>
  toggleBookmark: (questionId: string) => Promise<void>
  updateNotes: (questionId: string, notes: string) => void
}

function mapRow(row: Record<string, unknown>): InterviewQuestion {
  return {
    id: row.id as string,
    interviewSessionId: (row.interview_session_id as string | null) ?? null,
    companyProfileId: (row.company_profile_id as string | null) ?? null,
    companyName: row.company_name as string,
    questionText: row.question_text as string,
    category: (row.category as string | null) ?? null,
    source: row.source as 'pre_generated' | 'chat_extracted',
    isBookmarked: row.is_bookmarked as boolean,
    answerNotes: (row.answer_notes as string | null) ?? null,
    chatMessageId: (row.chat_message_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

export function useInterviewQuestions(
  sessionId: string | null,
  companyName?: string,
): UseInterviewQuestionsReturn {
  const { user } = useAuth()
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const notesTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Fetch questions when session changes
  useEffect(() => {
    if (!user) return

    let query = supabase
      .from('interview_questions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (sessionId) {
      query = query.eq('interview_session_id', sessionId)
    } else if (companyName?.trim()) {
      // No DB session yet — fetch questions generated for this company without a session
      query = query.is('interview_session_id', null).eq('company_name', companyName.trim())
    } else {
      // No active session — show bookmarked questions as a question bank
      query = query.eq('is_bookmarked', true)
    }

    query.then(({ data, error }) => {
      if (error) {
        console.error('Failed to fetch questions:', error)
        return
      }
      setQuestions((data ?? []).map(mapRow))
    })
  }, [sessionId, companyName, user])

  const generateQuestions = useCallback(
    async (
      jobDescription: string,
      companyName: string,
      style: InterviewStyle,
      currentSessionId: string | null,
      companyProfileId: string | null,
    ) => {
      if (!user) return
      setIsGenerating(true)

      try {
        // Optionally fetch user's primary resume for personalization
        let resumeContent: string | undefined
        const { data: resumeData } = await supabase
          .from('resumes')
          .select('content')
          .eq('user_id', user.id)
          .eq('is_primary', true)
          .limit(1)

        if (resumeData && resumeData.length > 0 && resumeData[0].content) {
          resumeContent = resumeData[0].content as string
        }

        const { data, error } = await supabase.functions.invoke<{
          questions?: Array<{ text: string; category: string }>
          error?: string
        }>('generate-questions', {
          body: {
            jobDescription,
            companyName,
            interviewStyle: style,
            resumeContent,
          },
        })

        if (error || data?.error || !data?.questions) {
          console.error('Failed to generate questions:', error || data?.error)
          return
        }

        // Insert into DB
        const rows = data.questions.map((q) => ({
          user_id: user.id,
          interview_session_id: currentSessionId,
          company_profile_id: companyProfileId,
          company_name: companyName.trim(),
          question_text: q.text,
          category: q.category,
          source: 'pre_generated' as const,
        }))

        const { data: inserted, error: insertError } = await supabase
          .from('interview_questions')
          .insert(rows)
          .select('*')

        if (insertError) {
          console.error('Failed to insert questions:', insertError)
          return
        }

        setQuestions((prev) => [...prev, ...(inserted ?? []).map(mapRow)])
      } finally {
        setIsGenerating(false)
      }
    },
    [user],
  )

  const addExtractedQuestions = useCallback(
    async (
      extracted: ExtractedQuestion[],
      currentSessionId: string | null,
      companyName: string,
      companyProfileId: string | null,
      chatMessageId: string,
    ) => {
      if (!user || extracted.length === 0) return

      // Deduplicate against existing questions in this session
      const existingTexts = new Set(
        questions
          .filter((q) => q.interviewSessionId === currentSessionId)
          .map((q) => q.questionText.toLowerCase()),
      )

      const newQuestions = extracted.filter(
        (q) => !existingTexts.has(q.text.toLowerCase()),
      )

      if (newQuestions.length === 0) return

      const rows = newQuestions.map((q) => ({
        user_id: user.id,
        interview_session_id: currentSessionId,
        company_profile_id: companyProfileId,
        company_name: companyName.trim(),
        question_text: q.text,
        category: q.category,
        source: 'chat_extracted' as const,
        chat_message_id: chatMessageId,
      }))

      const { data: inserted, error } = await supabase
        .from('interview_questions')
        .insert(rows)
        .select('*')

      if (error) {
        console.error('Failed to insert extracted questions:', error)
        return
      }

      setQuestions((prev) => [...prev, ...(inserted ?? []).map(mapRow)])
    },
    [user, questions],
  )

  const toggleBookmark = useCallback(
    async (questionId: string) => {
      const question = questions.find((q) => q.id === questionId)
      if (!question) return

      const newValue = !question.isBookmarked

      // Optimistic update
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, isBookmarked: newValue } : q)),
      )

      const { error } = await supabase
        .from('interview_questions')
        .update({ is_bookmarked: newValue })
        .eq('id', questionId)

      if (error) {
        console.error('Failed to toggle bookmark:', error)
        // Revert
        setQuestions((prev) =>
          prev.map((q) => (q.id === questionId ? { ...q, isBookmarked: !newValue } : q)),
        )
      }
    },
    [questions],
  )

  const updateNotes = useCallback(
    (questionId: string, notes: string) => {
      // Optimistic update
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, answerNotes: notes } : q)),
      )

      // Debounced save
      const existing = notesTimerRef.current.get(questionId)
      if (existing) clearTimeout(existing)

      notesTimerRef.current.set(
        questionId,
        setTimeout(async () => {
          const { error } = await supabase
            .from('interview_questions')
            .update({ answer_notes: notes })
            .eq('id', questionId)

          if (error) {
            console.error('Failed to save notes:', error)
          }
          notesTimerRef.current.delete(questionId)
        }, 500),
      )
    },
    [],
  )

  return {
    questions,
    isGenerating,
    generateQuestions,
    addExtractedQuestions,
    toggleBookmark,
    updateNotes,
  }
}
