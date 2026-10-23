import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'
import { Markdown } from '../components/Markdown'
import { useAuthStore } from '../store/authStore'

type ReviewStatus = 'not_reviewed' | 'approved' | 'approve_with_edits' | 'rejected'

const STATUS_LABEL: Record<ReviewStatus, string> = {
  not_reviewed: 'Not reviewed',
  approved: 'Approved',
  approve_with_edits: 'Approve with edits',
  rejected: 'Rejected',
}

const STATUS_STYLE: Record<ReviewStatus, string> = {
  not_reviewed: 'bg-slate-100 text-slate-700',
  approved: 'bg-emerald-100 text-emerald-800',
  approve_with_edits: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800',
}

interface Tally {
  total: number
  approved: number
  approve_with_edits: number
  rejected: number
  not_reviewed: number
}

interface OverviewRow {
  id: string
  name: string
  subjectCode: string | null
  curriculum: string
  syllabusYear: number | null
  assessment: string | null
  topics: number
  objectives: number
  notes: Tally
  mcqs: Tally
  structuredParts: Tally
}

interface ReviewFields {
  reviewStatus: ReviewStatus
  corrections: string | null
  reviewerName: string | null
  reviewedAt: string | null
}

interface NoteItem extends ReviewFields {
  id: string
  key: string
  heading: string
  bodyMarkdown: string
  topic: { id: string; title: string; code: string | null }
  objectiveCodes: string[]
}

interface McqOption {
  id: string
  letter: string
  optionText: string
  isCorrect: boolean
}

interface McqItem extends ReviewFields {
  id: string
  key: string
  topic: string | null
  questionText: string
  difficulty: number | null
  assessmentObjective: string | null
  explanation: string | null
  marks: number
  options: McqOption[]
  objectiveCodes: string[]
  suggestedCorrectOption: string | null
}

interface PartItem extends ReviewFields {
  id: string
  label: string | null
  prompt: string
  marks: number
  markScheme: string
}

interface StructuredItem {
  id: string
  key: string
  topic: string
  paperStyle: string | null
  assessmentObjective: string | null
  totalMarks: number
  stem: string
  objectiveCodes: string[]
  parts: PartItem[]
}

interface TopicMapTopic {
  id: string
  code: string | null
  title: string
  unitCode: string | null
  unitName: string | null
  noteCount: number
  mcqCount: number
  structuredCount: number
  objectives: { id: string; syllabusCode: string | null; text: string; covered: boolean }[]
}

type Tab = 'notes' | 'mcqs' | 'structured' | 'map'
type StatusFilter = 'all' | ReviewStatus

function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
}

// PATCHes one item and refreshes every Content Review list and the progress table.
function useItemPatch(path: string, onDone?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.patch(path, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] })
      onDone?.()
    },
  })
}

// The "yellow columns" of the review workbook: status, reviewer, corrections
// (and, for MCQs, the answer the reviewer thinks is correct if different).
function ReviewForm({
  id,
  item,
  saving,
  error,
  onSave,
  optionLetters,
  suggestedCorrectOption,
}: {
  id: string
  item: ReviewFields
  saving: boolean
  error: string | null
  onSave: (payload: Record<string, unknown>) => void
  optionLetters?: string[]
  suggestedCorrectOption?: string | null
}) {
  const adminName = useAuthStore((s) => s.user?.name) ?? ''
  const [status, setStatus] = useState<ReviewStatus>(item.reviewStatus)
  const [reviewer, setReviewer] = useState(item.reviewerName ?? adminName)
  const [corrections, setCorrections] = useState(item.corrections ?? '')
  const [suggested, setSuggested] = useState(suggestedCorrectOption ?? '')

  function buildPayload(nextStatus: ReviewStatus) {
    const payload: Record<string, unknown> = { reviewStatus: nextStatus, reviewerName: reviewer, corrections }
    if (optionLetters) payload.suggestedCorrectOption = suggested
    return payload
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(buildPayload(status))
      }}
      className="mt-4 grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:grid-cols-2"
    >
      <div>
        <label htmlFor={`${id}-status`} className="field-label">
          Status
        </label>
        <select id={`${id}-status`} value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus)} className="field-input">
          {(Object.keys(STATUS_LABEL) as ReviewStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-reviewer`} className="field-label">
          Reviewer name
        </label>
        <input id={`${id}-reviewer`} value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="field-input" />
      </div>
      {optionLetters && (
        <div>
          <label htmlFor={`${id}-suggested`} className="field-label">
            Correct answer if different
          </label>
          <select id={`${id}-suggested`} value={suggested} onChange={(e) => setSuggested(e.target.value)} className="field-input">
            <option value="">No change</option>
            {optionLetters.map((l) => (
              <option key={l} value={l}>
                Option {l}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-corrections`} className="field-label">
          Corrections / comments
        </label>
        <textarea
          id={`${id}-corrections`}
          rows={2}
          value={corrections}
          onChange={(e) => setCorrections(e.target.value)}
          className="field-input"
          placeholder='e.g. Option C: write 0.50 mol, not 0.5'
        />
      </div>
      {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save review'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setStatus('approved')
            onSave(buildPayload('approved'))
          }}
          className="btn-secondary"
        >
          Approve and publish
        </button>
        {item.reviewedAt && (
          <span className="text-xs text-slate-600">Last reviewed {new Date(item.reviewedAt).toLocaleString()}</span>
        )}
      </div>
    </form>
  )
}

function ObjectiveCodes({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null
  return <p className="mt-1 text-xs text-slate-600">Objectives: {codes.join(', ')}</p>
}

function NoteCard({ note }: { note: NoteItem }) {
  const [editing, setEditing] = useState(false)
  const [heading, setHeading] = useState(note.heading)
  const [body, setBody] = useState(note.bodyMarkdown)
  const reviewMutation = useItemPatch(`/admin/content/notes/${note.id}`)
  const editMutation = useItemPatch(`/admin/content/notes/${note.id}`, () => setEditing(false))

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow">
          {note.topic.code ? `${note.topic.code} · ` : ''}
          {note.topic.title}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">{note.key}</span>
          <StatusBadge status={note.reviewStatus} />
        </div>
      </div>

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            editMutation.mutate({ heading, bodyMarkdown: body })
          }}
          className="mt-3 space-y-3"
        >
          <div>
            <label htmlFor={`${note.id}-heading`} className="field-label">
              Heading
            </label>
            <input id={`${note.id}-heading`} value={heading} onChange={(e) => setHeading(e.target.value)} className="field-input" />
          </div>
          <div>
            <label htmlFor={`${note.id}-body`} className="field-label">
              Note text (use **bold**, *italic*, - bullets, 1. numbers, | tables |)
            </label>
            <textarea id={`${note.id}-body`} rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="field-input font-mono" />
          </div>
          {editMutation.isError && <p className="text-sm text-red-700">{getErrorMessage(editMutation.error)}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={editMutation.isPending} className="btn-primary">
              {editMutation.isPending ? 'Saving...' : 'Save text'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <h4 className="mt-2 font-semibold text-slate-900">{note.heading}</h4>
          <ObjectiveCodes codes={note.objectiveCodes} />
          <div className="mt-2">
            <Markdown source={note.bodyMarkdown} />
          </div>
          <button type="button" onClick={() => setEditing(true)} className="mt-2 text-sm font-medium text-indigo-700 hover:underline">
            Edit text
          </button>
        </>
      )}

      <ReviewForm
        id={note.id}
        item={note}
        saving={reviewMutation.isPending}
        error={reviewMutation.isError ? getErrorMessage(reviewMutation.error) : null}
        onSave={(payload) => reviewMutation.mutate(payload)}
      />
    </article>
  )
}

function McqCard({ q }: { q: McqItem }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(q.questionText)
  const [explanation, setExplanation] = useState(q.explanation ?? '')
  const [optionTexts, setOptionTexts] = useState<Record<string, string>>(
    Object.fromEntries(q.options.map((o) => [o.id, o.optionText]))
  )
  const [correctId, setCorrectId] = useState(q.options.find((o) => o.isCorrect)?.id ?? '')
  const reviewMutation = useItemPatch(`/admin/content/mcqs/${q.id}`)
  const editMutation = useItemPatch(`/admin/content/mcqs/${q.id}`, () => setEditing(false))

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow">
          {q.topic ?? 'Question'}
          {q.difficulty ? ` · Difficulty ${q.difficulty}/3` : ''}
          {q.assessmentObjective ? ` · ${q.assessmentObjective}` : ''}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">{q.key}</span>
          <StatusBadge status={q.reviewStatus} />
        </div>
      </div>

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            editMutation.mutate({
              questionText: text,
              explanation,
              correctOptionId: correctId,
              options: q.options.map((o) => ({ id: o.id, optionText: optionTexts[o.id] })),
            })
          }}
          className="mt-3 space-y-3"
        >
          <div>
            <label htmlFor={`${q.id}-stem`} className="field-label">
              Question
            </label>
            <textarea id={`${q.id}-stem`} rows={3} value={text} onChange={(e) => setText(e.target.value)} className="field-input" />
          </div>
          <fieldset>
            <legend className="field-label">Options (select the correct one)</legend>
            <div className="space-y-2">
              {q.options.map((o) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${q.id}-correct`}
                    checked={correctId === o.id}
                    onChange={() => setCorrectId(o.id)}
                    aria-label={`Option ${o.letter} is correct`}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span className="w-5 text-sm font-semibold text-slate-700">{o.letter}</span>
                  <input
                    value={optionTexts[o.id]}
                    onChange={(e) => setOptionTexts((t) => ({ ...t, [o.id]: e.target.value }))}
                    aria-label={`Option ${o.letter} text`}
                    className="field-input"
                  />
                </div>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor={`${q.id}-explanation`} className="field-label">
              Explanation shown to the student
            </label>
            <textarea id={`${q.id}-explanation`} rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} className="field-input" />
          </div>
          {editMutation.isError && <p className="text-sm text-red-700">{getErrorMessage(editMutation.error)}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={editMutation.isPending} className="btn-primary">
              {editMutation.isPending ? 'Saving...' : 'Save question'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-900">{q.questionText}</p>
          <ObjectiveCodes codes={q.objectiveCodes} />
          <ul className="mt-2 space-y-1">
            {q.options.map((o) => (
              <li
                key={o.id}
                className={`rounded-md px-3 py-1.5 text-sm ${o.isCorrect ? 'bg-emerald-50 font-medium text-emerald-900' : 'text-slate-700'}`}
              >
                <span className="mr-2 font-semibold">{o.letter}.</span>
                {o.optionText}
                {o.isCorrect && <span className="ml-2 text-xs font-semibold uppercase tracking-wide">Correct</span>}
              </li>
            ))}
          </ul>
          {q.explanation && (
            <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-medium">Explanation: </span>
              {q.explanation}
            </p>
          )}
          <button type="button" onClick={() => setEditing(true)} className="mt-2 text-sm font-medium text-indigo-700 hover:underline">
            Edit question
          </button>
        </>
      )}

      <ReviewForm
        id={q.id}
        item={q}
        optionLetters={q.options.map((o) => o.letter)}
        suggestedCorrectOption={q.suggestedCorrectOption}
        saving={reviewMutation.isPending}
        error={reviewMutation.isError ? getErrorMessage(reviewMutation.error) : null}
        onSave={(payload) => reviewMutation.mutate(payload)}
      />
    </article>
  )
}

function PartBlock({ part }: { part: PartItem }) {
  const [editing, setEditing] = useState(false)
  const [prompt, setPrompt] = useState(part.prompt)
  const [marks, setMarks] = useState(String(part.marks))
  const [scheme, setScheme] = useState(part.markScheme)
  const reviewMutation = useItemPatch(`/admin/content/structured-parts/${part.id}`)
  const editMutation = useItemPatch(`/admin/content/structured-parts/${part.id}`, () => setEditing(false))

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{part.label ? `Part (${part.label})` : 'Question'}</span>
        <StatusBadge status={part.reviewStatus} />
      </div>

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            editMutation.mutate({ prompt, marks: Number(marks), markScheme: scheme })
          }}
          className="mt-2 space-y-3"
        >
          <div>
            <label htmlFor={`${part.id}-prompt`} className="field-label">
              Question part
            </label>
            <textarea id={`${part.id}-prompt`} rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="field-input" />
          </div>
          <div>
            <label htmlFor={`${part.id}-marks`} className="field-label">
              Marks
            </label>
            <input id={`${part.id}-marks`} type="number" min={1} value={marks} onChange={(e) => setMarks(e.target.value)} className="field-input w-24" />
          </div>
          <div>
            <label htmlFor={`${part.id}-scheme`} className="field-label">
              Mark scheme
            </label>
            <textarea id={`${part.id}-scheme`} rows={3} value={scheme} onChange={(e) => setScheme(e.target.value)} className="field-input" />
          </div>
          {editMutation.isError && <p className="text-sm text-red-700">{getErrorMessage(editMutation.error)}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={editMutation.isPending} className="btn-primary">
              {editMutation.isPending ? 'Saving...' : 'Save part'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-800">
            {part.prompt} <span className="text-xs text-slate-600">[{part.marks} {part.marks === 1 ? 'mark' : 'marks'}]</span>
          </p>
          <p className="mt-2 whitespace-pre-wrap rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span className="font-semibold">Mark scheme: </span>
            {part.markScheme}
          </p>
          <button type="button" onClick={() => setEditing(true)} className="mt-2 text-sm font-medium text-indigo-700 hover:underline">
            Edit part
          </button>
        </>
      )}

      <ReviewForm
        id={part.id}
        item={part}
        saving={reviewMutation.isPending}
        error={reviewMutation.isError ? getErrorMessage(reviewMutation.error) : null}
        onSave={(payload) => reviewMutation.mutate(payload)}
      />
    </div>
  )
}

function StructuredCard({ q, filter }: { q: StructuredItem; filter: StatusFilter }) {
  const [editingStem, setEditingStem] = useState(false)
  const [stem, setStem] = useState(q.stem)
  const stemMutation = useItemPatch(`/admin/content/structured/${q.id}`, () => setEditingStem(false))
  const parts = filter === 'all' ? q.parts : q.parts.filter((p) => p.reviewStatus === filter)
  const fullyApproved = q.parts.every((p) => p.reviewStatus === 'approved')

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow">
          {q.topic}
          {q.paperStyle ? ` · ${q.paperStyle}` : ''} · {q.totalMarks} marks
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">{q.key}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${fullyApproved ? STATUS_STYLE.approved : STATUS_STYLE.not_reviewed}`}>
            {fullyApproved ? 'Live for students' : 'Hidden until every part is approved'}
          </span>
        </div>
      </div>

      {editingStem ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            stemMutation.mutate({ stem })
          }}
          className="mt-3 space-y-3"
        >
          <label htmlFor={`${q.id}-stem`} className="field-label">
            Question stem / data
          </label>
          <textarea id={`${q.id}-stem`} rows={4} value={stem} onChange={(e) => setStem(e.target.value)} className="field-input" />
          {stemMutation.isError && <p className="text-sm text-red-700">{getErrorMessage(stemMutation.error)}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={stemMutation.isPending} className="btn-primary">
              Save stem
            </button>
            <button type="button" onClick={() => setEditingStem(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-900">{q.stem}</p>
          <ObjectiveCodes codes={q.objectiveCodes} />
          <button type="button" onClick={() => setEditingStem(true)} className="mt-2 text-sm font-medium text-indigo-700 hover:underline">
            Edit stem
          </button>
        </>
      )}

      <div className="mt-3 space-y-3">
        {parts.map((p) => (
          <PartBlock key={p.id} part={p} />
        ))}
      </div>
    </article>
  )
}

function ProgressCell({ tally }: { tally: Tally }) {
  return (
    <span className={tally.total > 0 && tally.approved === tally.total ? 'font-semibold text-emerald-700' : 'text-slate-800'}>
      {tally.approved}/{tally.total}
    </span>
  )
}

function TopicMapView({ topics }: { topics: TopicMapTopic[] }) {
  const units = new Map<string, { name: string; topics: TopicMapTopic[] }>()
  for (const t of topics) {
    const key = t.unitCode ?? '—'
    if (!units.has(key)) units.set(key, { name: t.unitName ?? 'Syllabus', topics: [] })
    units.get(key)!.topics.push(t)
  }

  return (
    <div className="space-y-6">
      {[...units.entries()].map(([code, unit]) => (
        <section key={code}>
          <h3 className="eyebrow mb-2">
            Unit {code} · {unit.name}
          </h3>
          <div className="space-y-2">
            {unit.topics.map((t) => {
              const covered = t.objectives.filter((o) => o.covered).length
              return (
                <details key={t.id} className="card p-3">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-900">
                      {t.code} {t.title}
                    </span>
                    <span className="flex flex-wrap gap-2 text-xs text-slate-700">
                      <span>{t.noteCount} notes</span>
                      <span>{t.mcqCount} MCQs</span>
                      <span>{t.structuredCount} structured</span>
                      <span className={covered > 0 ? 'font-semibold text-emerald-700' : ''}>
                        {covered}/{t.objectives.length} objectives covered
                      </span>
                    </span>
                  </summary>
                  <ul className="mt-3 space-y-1 text-sm">
                    {t.objectives.map((o) => (
                      <li key={o.id} className="flex gap-2">
                        <span className={o.covered ? 'text-emerald-700' : 'text-slate-500'} aria-label={o.covered ? 'Has content' : 'No content yet'}>
                          {o.covered ? '✓' : '○'}
                        </span>
                        <span className="w-20 shrink-0 text-xs text-slate-600">{o.syllabusCode}</span>
                        <span className="text-slate-800">{o.text}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'notes', label: 'Notes' },
  { id: 'mcqs', label: 'Multiple choice' },
  { id: 'structured', label: 'Exam-style questions' },
  { id: 'map', label: 'Syllabus map' },
]

export function AdminContentReview() {
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('notes')
  const [filter, setFilter] = useState<StatusFilter>('all')

  const { data: overview, isLoading } = useQuery({
    queryKey: ['content', 'overview'],
    queryFn: async () => (await api.get<OverviewRow[]>('/admin/content/overview')).data,
  })

  const activeId = subjectId ?? overview?.[0]?.id ?? null
  const activeSubject = overview?.find((s) => s.id === activeId)

  const notes = useQuery({
    queryKey: ['content', 'notes', activeId],
    queryFn: async () => (await api.get<NoteItem[]>(`/admin/content/notes?subjectId=${activeId}`)).data,
    enabled: Boolean(activeId) && tab === 'notes',
  })
  const mcqs = useQuery({
    queryKey: ['content', 'mcqs', activeId],
    queryFn: async () => (await api.get<McqItem[]>(`/admin/content/mcqs?subjectId=${activeId}`)).data,
    enabled: Boolean(activeId) && tab === 'mcqs',
  })
  const structured = useQuery({
    queryKey: ['content', 'structured', activeId],
    queryFn: async () => (await api.get<StructuredItem[]>(`/admin/content/structured?subjectId=${activeId}`)).data,
    enabled: Boolean(activeId) && tab === 'structured',
  })
  const topicMap = useQuery({
    queryKey: ['content', 'map', activeId],
    queryFn: async () => (await api.get<TopicMapTopic[]>(`/admin/content/topic-map?subjectId=${activeId}`)).data,
    enabled: Boolean(activeId) && tab === 'map',
  })

  const matches = (status: ReviewStatus) => filter === 'all' || status === filter
  const visibleNotes = notes.data?.filter((n) => matches(n.reviewStatus))
  const visibleMcqs = mcqs.data?.filter((q) => matches(q.reviewStatus))
  const visibleStructured = structured.data?.filter((q) => q.parts.some((p) => matches(p.reviewStatus)))

  return (
    <Layout>
      <h1 className="page-title">Content Review</h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin only. Check each imported note and question for accuracy and syllabus level. Nothing reaches students
        until its status is <strong className="font-semibold text-slate-700">Approved</strong>.
      </p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {overview && overview.length === 0 && (
        <p className="card mt-6 p-4 text-sm text-slate-600">
          No content has been imported yet. Run <code className="rounded bg-slate-100 px-1">npm run import:content</code> in the backend folder.
        </p>
      )}

      {overview && overview.length > 0 && (
        <>
          <div className="card mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Review progress by subject. Select a subject to review it.</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3">Subject</th>
                  <th scope="col" className="px-4 py-3">Topics</th>
                  <th scope="col" className="px-4 py-3">Objectives</th>
                  <th scope="col" className="px-4 py-3">Notes approved</th>
                  <th scope="col" className="px-4 py-3">MCQs approved</th>
                  <th scope="col" className="px-4 py-3">Structured parts approved</th>
                </tr>
              </thead>
              <tbody>
                {overview.map((s) => (
                  <tr key={s.id} className={`border-b border-slate-100 last:border-0 ${s.id === activeId ? 'bg-indigo-50' : ''}`}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSubjectId(s.id)}
                        aria-pressed={s.id === activeId}
                        className="text-left font-medium text-indigo-700 hover:underline"
                      >
                        {s.name}
                      </button>
                      <div className="text-xs text-slate-600">
                        {s.curriculum}
                        {s.subjectCode ? ` · ${s.subjectCode}` : ''}
                        {s.syllabusYear ? ` · ${s.syllabusYear} syllabus` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">{s.topics}</td>
                    <td className="px-4 py-3">{s.objectives}</td>
                    <td className="px-4 py-3"><ProgressCell tally={s.notes} /></td>
                    <td className="px-4 py-3"><ProgressCell tally={s.mcqs} /></td>
                    <td className="px-4 py-3"><ProgressCell tally={s.structuredParts} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activeSubject?.assessment && (
            <p className="mt-3 text-xs text-slate-600">
              <span className="font-semibold">{activeSubject.name} assessment:</span> {activeSubject.assessment}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
            <div role="tablist" aria-label="Content type" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="review-panel"
                  onClick={() => setTab(t.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    tab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-700 hover:text-indigo-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab !== 'map' && (
              <div>
                <label htmlFor="status-filter" className="mr-2 text-sm text-slate-700">
                  Show
                </label>
                <select
                  id="status-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as StatusFilter)}
                  className="field-input inline-block w-auto"
                >
                  <option value="all">All statuses</option>
                  {(Object.keys(STATUS_LABEL) as ReviewStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div id="review-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-4 space-y-4">
            {tab === 'notes' && (
              <>
                {notes.isLoading && <p className="text-sm text-slate-500">Loading notes...</p>}
                {visibleNotes?.map((n) => <NoteCard key={n.id} note={n} />)}
                {visibleNotes && visibleNotes.length === 0 && <p className="text-sm text-slate-500">No notes match this filter.</p>}
              </>
            )}
            {tab === 'mcqs' && (
              <>
                {mcqs.isLoading && <p className="text-sm text-slate-500">Loading questions...</p>}
                {visibleMcqs?.map((q) => <McqCard key={q.id} q={q} />)}
                {visibleMcqs && visibleMcqs.length === 0 && <p className="text-sm text-slate-500">No questions match this filter.</p>}
              </>
            )}
            {tab === 'structured' && (
              <>
                {structured.isLoading && <p className="text-sm text-slate-500">Loading questions...</p>}
                {visibleStructured?.map((q) => <StructuredCard key={q.id} q={q} filter={filter} />)}
                {visibleStructured && visibleStructured.length === 0 && <p className="text-sm text-slate-500">No questions match this filter.</p>}
              </>
            )}
            {tab === 'map' && (
              <>
                {topicMap.isLoading && <p className="text-sm text-slate-500">Loading syllabus...</p>}
                {topicMap.data && <TopicMapView topics={topicMap.data} />}
              </>
            )}
          </div>
        </>
      )}
    </Layout>
  )
}
