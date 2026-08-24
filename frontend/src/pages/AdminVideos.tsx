import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'

interface AdminVideo {
  id: string
  subjectId: string
  title: string
  url: string
  isPremium: boolean
  subject: string
  curriculum: string
}

interface AdminSubject {
  id: string
  name: string
  curriculum: { id: string; name: string }
}

function VideoForm({
  subjects,
  initial,
  onSubmit,
  pending,
  error,
  submitLabel,
  onCancel,
}: {
  subjects: AdminSubject[]
  initial?: { subjectId: string; title: string; url: string; isPremium: boolean }
  onSubmit: (data: { subjectId: string; title: string; url: string; isPremium: boolean }) => void
  pending: boolean
  error: string | null
  submitLabel: string
  onCancel?: () => void
}) {
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [isPremium, setIsPremium] = useState(initial?.isPremium ?? false)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ subjectId, title, url, isPremium })
      }}
      className="space-y-3 p-4"
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
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="field-input px-2 py-1.5"
      />
      <input
        required
        type="url"
        placeholder="YouTube or Vimeo link (e.g. https://www.youtube.com/watch?v=...)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="field-input px-2 py-1.5"
      />
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
        Premium
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending || !subjectId} className="btn-primary">
          {pending ? 'Saving...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export function AdminVideos() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: videos, isLoading } = useQuery({
    queryKey: ['admin-videos'],
    queryFn: async () => (await api.get<AdminVideo[]>('/admin/videos')).data,
  })

  const { data: subjects } = useQuery({
    queryKey: ['admin-subjects-list'],
    queryFn: async () => (await api.get<AdminSubject[]>('/admin/subjects')).data,
  })

  const createVideo = useMutation({
    mutationFn: async (data: { subjectId: string; title: string; url: string; isPremium: boolean }) =>
      (await api.post('/admin/videos', data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos'] }),
  })

  const updateVideo = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { subjectId: string; title: string; url: string; isPremium: boolean } }) =>
      (await api.put(`/admin/videos/${id}`, data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-videos'] })
      setEditingId(null)
    },
  })

  const deleteVideo = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/videos/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<AdminVideo[]>(['admin-videos'], (old) => old?.filter((v) => v.id !== id))
    },
  })

  return (
    <Layout>
      <h1 className="page-title">Video Lessons</h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin only. Paste an unlisted YouTube or Vimeo link — students see it embedded on the subject page.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Add a video</h2>
          {subjects && (
            <VideoForm
              subjects={subjects}
              onSubmit={(data) => createVideo.mutate(data)}
              pending={createVideo.isPending}
              error={createVideo.isError ? getErrorMessage(createVideo.error) : null}
              submitLabel="Add video"
            />
          )}
        </div>

        <div className="card">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">All videos</h2>
          {isLoading && <p className="p-4 text-sm text-slate-500">Loading...</p>}
          <div className="max-h-[560px] overflow-y-auto">
            {videos?.map((v) => (
              <div key={v.id} className="border-b border-slate-100 last:border-0">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{v.title}</span>
                      {v.isPremium && <span className="badge-amber">Premium</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {v.curriculum} · {v.subject}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditingId(editingId === v.id ? null : v.id)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${v.title}"?`)) deleteVideo.mutate(v.id)
                      }}
                      disabled={deleteVideo.isPending}
                      className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {editingId === v.id && subjects && (
                  <div className="border-t border-slate-100 bg-slate-50">
                    <VideoForm
                      subjects={subjects}
                      initial={{ subjectId: v.subjectId, title: v.title, url: v.url, isPremium: v.isPremium }}
                      onSubmit={(data) => updateVideo.mutate({ id: v.id, data })}
                      pending={updateVideo.isPending}
                      error={updateVideo.isError ? getErrorMessage(updateVideo.error) : null}
                      submitLabel="Save changes"
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                )}
              </div>
            ))}
            {videos && videos.length === 0 && <p className="p-4 text-sm text-slate-500">No video lessons yet.</p>}
          </div>
        </div>
      </div>
    </Layout>
  )
}
