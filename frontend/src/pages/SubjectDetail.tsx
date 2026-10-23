import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'
import { Markdown } from '../components/Markdown'

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

interface Video {
  id: string
  title: string
  isPremium: boolean
  locked: boolean
  embedUrl: string | null
}

interface TutorialStep {
  id: string
  order: number
  text: string
  imageUrl: string | null
  imageAlt: string | null
}

interface Tutorial {
  id: string
  title: string
  isPremium: boolean
  locked: boolean
  steps: TutorialStep[]
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

interface TopicNoteGroup {
  topic: { id: string; title: string; code: string | null }
  notes: { id: string; heading: string; bodyMarkdown: string }[]
}

interface StructuredQuestionData {
  id: string
  topic: string
  paperStyle: string | null
  totalMarks: number
  stem: string
  parts: { id: string; label: string | null; prompt: string; marks: number }[]
}

interface RevealedPart {
  id: string
  label: string | null
  marks: number
  answer: string
  markScheme: string
}

// Exam-style, multi-part question. Students answer every part first; only then
// is the mark scheme released so they can mark themselves honestly.
function StructuredQuestionCard({ q }: { q: StructuredQuestionData }) {
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<RevealedPart[] | null>(null)

  const reveal = useMutation({
    mutationFn: async () => (await api.post<{ parts: RevealedPart[] }>(`/structured/${q.id}/reveal`, { answers })).data,
    onSuccess: (data) => {
      setRevealed(data.parts)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const allAnswered = q.parts.every((p) => (answers[p.id] ?? '').trim().length > 0)
  const schemeFor = (partId: string) => revealed?.find((r) => r.id === partId)

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow">
          {q.topic}
          {q.paperStyle ? ` · ${q.paperStyle}` : ''}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{q.totalMarks} marks</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm font-medium text-slate-900">{q.stem}</p>

      <div className="mt-4 space-y-5">
        {q.parts.map((p) => {
          const scheme = schemeFor(p.id)
          return (
            <div key={p.id}>
              <label htmlFor={`part-${p.id}`} className="block text-sm text-slate-800">
                {p.label && <span className="font-semibold">({p.label}) </span>}
                {p.prompt}{' '}
                <span className="text-xs text-slate-500">
                  [{p.marks} {p.marks === 1 ? 'mark' : 'marks'}]
                </span>
              </label>
              <textarea
                id={`part-${p.id}`}
                rows={2}
                value={answers[p.id] ?? ''}
                disabled={Boolean(revealed)}
                onChange={(e) => setAnswers((a) => ({ ...a, [p.id]: e.target.value }))}
                className="field-input mt-2 disabled:bg-slate-50"
              />
              {scheme && (
                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Mark scheme</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">{scheme.markScheme}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {reveal.isError && <p className="mt-3 text-sm text-red-600">{getErrorMessage(reveal.error)}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {revealed ? (
          <>
            <p className="text-sm text-slate-600">Compare your answers with the mark scheme and give yourself marks for each part.</p>
            <button
              type="button"
              onClick={() => {
                setRevealed(null)
                setAnswers({})
              }}
              className="btn-secondary"
            >
              Try again
            </button>
          </>
        ) : (
          <button type="button" onClick={() => reveal.mutate()} disabled={!allAnswered || reveal.isPending} className="btn-primary">
            {reveal.isPending ? 'Checking...' : 'Show mark scheme'}
          </button>
        )}
        {!revealed && !allAnswered && <span className="text-xs text-slate-500">Answer every part to see the mark scheme.</span>}
      </div>
    </div>
  )
}

function QuizCard({ q, subjectId }: { q: Quiz; subjectId: string | undefined }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-slate-900">{q.title}</div>
        {q.isPremium && <span className="badge-amber shrink-0">Premium</span>}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {q.questionCount} questions &middot; {q.totalMarks} marks
        {q.timeLimitMinutes ? ` · ${q.timeLimitMinutes} min` : ''}
      </div>
      {q.locked ? (
        <Link
          to="/upgrade"
          state={{ reason: `"${q.title}" is a Premium quiz. Upgrade to unlock it.` }}
          className="mt-3 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
        >
          🔒 Unlock with Premium
        </Link>
      ) : (
        <Link to={`/quizzes/${q.id}/take`} state={{ title: q.title, subjectId }} className="btn-primary mt-3">
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

  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ['videos', subjectId],
    queryFn: async () => (await api.get<Video[]>(`/videos/${subjectId}`)).data,
    enabled: Boolean(subjectId),
  })

  const { data: tutorials, isLoading: tutorialsLoading } = useQuery({
    queryKey: ['tutorials', subjectId],
    queryFn: async () => (await api.get<Tutorial[]>(`/tutorials/${subjectId}`)).data,
    enabled: Boolean(subjectId),
  })

  const { data: topicNotes } = useQuery({
    queryKey: ['topic-notes', subjectId],
    queryFn: async () => (await api.get<TopicNoteGroup[]>(`/subjects/${subjectId}/topic-notes`)).data,
    enabled: Boolean(subjectId),
  })

  const { data: structuredQuestions } = useQuery({
    queryKey: ['structured', subjectId],
    queryFn: async () => (await api.get<StructuredQuestionData[]>(`/structured/${subjectId}`)).data,
    enabled: Boolean(subjectId),
  })

  const [openTutorialId, setOpenTutorialId] = useState<string | null>(null)

  // A dashboard "Past papers" shortcut links here with #past-papers — SPA
  // navigation doesn't auto-scroll to hashes the way a full page load does.
  useEffect(() => {
    if (!location.hash) return
    const el = document.querySelector(location.hash)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, papers])

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
      <Link to="/" className="text-sm font-medium text-indigo-600 hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="page-title mt-2">{subjectName}</h1>

      <section className="mt-6">
        <h2 className="section-title mb-3">Study Notes</h2>
        {(subject?.notes || (topicNotes && topicNotes.length === 0)) && (
          <div className="card p-4">
            {subject?.notes ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">{subject.notes}</p>
            ) : (
              <p className="text-sm text-slate-500">No study notes for this subject yet.</p>
            )}
          </div>
        )}
        {topicNotes && topicNotes.length > 0 && (
          <div className={`space-y-6 ${subject?.notes ? 'mt-6' : ''}`}>
            {topicNotes.map((group) => (
              <div key={group.topic.id}>
                <h3 className="eyebrow mb-2">
                  {group.topic.code ? `${group.topic.code} · ` : ''}
                  {group.topic.title}
                </h3>
                <div className="space-y-3">
                  {group.notes.map((n) => (
                    <article key={n.id} className="card p-4">
                      <h4 className="mb-2 font-semibold text-slate-900">{n.heading}</h4>
                      <Markdown source={n.bodyMarkdown} />
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="section-title mb-3">Interactive Quizzes</h2>
        {quizzesLoading && <p className="text-sm text-slate-500">Loading quizzes...</p>}
        <div className="space-y-6">
          {Array.from(topicGroups.entries()).map(([topic, topicQuizzes]) => (
            <div key={topic}>
              {topicGroups.size > 1 && <h3 className="eyebrow mb-2">{topic}</h3>}
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

      {structuredQuestions && structuredQuestions.length > 0 && (
        <section className="mt-10">
          <h2 className="section-title mb-3">Exam-style Questions</h2>
          <div className="space-y-4">
            {structuredQuestions.map((q) => (
              <StructuredQuestionCard key={q.id} q={q} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="section-title mb-3">Video Lessons</h2>
        {videosLoading && <p className="text-sm text-slate-500">Loading videos...</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {videos?.map((v) => (
            <div key={v.id} className="card overflow-hidden">
              {v.locked ? (
                <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-slate-50 p-4 text-center">
                  <Link
                    to="/upgrade"
                    state={{ reason: `"${v.title}" is a Premium video. Upgrade to unlock it.` }}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
                  >
                    🔒 Unlock with Premium
                  </Link>
                </div>
              ) : (
                v.embedUrl && (
                  <iframe
                    src={v.embedUrl}
                    title={v.title}
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )
              )}
              <div className="flex items-center justify-between p-3">
                <span className="text-sm font-medium text-slate-900">{v.title}</span>
                {v.isPremium && <span className="badge-amber shrink-0">Premium</span>}
              </div>
            </div>
          ))}
          {videos && videos.length === 0 && (
            <p className="text-sm text-slate-500">No video lessons available yet.</p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="section-title mb-3">Tutorials</h2>
        {tutorialsLoading && <p className="text-sm text-slate-500">Loading tutorials...</p>}
        <div className="space-y-3">
          {tutorials?.map((t) => {
            const open = openTutorialId === t.id
            return (
              <div key={t.id} className="card">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{t.title}</span>
                    {t.isPremium && <span className="badge-amber">Premium</span>}
                  </div>
                  {t.locked ? (
                    <Link
                      to="/upgrade"
                      state={{ reason: `"${t.title}" is a Premium tutorial. Upgrade to unlock it.` }}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
                    >
                      🔒 Unlock with Premium
                    </Link>
                  ) : (
                    <button
                      onClick={() => setOpenTutorialId(open ? null : t.id)}
                      className="btn-secondary"
                    >
                      {open ? 'Hide steps' : 'View steps'}
                    </button>
                  )}
                </div>
                {open && !t.locked && (
                  <div className="space-y-4 border-t border-slate-200 p-4">
                    {t.steps.map((s) => (
                      <div key={s.id} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                          {s.order}
                        </span>
                        <div className="space-y-2">
                          <p className="whitespace-pre-wrap text-sm text-slate-700">{s.text}</p>
                          {s.imageUrl && (
                            <img
                              src={s.imageUrl}
                              alt={s.imageAlt ?? `Step ${s.order} diagram`}
                              className="max-w-full rounded-lg border border-slate-200 sm:max-w-md"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {t.steps.length === 0 && <p className="text-sm text-slate-500">No steps yet.</p>}
                  </div>
                )}
              </div>
            )
          })}
          {tutorials && tutorials.length === 0 && (
            <p className="text-sm text-slate-500">No tutorials available yet.</p>
          )}
        </div>
      </section>

      <section id="past-papers" className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Past Papers</h2>
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
              <div key={p.id} className="card">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{label}</span>
                      {p.isPremium && <span className="badge-amber">Premium</span>}
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
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
                    >
                      🔒 Unlock with Premium
                    </Link>
                  ) : showAnswers ? (
                    p.hasMarkingScheme ? (
                      <button
                        onClick={() => toggleViewer(schemeKey, p.markingSchemeUrl!, `${label} — Marking scheme`)}
                        className="rounded-lg border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                      >
                        {viewer?.key === schemeKey ? 'Hide' : 'View'} marking scheme
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Not available</span>
                    )
                  ) : (
                    <button onClick={() => toggleViewer(examKey, p.fileUrl!, `${label} — Exam paper`)} className="btn-secondary">
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
                        className="text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Open in new tab
                      </a>
                    </div>
                    <iframe
                      src={viewer.url}
                      title={viewer.label}
                      className="h-[600px] w-full rounded-lg border border-slate-200"
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
