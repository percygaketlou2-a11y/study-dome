import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'

type QuestionType = 'multiple_choice' | 'short_answer' | 'true_false'

interface OptionDraft {
  optionText: string
  isCorrect: boolean
}

interface QuestionDraft {
  questionText: string
  questionType: QuestionType
  explanation: string
  marks: number
  options: OptionDraft[]
}

interface QuizListItem {
  id: string
  title: string
  isPremium: boolean
  subject: string
  curriculum: string
}

interface QuizFull {
  id: string
  subjectId: string
  title: string
  timeLimitMinutes: number | null
  isPremium: boolean
  questions: (QuestionDraft & { id: string; options: (OptionDraft & { id: string })[] })[]
}

interface AdminSubject {
  id: string
  name: string
  curriculum: { id: string; name: string }
}

function blankOptionsFor(type: QuestionType): OptionDraft[] {
  if (type === 'true_false') return [{ optionText: 'True', isCorrect: true }, { optionText: 'False', isCorrect: false }]
  if (type === 'short_answer') return [{ optionText: '', isCorrect: true }]
  return [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }]
}

function blankQuestion(): QuestionDraft {
  return { questionText: '', questionType: 'multiple_choice', explanation: '', marks: 1, options: blankOptionsFor('multiple_choice') }
}

export function AdminQuizBuilder() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null)

  const [subjectId, setSubjectId] = useState('')
  const [title, setTitle] = useState('')
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('')
  const [isPremium, setIsPremium] = useState(false)
  const [questions, setQuestions] = useState<QuestionDraft[]>([blankQuestion()])
  const [formError, setFormError] = useState<string | null>(null)

  const { data: quizzes } = useQuery({
    queryKey: ['admin-quizzes'],
    queryFn: async () => (await api.get<QuizListItem[]>('/admin/quizzes')).data,
  })

  const { data: subjects } = useQuery({
    queryKey: ['admin-subjects-list'],
    queryFn: async () => (await api.get<AdminSubject[]>('/admin/subjects')).data,
  })

  const { data: editingQuiz } = useQuery({
    queryKey: ['admin-quiz-full', selectedId],
    queryFn: async () => (await api.get<QuizFull>(`/admin/quizzes/${selectedId}/full`)).data,
    enabled: typeof selectedId === 'string' && selectedId !== 'new',
  })

  function resetForm() {
    setSubjectId('')
    setTitle('')
    setTimeLimitMinutes('')
    setIsPremium(false)
    setQuestions([blankQuestion()])
    setFormError(null)
  }

  useEffect(() => {
    if (selectedId === 'new') {
      resetForm()
    } else if (editingQuiz) {
      setSubjectId(editingQuiz.subjectId)
      setTitle(editingQuiz.title)
      setTimeLimitMinutes(editingQuiz.timeLimitMinutes?.toString() ?? '')
      setIsPremium(editingQuiz.isPremium)
      setQuestions(
        editingQuiz.questions.map((q) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          explanation: q.explanation ?? '',
          marks: q.marks,
          options: q.options.map((o) => ({ optionText: o.optionText, isCorrect: o.isCorrect })),
        }))
      )
      setFormError(null)
    }
  }, [selectedId, editingQuiz])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { subjectId, title, timeLimitMinutes: timeLimitMinutes || null, isPremium, questions }
      if (selectedId === 'new') {
        return (await api.post('/admin/quizzes', payload)).data
      }
      return (await api.put(`/admin/quizzes/${selectedId}`, payload)).data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-quizzes'] })
      setSelectedId(data.id)
      setFormError(null)
    },
    onError: (err) => setFormError(getErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/quizzes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quizzes'] })
      setSelectedId(null)
    },
  })

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function updateQuestionType(index: number, type: QuestionType) {
    updateQuestion(index, { questionType: type, options: blankOptionsFor(type) })
  }

  function updateOption(qIndex: number, oIndex: number, patch: Partial<OptionDraft>) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? { ...o, ...patch } : o)) } : q
      )
    )
  }

  function setCorrectOption(qIndex: number, oIndex: number) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex ? { ...q, options: q.options.map((o, j) => ({ ...o, isCorrect: j === oIndex })) } : q
      )
    )
  }

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-slate-900">Quiz Builder</h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin only. Create and edit quizzes — including the "why" explanation shown after each question.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <button
            onClick={() => setSelectedId('new')}
            className="w-full border-b border-slate-200 px-4 py-3 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            + New quiz
          </button>
          <div className="max-h-[560px] overflow-y-auto">
            {quizzes?.map((q) => (
              <button
                key={q.id}
                onClick={() => setSelectedId(q.id)}
                className={`flex w-full flex-col items-start px-4 py-2 text-left text-sm hover:bg-indigo-50 ${
                  selectedId === q.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                }`}
              >
                <span>{q.title}</span>
                <span className="text-xs text-slate-400">
                  {q.curriculum} · {q.subject}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {selectedId === null && <p className="text-sm text-slate-500">Select a quiz to edit, or create a new one.</p>}

          {selectedId !== null && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
              className="space-y-5"
            >
              <div className="grid grid-cols-2 gap-3">
                <select
                  required
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-1"
                >
                  <option value="">Select subject...</option>
                  {subjects?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.curriculum.name} · {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  placeholder="Time limit (min)"
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  placeholder="Quiz title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
                  Premium quiz
                </label>
              </div>

              <div className="space-y-4">
                {questions.map((q, qIndex) => (
                  <div key={qIndex} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Question {qIndex + 1}
                      </span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qIndex))}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <textarea
                      required
                      placeholder="Question text"
                      value={q.questionText}
                      onChange={(e) => updateQuestion(qIndex, { questionText: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      rows={2}
                    />

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={q.questionType}
                        onChange={(e) => updateQuestionType(qIndex, e.target.value as QuestionType)}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        <option value="multiple_choice">Multiple choice</option>
                        <option value="short_answer">Short answer</option>
                        <option value="true_false">True / False</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={q.marks}
                        onChange={(e) => updateQuestion(qIndex, { marks: Number(e.target.value) || 1 })}
                        placeholder="Marks"
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </div>

                    <div className="mt-3 space-y-2">
                      {q.questionType === 'short_answer' ? (
                        <input
                          required
                          type="text"
                          placeholder="Accepted answer"
                          value={q.options[0]?.optionText ?? ''}
                          onChange={(e) => updateOption(qIndex, 0, { optionText: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      ) : (
                        q.options.map((o, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${qIndex}`}
                              checked={o.isCorrect}
                              onChange={() => setCorrectOption(qIndex, oIndex)}
                            />
                            <input
                              required
                              type="text"
                              disabled={q.questionType === 'true_false'}
                              placeholder={`Option ${oIndex + 1}`}
                              value={o.optionText}
                              onChange={(e) => updateOption(qIndex, oIndex, { optionText: e.target.value })}
                              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-50"
                            />
                            {q.questionType === 'multiple_choice' && q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuestion(qIndex, { options: q.options.filter((_, j) => j !== oIndex) })
                                }
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))
                      )}
                      {q.questionType === 'multiple_choice' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(qIndex, { options: [...q.options, { optionText: '', isCorrect: false }] })
                          }
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          + Add option
                        </button>
                      )}
                    </div>

                    <textarea
                      placeholder="Explanation shown after the student answers (optional)"
                      value={q.explanation}
                      onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })}
                      className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      rows={2}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}
                  className="rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
                >
                  + Add question
                </button>
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving...' : selectedId === 'new' ? 'Create quiz' : 'Save changes'}
                </button>
                {selectedId !== 'new' && (
                  <button
                    type="button"
                    onClick={() => selectedId && deleteMutation.mutate(selectedId)}
                    disabled={deleteMutation.isPending}
                    className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete quiz'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  )
}
