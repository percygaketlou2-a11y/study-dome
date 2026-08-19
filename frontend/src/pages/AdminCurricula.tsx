import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'

interface Curriculum {
  id: string
  name: string
  description: string | null
  subjectCount: number
}

interface Subject {
  id: string
  name: string
  category: string | null
  subjectCode: string | null
}

export function AdminCurricula() {
  const queryClient = useQueryClient()
  const [selectedCurriculum, setSelectedCurriculum] = useState<string | null>(null)

  const [newCurriculumName, setNewCurriculumName] = useState('')
  const [newCurriculumDesc, setNewCurriculumDesc] = useState('')
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectCategory, setNewSubjectCategory] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: curricula } = useQuery({
    queryKey: ['admin-curricula'],
    queryFn: async () => (await api.get<Curriculum[]>('/admin/curricula')).data,
  })

  const { data: subjects } = useQuery({
    queryKey: ['admin-curriculum-subjects', selectedCurriculum],
    queryFn: async () => (await api.get<Subject[]>(`/admin/curricula/${selectedCurriculum}/subjects`)).data,
    enabled: Boolean(selectedCurriculum),
  })

  const createCurriculum = useMutation({
    mutationFn: async () =>
      (await api.post('/admin/curricula', { name: newCurriculumName, description: newCurriculumDesc })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-curricula'] })
      setNewCurriculumName('')
      setNewCurriculumDesc('')
      setError(null)
    },
    onError: (err) => setError(getErrorMessage(err)),
  })

  const deleteCurriculum = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/curricula/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-curricula'] })
      setSelectedCurriculum(null)
    },
  })

  const createSubject = useMutation({
    mutationFn: async () =>
      (
        await api.post('/admin/subjects', {
          curriculumId: selectedCurriculum,
          name: newSubjectName,
          category: newSubjectCategory,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-curriculum-subjects', selectedCurriculum] })
      queryClient.invalidateQueries({ queryKey: ['admin-curricula'] })
      setNewSubjectName('')
      setNewSubjectCategory('')
      setError(null)
    },
    onError: (err) => setError(getErrorMessage(err)),
  })

  const deleteSubject = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/subjects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-curriculum-subjects', selectedCurriculum] })
      queryClient.invalidateQueries({ queryKey: ['admin-curricula'] })
    },
  })

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-slate-900">Curricula & Subjects</h1>
      <p className="mt-1 text-sm text-slate-500">Admin only. Deleting a curriculum or subject removes everything under it — quizzes, notes and past papers included.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Curricula</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createCurriculum.mutate()
            }}
            className="flex gap-2 border-b border-slate-100 p-3"
          >
            <input
              required
              placeholder="Name (e.g. NSC)"
              value={newCurriculumName}
              onChange={(e) => setNewCurriculumName(e.target.value)}
              className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <input
              placeholder="Description"
              value={newCurriculumDesc}
              onChange={(e) => setNewCurriculumDesc(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={createCurriculum.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Add
            </button>
          </form>
          <div className="max-h-[480px] overflow-y-auto">
            {curricula?.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between px-4 py-2 text-sm hover:bg-indigo-50 ${
                  selectedCurriculum === c.id ? 'bg-indigo-50' : ''
                }`}
              >
                <button onClick={() => setSelectedCurriculum(c.id)} className="flex-1 text-left">
                  <span className="font-medium text-slate-900">{c.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{c.subjectCount} subjects</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${c.name}" and everything under it?`)) deleteCurriculum.mutate(c.id)
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            Subjects {selectedCurriculum && curricula ? `— ${curricula.find((c) => c.id === selectedCurriculum)?.name}` : ''}
          </h2>
          {!selectedCurriculum && <p className="p-4 text-sm text-slate-500">Select a curriculum on the left.</p>}
          {selectedCurriculum && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  createSubject.mutate()
                }}
                className="flex gap-2 border-b border-slate-100 p-3"
              >
                <input
                  required
                  placeholder="Subject name"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  placeholder="Category"
                  value={newSubjectCategory}
                  onChange={(e) => setNewSubjectCategory(e.target.value)}
                  className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={createSubject.isPending}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Add
                </button>
              </form>
              <div className="max-h-[420px] overflow-y-auto">
                {subjects?.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-50">
                    <div>
                      <span className="font-medium text-slate-900">{s.name}</span>
                      {s.category && <span className="ml-2 text-xs text-slate-400">{s.category}</span>}
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${s.name}" and everything under it?`)) deleteSubject.mutate(s.id)
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {subjects && subjects.length === 0 && (
                  <p className="p-4 text-sm text-slate-500">No subjects yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </Layout>
  )
}
