import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Layout } from '../components/Layout'

interface Quiz {
  id: string
  title: string
  topic: string | null
  timeLimitMinutes: number | null
  totalMarks: number
  questionCount: number
  isPremium: boolean
  locked: boolean
}

interface SubjectData {
  id: string
  name: string
  category: string | null
  notes: string | null
  curriculum: { id: string; name: string }
}

interface PastPaper {
  id: string
  year: number
  season: string | null
  paperNumber: number
  variant: number
  title: string | null
  isPremium: boolean
  locked: boolean
  fileUrl: string | null
  hasMarkingScheme: boolean
  markingSchemeUrl: string | null
}

function QuizCard({ q, subjectId }: { q: Quiz; subjectId: string | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-slate-900">{q.title}</div>
        {q.isPremium && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Premium
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {q.questionCount} questions &middot; {q.totalMarks} marks
        {q.timeLimitMinutes ? ` · ${q.timeLimitMinutes} min` : ''}
      </div>
      {q.locked ? (
        <Link
          to="/upgrade"
          state={{ reason: `"${q.title}" is a Premium quiz. Upgrade to unlock it.` }}
          className="mt-3 block w-fit rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
        >
          🔒 Unlock with Premium
        </Link>
      ) : (
        <Link
          to={`/quizzes/${q.id}/take`}
          state={{ title: q.title, subjectId }}
          className="mt-3 block w-fit rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Start quiz
        </Link>
      )}
    </div>
  )
}

export function SubjectDetail() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const location = useLocation()
  const stateName = (location.state as { subjectName?: string } | null)?.subjectName
  const [showAnswers, setShowAnswers] = useState(false)
  const [viewer, setViewer] = useState<{ key: string; url: string; label: string } | null>(null)

  const { data: subject } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: async () => (await api.get<SubjectData>(`/subjects/${subjectId}`)).data,
    enabled: Boolean(subjectId),
  })

  const subjectName = subject?.name ?? stateName ?? 'Subject'

  const { data: quizzes, isLoading: quizzesLoading } = useQuery({
    queryKey: ['quizzes', subjectId],
    queryFn: async () => (await api.get<Quiz[]>(`/quizzes/${subjectId}`)).data,
    enabled: Boolean(subjectId),
  })

  const { data: papers, isLoading: papersLoading } = useQuery({
    queryKey: ['past-papers', subjectId],
    queryFn: async () => (await api.get<PastPaper[]>(`/past-papers/${subjectId}`)).data,
    enabled: Boolean(subjectId),
  })

  const topicGroups = new Map<string, Quiz[]>()
  for (const q of quizzes ?? []) {
    const key = q.topic ?? 'General'
    topicGroups.set(key, [...(topicGroups.get(key) ?? []), q])
  }

  function toggleViewer(key: string, url: string, label: string) {
    setViewer((v) => (v?.key === key ? null : { key, url, label }))
  }

  return (
    <Layout>
      <Link to="/" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{subjectName}</h1>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-medium text-slate-900">Study Notes</h2>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {subject?.notes ? (
            <p className="whitespace-pre-wrap text-sm text-slate-700">{subject.notes}</p>
          ) : (
            <p className="text-sm text-slate-400">No study notes for this subject yet.</p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-medium text-slate-900">Interactive Quizzes</h2>
        {quizzesLoading && <p className="text-sm text-slate-500">Loading quizzes...</p>}
        <div className="space-y-6">
          {Array.from(topicGroups.entries()).map(([topic, topicQuizzes]) => (
            <div key={topic}>
              {topicGroups.size > 1 && (
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {topic}
                </h3>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {topicQuizzes.map((q) => (
                  <QuizCard key={q.id} q={q} subjectId={subjectId} />
                ))}
              </div>
            </div>
          ))}
          {quizzes && quizzes.length === 0 && (
            <p className="text-sm text-slate-500">No quizzes available yet.</p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-900">Past Papers</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>{showAnswers ? 'Show Marking Scheme' : 'Hide Marking Scheme (Exam Mode)'}</span>
            <button
              role="switch"
              aria-checked={showAnswers}
              onClick={() => setShowAnswers((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition ${
                showAnswers ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                  showAnswers ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </label>
        </div>
        {papersLoading && <p className="text-sm text-slate-500">Loading past papers...</p>}
        <div className="space-y-3">
          {papers?.map((p) => {
            const label = p.title ?? `${p.year} Paper ${p.paperNumber}`
            const examKey = `${p.id}:exam`
            const schemeKey = `${p.id}:scheme`
            return (
              <div key={p.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{label}</span>
                      {p.isPremium && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Premium
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.year} {p.season && `· ${p.season}`} &middot; Paper {p.paperNumber} Variant {p.variant}
                      {' · '}
                      {p.hasMarkingScheme ? 'Marking scheme available' : 'No marking scheme'}
                    </div>
                  </div>
                  {p.locked ? (
                    <Link
                      to="/upgrade"
                      state={{ reason: `"${label}" is a Premium past paper. Upgrade to unlock it.` }}
                      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
                    >
                      🔒 Unlock with Premium
                    </Link>
                  ) : showAnswers ? (
                    p.hasMarkingScheme ? (
                      <button
                        onClick={() => toggleViewer(schemeKey, p.markingSchemeUrl!, `${label} — Marking scheme`)}
                        className="rounded-md border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        {viewer?.key === schemeKey ? 'Hide' : 'View'} marking scheme
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Not available</span>
                    )
                  ) : (
                    <button
                      onClick={() => toggleViewer(examKey, p.fileUrl!, `${label} — Exam paper`)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {viewer?.key === examKey ? 'Hide' : 'View'} exam paper
                    </button>
                  )}
                </div>
                {(viewer?.key === examKey || viewer?.key === schemeKey) && (
                  <div className="border-t border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{viewer.label}</span>
                      <a
                        href={viewer.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Open in new tab
                      </a>
                    </div>
                    <iframe
                      src={viewer.url}
                      title={viewer.label}
                      className="h-[600px] w-full rounded-md border border-slate-200"
                    />
                  </div>
                )}
              </div>
            )
          })}
          {papers && papers.length === 0 && (
            <p className="text-sm text-slate-500">No past papers available yet.</p>
          )}
        </div>
      </section>
    </Layout>
  )
}
