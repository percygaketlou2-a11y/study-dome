import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'

interface AdminTutorial {
  id: string
  subjectId: string
  title: string
  isPremium: boolean
  subject: string
  curriculum: string
  stepCount: number
}

interface TutorialStep {
  id: string
  order: number
  text: string
  imageUrl: string | null
}

interface TutorialDetail {
  id: string
  subjectId: string
  title: string
  isPremium: boolean
  steps: TutorialStep[]
}

interface AdminSubject {
  id: string
  name: string
  curriculum: { id: string; name: string }
}

function NewTutorialForm({ subjects }: { subjects: AdminSubject[] }) {
  const queryClient = useQueryClient()
  const [subjectId, setSubjectId] = useState('')
  const [title, setTitle] = useState('')
  const [isPremium, setIsPremium] = useState(false)

  const createMutation = useMutation({
    mutationFn: async () => (await api.post('/admin/tutorials', { subjectId, title, isPremium })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tutorials'] })
      setTitle('')
      setIsPremium(false)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createMutation.mutate()
      }}
      className="space-y-3 border-b border-slate-100 p-4"
    >
      <select required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="field-input px-2 py-1.5">
        <option value="">Select subject...</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.curriculum.name} · {s.name}
          </option>
        ))}
      </select>
      <input
        required
        type="text"
        placeholder="Tutorial title (e.g. Solving simultaneous equations)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="field-input px-2 py-1.5"
      />
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
        Premium
      </label>
      {createMutation.isError && <p className="text-xs text-red-600">{getErrorMessage(createMutation.error)}</p>}
      <button type="submit" disabled={createMutation.isPending || !subjectId} className="btn-primary w-full">
        {createMutation.isPending ? 'Creating...' : 'Create tutorial'}
      </button>
    </form>
  )
}

function AddStepForm({ tutorialId }: { tutorialId: string }) {
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [order, setOrder] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [formKey, setFormKey] = useState(0)

  const addStep = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append('text', text)
      formData.append('order', order || '0')
      if (image) formData.append('image', image)
      return (await api.post(`/admin/tutorials/${tutorialId}/steps`, formData)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tutorial-detail', tutorialId] })
      queryClient.invalidateQueries({ queryKey: ['admin-tutorials'] })
      setText('')
      setOrder('')
      setImage(null)
      setFormKey((k) => k + 1)
    },
  })

  return (
    <form
      key={formKey}
      onSubmit={(e) => {
        e.preventDefault()
        addStep.mutate()
      }}
      className="space-y-2 border-b border-slate-100 p-4"
    >
      <div className="grid grid-cols-4 gap-2">
        <textarea
          required
          placeholder="Step text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="field-input col-span-3 px-2 py-1.5"
        />
        <input
          type="number"
          placeholder="Order"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          className="field-input px-2 py-1.5"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Image (optional)</label>
        <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="w-full text-xs" />
      </div>
      {addStep.isError && <p className="text-xs text-red-600">{getErrorMessage(addStep.error)}</p>}
      <button type="submit" disabled={addStep.isPending} className="btn-primary">
        {addStep.isPending ? 'Adding...' : 'Add step'}
      </button>
    </form>
  )
}

function StepRow({ step, tutorialId }: { step: TutorialStep; tutorialId: string }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(step.text)
  const [order, setOrder] = useState(String(step.order))
  const [image, setImage] = useState<File | null>(null)

  const updateStep = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append('text', text)
      formData.append('order', order)
      if (image) formData.append('image', image)
      return (await api.put(`/admin/tutorial-steps/${step.id}`, formData)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tutorial-detail', tutorialId] })
      setEditing(false)
    },
  })

  const deleteStep = useMutation({
    mutationFn: async () => api.delete(`/admin/tutorial-steps/${step.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tutorial-detail', tutorialId] })
      queryClient.invalidateQueries({ queryKey: ['admin-tutorials'] })
    },
  })

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          updateStep.mutate()
        }}
        className="space-y-2 border-b border-slate-100 bg-slate-50 p-3"
      >
        <div className="grid grid-cols-4 gap-2">
          <textarea
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="field-input col-span-3 px-2 py-1.5"
          />
          <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className="field-input px-2 py-1.5" />
        </div>
        <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="w-full text-xs" />
        {updateStep.isError && <p className="text-xs text-red-600">{getErrorMessage(updateStep.error)}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={updateStep.isPending} className="btn-primary">
            {updateStep.isPending ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-3 last:border-0">
      <div className="flex gap-3">
        {step.imageUrl && (
          <img src={step.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover" />
        )}
        <div>
          <div className="text-xs font-medium text-slate-400">Step {step.order}</div>
          <div className="text-sm text-slate-800">{step.text}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button onClick={() => setEditing(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
          Edit
        </button>
        <button
          onClick={() => deleteStep.mutate()}
          disabled={deleteStep.isPending}
          className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

export function AdminTutorials() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: tutorials, isLoading } = useQuery({
    queryKey: ['admin-tutorials'],
    queryFn: async () => (await api.get<AdminTutorial[]>('/admin/tutorials')).data,
  })

  const { data: subjects } = useQuery({
    queryKey: ['admin-subjects-list'],
    queryFn: async () => (await api.get<AdminSubject[]>('/admin/subjects')).data,
  })

  const { data: detail } = useQuery({
    queryKey: ['admin-tutorial-detail', selectedId],
    queryFn: async () => (await api.get<TutorialDetail>(`/admin/tutorials/${selectedId}`)).data,
    enabled: Boolean(selectedId),
  })

  const deleteTutorial = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/tutorials/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<AdminTutorial[]>(['admin-tutorials'], (old) => old?.filter((t) => t.id !== id))
      if (selectedId === id) setSelectedId(null)
    },
  })

  const togglePremium = useMutation({
    mutationFn: async (t: AdminTutorial) =>
      (await api.put(`/admin/tutorials/${t.id}`, { subjectId: t.subjectId, title: t.title, isPremium: !t.isPremium })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tutorials'] })
      queryClient.invalidateQueries({ queryKey: ['admin-tutorial-detail', selectedId] })
    },
  })

  return (
    <Layout>
      <h1 className="page-title">Tutorials</h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin only. Build a step-by-step walkthrough per subject — each step can carry text and an optional image.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Tutorials</h2>
          {subjects && <NewTutorialForm subjects={subjects} />}
          {isLoading && <p className="p-4 text-sm text-slate-500">Loading...</p>}
          <div className="max-h-[420px] overflow-y-auto">
            {tutorials?.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between px-4 py-3 text-sm hover:bg-indigo-50 ${
                  selectedId === t.id ? 'bg-indigo-50' : ''
                }`}
              >
                <button onClick={() => setSelectedId(t.id)} className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{t.title}</span>
                    {t.isPremium && <span className="badge-amber">Premium</span>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t.curriculum} · {t.subject} · {t.stepCount} step{t.stepCount === 1 ? '' : 's'}
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${t.title}" and all its steps?`)) deleteTutorial.mutate(t.id)
                  }}
                  className="btn-danger-text shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
            {tutorials && tutorials.length === 0 && <p className="p-4 text-sm text-slate-500">No tutorials yet.</p>}
          </div>
        </div>

        <div className="card">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            Steps {detail ? `— ${detail.title}` : ''}
          </h2>
          {!selectedId && <p className="p-4 text-sm text-slate-500">Select a tutorial on the left.</p>}
          {detail && (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
                <span>{detail.isPremium ? 'Premium tutorial' : 'Free tutorial'}</span>
                <button
                  onClick={() => togglePremium.mutate(tutorials!.find((t) => t.id === detail.id)!)}
                  disabled={togglePremium.isPending}
                  className="font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                  Toggle premium
                </button>
              </div>
              <AddStepForm tutorialId={detail.id} />
              <div className="max-h-[420px] overflow-y-auto">
                {detail.steps.map((s) => (
                  <StepRow key={s.id} step={s} tutorialId={detail.id} />
                ))}
                {detail.steps.length === 0 && <p className="p-4 text-sm text-slate-500">No steps yet.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
