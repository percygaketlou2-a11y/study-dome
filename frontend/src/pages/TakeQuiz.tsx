import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'
import { AnimatedNumber } from '../components/AnimatedNumber'

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

  const answeredCount = quiz ? quiz.questions.filter((q) => (answers[q.id] ?? '').trim().length > 0).length : 0
  const allAnswered = quiz ? answeredCount === quiz.questions.length : false

  return (
    <Layout>
      <Link
        to={state?.subjectId ? `/subjects/${state.subjectId}` : '/'}
        className="text-sm font-medium text-indigo-600 hover:underline"
      >
        &larr; Back
      </Link>
      <h1 className="page-title mt-2">{quiz?.title ?? state?.title ?? 'Quiz'}</h1>
      {quiz && (
        <p className="mt-1 text-sm text-slate-500">
          {quiz.totalMarks} marks{quiz.timeLimitMinutes ? ` · ${quiz.timeLimitMinutes} minutes` : ''}
        </p>
      )}

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading quiz...</p>}

      {isError && (
        <div className="card mt-6 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{getErrorMessage(error)}</p>
          <Link to="/upgrade" className="btn-primary mt-3">
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
          <div className="card sticky top-16 z-10 flex items-center gap-3 px-4 py-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${quiz.questions.length ? (answeredCount / quiz.questions.length) * 100 : 0}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-500">
              {answeredCount}/{quiz.questions.length} answered
            </span>
          </div>

          {quiz.questions.map((q, idx) => (
            <div key={q.id} className="card p-5">
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
                  className="field-input mt-3"
                  placeholder="Your answer"
                />
              ) : (
                <div className="mt-3 space-y-2">
                  {q.options?.map((opt) => {
                    const selected = answers[q.id] === opt.id
                    return (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                            : 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={opt.id}
                          checked={selected}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        {opt.optionText}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {submitMutation.isError && (
            <p className="text-sm text-red-600">{getErrorMessage(submitMutation.error)}</p>
          )}

          <button type="submit" disabled={!allAnswered || submitMutation.isPending} className="btn-primary">
            {submitMutation.isPending ? 'Submitting...' : 'Submit quiz'}
          </button>
        </form>
      )}

      {result && (
        <div className="mt-6 space-y-6">
          <div className="animate-pop-in card flex items-center gap-5 border-indigo-200 bg-indigo-50 p-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
              <AnimatedNumber value={result.score} />%
            </div>
            <div>
              <p className="font-semibold text-indigo-900">
                {result.marksAwarded}/{result.totalMarks} marks
              </p>
              <p className="text-sm text-indigo-700">{result.correctCount}/{result.totalQuestions} correct</p>
              <p className="mt-1 text-sm font-medium text-indigo-600">
                {result.score >= 80
                  ? "Excellent work! That's a strong result."
                  : result.score >= 50
                    ? 'Nice work — review what you missed below.'
                    : "Marked instantly, so you can see exactly what to revise next."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {result.feedback.map((f, idx) => (
              <div
                key={f.questionId}
                style={{ animationDelay: `${idx * 60}ms` }}
                className={`animate-fade-up rounded-xl border p-4 ${
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
                  <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Why: </span>
                    {f.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Link to={state?.subjectId ? `/subjects/${state.subjectId}` : '/'} className="btn-primary">
            Back to subject
          </Link>
        </div>
      )}
    </Layout>
  )
}
