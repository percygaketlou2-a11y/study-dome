import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { useAuthStore } from '../store/authStore'

interface Curriculum {
  id: string
  name: string
  description: string | null
}

export function Onboarding() {
  const navigate = useNavigate()
  const updateUser = useAuthStore((s) => s.updateUser)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: curricula, isLoading } = useQuery({
    queryKey: ['curricula'],
    queryFn: async () => (await api.get<Curriculum[]>('/curricula')).data,
  })

  async function handleContinue() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await api.patch('/user/curriculum', { curriculumId: selected })
      updateUser({ selectedCurriculumId: selected })
      navigate('/')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Choose your curriculum</h1>
        <p className="mb-6 text-sm text-slate-500">
          We'll tailor your subjects, quizzes and past papers to this curriculum.
        </p>

        {isLoading && <p className="text-sm text-slate-500">Loading curricula...</p>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {curricula?.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`rounded-lg border p-4 text-left transition ${
                selected === c.id
                  ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600'
                  : 'border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="font-medium text-slate-900">{c.name}</div>
              {c.description && <div className="mt-1 text-xs text-slate-500">{c.description}</div>}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={!selected || saving}
          className="mt-6 w-full rounded-md bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
