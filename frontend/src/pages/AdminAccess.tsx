import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'

interface AdminQuiz {
  id: string
  title: string
  isPremium: boolean
  subject: string
  curriculum: string
}

interface AdminPastPaper {
  id: string
  title: string
  year: number
  isPremium: boolean
  subject: string
  curriculum: string
}

interface AdminSubject {
  id: string
  name: string
  curriculum: { id: string; name: string }
}

function ToggleRow({
  label,
  sublabel,
  isPremium,
  onToggle,
  pending,
  onDelete,
  deletePending,
}: {
  label: string
  sublabel: string
  isPremium: boolean
  onToggle: () => void
  pending: boolean
  onDelete?: () => void
  deletePending?: boolean
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0">
      <div>
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{sublabel}</div>
      </div>
      <div className="flex items-center gap-3">
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={deletePending}
            className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {deletePending ? 'Removing...' : 'Remove'}
          </button>
        )}
        <button
          role="switch"
          aria-checked={isPremium}
          disabled={pending}
          onClick={onToggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
            isPremium ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              isPremium ? 'left-5' : 'left-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

function NewPastPaperForm({ subjects }: { subjects: AdminSubject[] }) {
  const queryClient = useQueryClient()
  const [subjectId, setSubjectId] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [season, setSeason] = useState('')
  const [paperNumber, setPaperNumber] = useState('1')
  const [variant, setVariant] = useState('1')
  const [title, setTitle] = useState('')
  const [isPremium, setIsPremium] = useState(false)
  const [examFile, setExamFile] = useState<File | null>(null)
  const [markingSchemeFile, setMarkingSchemeFile] = useState<File | null>(null)
  const [formKey, setFormKey] = useState(0)

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append('subjectId', subjectId)
      formData.append('year', year)
      formData.append('season', season)
      formData.append('paperNumber', paperNumber)
      formData.append('variant', variant)
      formData.append('title', title)
      formData.append('isPremium', String(isPremium))
      if (examFile) formData.append('examFile', examFile)
      if (markingSchemeFile) formData.append('markingSchemeFile', markingSchemeFile)
      return (await api.post('/admin/past-papers', formData)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-past-papers'] })
      setTitle('')
      setSeason('')
      setExamFile(null)
      setMarkingSchemeFile(null)
      setFormKey((k) => k + 1) // reset file inputs, which are uncontrolled
    },
  })

  return (
    <form
      key={formKey}
      onSubmit={(e) => {
        e.preventDefault()
        uploadMutation.mutate()
      }}
      className="space-y-3 border-b border-slate-200 p-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <select
          required
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Select subject...</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.curriculum.name} · {s.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          required
          placeholder="Year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="text"
          placeholder="Season (e.g. Oct/Nov)"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          required
          placeholder="Paper #"
          value={paperNumber}
          onChange={(e) => setPaperNumber(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          placeholder="Variant"
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Exam paper (PDF)</label>
        <input
          type="file"
          accept="application/pdf"
          required
          onChange={(e) => setExamFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Marking scheme (PDF, optional)</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setMarkingSchemeFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
        Premium
      </label>

      {uploadMutation.isError && (
        <p className="text-xs text-red-600">{getErrorMessage(uploadMutation.error)}</p>
      )}

      <button
        type="submit"
        disabled={uploadMutation.isPending || !subjectId}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {uploadMutation.isPending ? 'Uploading...' : 'Upload past paper'}
      </button>
    </form>
  )
}

export function AdminAccess() {
  const queryClient = useQueryClient()

  const { data: quizzes, isLoading: quizzesLoading } = useQuery({
    queryKey: ['admin-quizzes'],
    queryFn: async () => (await api.get<AdminQuiz[]>('/admin/quizzes')).data,
  })

  const { data: papers, isLoading: papersLoading } = useQuery({
    queryKey: ['admin-past-papers'],
    queryFn: async () => (await api.get<AdminPastPaper[]>('/admin/past-papers')).data,
  })

  const { data: subjects } = useQuery({
    queryKey: ['admin-subjects-list'],
    queryFn: async () => (await api.get<AdminSubject[]>('/admin/subjects')).data,
  })

  const toggleQuiz = useMutation({
    mutationFn: async ({ id, isPremium }: { id: string; isPremium: boolean }) =>
      (await api.patch(`/admin/quizzes/${id}/premium`, { isPremium })).data,
    onSuccess: (_data, { id, isPremium }) => {
      queryClient.setQueryData<AdminQuiz[]>(['admin-quizzes'], (old) =>
        old?.map((q) => (q.id === id ? { ...q, isPremium } : q))
      )
    },
  })

  const togglePaper = useMutation({
    mutationFn: async ({ id, isPremium }: { id: string; isPremium: boolean }) =>
      (await api.patch(`/admin/past-papers/${id}/premium`, { isPremium })).data,
    onSuccess: (_data, { id, isPremium }) => {
      queryClient.setQueryData<AdminPastPaper[]>(['admin-past-papers'], (old) =>
        old?.map((p) => (p.id === id ? { ...p, isPremium } : p))
      )
    },
  })

  const deletePaper = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/past-papers/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<AdminPastPaper[]>(['admin-past-papers'], (old) =>
        old?.filter((p) => p.id !== id)
      )
    },
  })

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-slate-900">Premium Access</h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin only. Upload past papers and toggle which quizzes and papers require Premium.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            Quizzes
          </h2>
          {quizzesLoading && <p className="p-4 text-sm text-slate-500">Loading...</p>}
          {quizzes?.map((q) => (
            <ToggleRow
              key={q.id}
              label={q.title}
              sublabel={`${q.curriculum} · ${q.subject}`}
              isPremium={q.isPremium}
              pending={toggleQuiz.isPending}
              onToggle={() => toggleQuiz.mutate({ id: q.id, isPremium: !q.isPremium })}
            />
          ))}
          {quizzes && quizzes.length === 0 && (
            <p className="p-4 text-sm text-slate-500">No quizzes yet.</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            Past Papers
          </h2>
          {subjects && <NewPastPaperForm subjects={subjects} />}
          <div className="max-h-[420px] overflow-y-auto">
            {papersLoading && <p className="p-4 text-sm text-slate-500">Loading...</p>}
            {papers?.map((p) => (
              <ToggleRow
                key={p.id}
                label={p.title}
                sublabel={`${p.curriculum} · ${p.subject}`}
                isPremium={p.isPremium}
                pending={togglePaper.isPending}
                onToggle={() => togglePaper.mutate({ id: p.id, isPremium: !p.isPremium })}
                onDelete={() => deletePaper.mutate(p.id)}
                deletePending={deletePaper.isPending}
              />
            ))}
            {papers && papers.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No past papers yet.</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
