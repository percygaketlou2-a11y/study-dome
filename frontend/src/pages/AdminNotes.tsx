import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'

interface AdminSubject {
  id: string
  name: string
  category: string | null
  notes: string | null
  curriculum: { id: string; name: string }
}

export function AdminNotes() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['admin-subjects'],
    queryFn: async () => (await api.get<AdminSubject[]>('/admin/subjects')).data,
  })

  const selected = subjects?.find((s) => s.id === selectedId) ?? null

  useEffect(() => {
    setDraft(selected?.notes ?? '')
    setSavedAt(null)
  }, [selected?.id])

  const grouped = useMemo(() => {
    const filtered = (subjects ?? []).filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase())
    )
    const byCurriculum = new Map<string, AdminSubject[]>()
    for (const s of filtered) {
      const list = byCurriculum.get(s.curriculum.name) ?? []
      list.push(s)
      byCurriculum.set(s.curriculum.name, list)
    }
    return Array.from(byCurriculum.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [subjects, search])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) return
      return (await api.patch(`/admin/subjects/${selectedId}/notes`, { notes: draft })).data
    },
    onSuccess: () => {
      queryClient.setQueryData<AdminSubject[]>(['admin-subjects'], (old) =>
        old?.map((s) => (s.id === selectedId ? { ...s, notes: draft } : s))
      )
      setSavedAt(Date.now())
    },
  })

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-slate-900">Study Notes Editor</h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin only. Notes you save here appear read-only on each subject's page for every student.
      </p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading subjects...</p>}

      {subjects && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subjects..."
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {grouped.map(([curriculumName, list]) => (
                <div key={curriculumName}>
                  <div className="sticky top-0 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {curriculumName}
                  </div>
                  {list.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                        selectedId === s.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                      }`}
                    >
                      <span>{s.name}</span>
                      {s.notes && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Has notes" />}
                    </button>
                  ))}
                </div>
              ))}
              {grouped.length === 0 && (
                <p className="p-4 text-sm text-slate-500">No subjects match "{search}".</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            {selected ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-slate-900">{selected.name}</h2>
                    <p className="text-xs text-slate-500">{selected.curriculum.name}</p>
                  </div>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={16}
                  placeholder="Write study notes for this subject..."
                  className="mt-4 w-full rounded-md border border-slate-300 p-3 font-mono text-sm focus:border-indigo-500 focus:outline-none"
                />
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save notes'}
                  </button>
                  {savedAt && !saveMutation.isPending && (
                    <span className="text-sm text-emerald-600">Saved</span>
                  )}
                  {saveMutation.isError && (
                    <span className="text-sm text-red-600">{getErrorMessage(saveMutation.error)}</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Select a subject on the left to write its notes.</p>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
