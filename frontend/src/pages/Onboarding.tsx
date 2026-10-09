import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { AuthLayout } from '../components/AuthLayout'

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

  const { data: curricula, isLoading } = useQuery({
    queryKey: ['curricula'],
    queryFn: async () => (await api.get<Curriculum[]>('/curricula')).data,
  })

  // One tap picks and commits — no separate "Continue" step. Each card shows
  // its own saving state so the tap feels instant even while the request is in flight.
  async function handleSelect(curriculumId: string) {
    if (selected) return
    setSelected(curriculumId)
    setError(null)
    try {
      await api.patch('/user/curriculum', { curriculumId })
      updateUser({ selectedCurriculumId: curriculumId })
      navigate('/')
    } catch (err) {
      setError(getErrorMessage(err))
      setSelected(null)
    }
  }

  return (
    <AuthLayout wide>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Choose your curriculum</h1>
      <p className="mb-6 text-sm text-slate-500">
        Tap one to go straight to your dashboard — we'll tailor your subjects, quizzes and past papers to it.
      </p>

      {isLoading && <p className="text-sm text-slate-500">Loading curricula...</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {curricula?.map((c) => {
          const isSelected = selected === c.id
          return (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              disabled={Boolean(selected)}
              className={`rounded-lg border p-4 text-left transition disabled:cursor-not-allowed ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600'
                  : selected
                    ? 'border-slate-200 opacity-50'
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-slate-900">{c.name}</div>
                {isSelected && (
                  <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                )}
              </div>
              {c.description && <div className="mt-1 text-xs text-slate-500">{c.description}</div>}
            </button>
          )
        })}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </AuthLayout>
  )
}
