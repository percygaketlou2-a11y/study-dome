import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'

type QuestionType = 'multiple_choice' | 'short_answer' | 'true_false'

interface Option {
  id: string
  optionText: string
}

interface Question {
  id: string
  questionText: string
  questionType: QuestionType
  marks: number
  options: Option[] | null
}

interface QuizData {
  id: string
  title: string
  timeLimitMinutes: number | null
  totalMarks: number
  questions: Question[]
}

interface FeedbackItem {
  questionId: string
  questionText: string
  marks: number
  submittedAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string | null
}

interface SubmitResult {
  resultId: string
  score: number
  marksAwarded: number
  totalMarks: number
  correctCount: number
  totalQuestions: number
  feedback: FeedbackItem[]
}

export function TakeQuiz() {
  const { quizId } = useParams<{ quizId: string }>()
  const location = useLocation()
  const state = location.state as { title?: string; subjectId?: string } | null
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<SubmitResult | null>(null)

  const { data: quiz, isLoading, isError, error } = useQuery({
    queryKey: ['quiz-take', quizId],
    queryFn: async () => (await api.get<QuizData>(`/quizzes/take/${quizId}`)).data,
    enabled: Boolean(quizId),
    retry: false,
  })

  const submitMutation = useMutation({
    mutationFn: async () =>
      (await api.post<SubmitResult>('/quizzes/submit', { quizId, answers })).data,
    onSuccess: (data) => setResult(data),
  })

  const allAnswered = quiz ? quiz.questions.every((q) => (answers[q.id] ?? '').trim().length > 0) : false

  return (
    <Layout>
      <Link
        to={state?.subjectId ? `/subjects/${state.subjectId}` : '/'}
        className="text-sm text-indigo-600 hover:underline"
      >
        &larr; Back
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{quiz?.title ?? state?.title ?? 'Quiz'}</h1>
      {quiz && (
        <p className="mt-1 text-sm text-slate-500">
          {quiz.totalMarks} marks{quiz.timeLimitMinutes ? ` · ${quiz.timeLimitMinutes} minutes` : ''}
        </p>
      )}

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading quiz...</p>}

      {isError && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{getErrorMessage(error)}</p>
          <Link
            to="/upgrade"
            className="mt-3 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            View Premium plan
          </Link>
        </div>
      )}

      {quiz && !result && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitMutation.mutate()
          }}
          className="mt-6 space-y-6"
        >
          {quiz.questions.map((q, idx) => (
            <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">
                  {idx + 1}. {q.questionText}
                </p>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                </span>
              </div>
              {q.questionType === 'short_answer' ? (
                <input
                  type="text"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Your answer"
                />
              ) : (
                <div className="mt-3 space-y-2">
                  {q.options?.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.id}
                        checked={answers[q.id] === opt.id}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                      />
                      {opt.optionText}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {submitMutation.isError && (
            <p className="text-sm text-red-600">{getErrorMessage(submitMutation.error)}</p>
          )}

          <button
            type="submit"
            disabled={!allAnswered || submitMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit quiz'}
          </button>
        </form>
      )}

      {result && (
        <div className="mt-6 space-y-6">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-5">
            <p className="text-lg font-semibold text-indigo-900">
              Score: {result.score}% ({result.marksAwarded}/{result.totalMarks} marks &middot; {result.correctCount}/
              {result.totalQuestions} correct)
            </p>
          </div>

          <div className="space-y-4">
            {result.feedback.map((f, idx) => (
              <div
                key={f.questionId}
                className={`rounded-lg border p-4 ${
                  f.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <p className="font-medium text-slate-900">
                  {idx + 1}. {f.questionText}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Your answer: <span className="font-medium">{f.submittedAnswer || '(blank)'}</span>
                </p>
                {!f.isCorrect && (
                  <p className="mt-1 text-sm text-slate-700">
                    Correct answer: <span className="font-medium">{f.correctAnswer}</span>
                  </p>
                )}
                <p className={`mt-1 text-xs font-semibold ${f.isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                  {f.isCorrect ? `Correct (${f.marks} ${f.marks === 1 ? 'mark' : 'marks'})` : 'Incorrect'}
                </p>
                {f.explanation && (
                  <p className="mt-2 rounded-md bg-white/60 px-3 py-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Why: </span>
                    {f.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Link
            to={state?.subjectId ? `/subjects/${state.subjectId}` : '/'}
            className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to subject
          </Link>
        </div>
      )}
    </Layout>
  )
}
