import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { useAuthStore } from '../store/authStore'

interface Subject {
  id: string
  name: string
  category: string | null
}

interface RecentQuiz {
  id: string
  quizId: string
  quizTitle: string
  subject: string
  level: string
  score: number
  completedAt: string
}

interface DashboardData {
  user: { id: string; name: string; emailVerified: boolean }
  curriculum: { id: string; name: string } | null
  subjects: Subject[]
  recentQuizzes: RecentQuiz[]
  currentStreak: number
  totalActiveDays: number
}

export function Dashboard() {
  const authUser = useAuthStore((s) => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/user/dashboard')).data,
  })

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome back, {data?.user.name ?? authUser?.name}!
          </h1>
          {data?.curriculum && (
            <p className="mt-1 text-sm text-slate-500">Curriculum: {data.curriculum.name}</p>
          )}
        </div>
        {data && (
          <Link
            to="/leaderboard"
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm hover:border-indigo-300"
          >
            <span className="text-sm text-slate-600">
              {data.currentStreak > 0 ? (
                <>
                  🔥 <span className="font-semibold text-slate-900">{data.currentStreak}</span>-day streak
                </>
              ) : (
                'Start a streak today'
              )}
            </span>
            <span className="text-xs text-slate-400">&middot;</span>
            <span className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{data.totalActiveDays}</span> active days
            </span>
          </Link>
        )}
      </div>

      {data && !data.user.emailVerified && (
        <Link
          to="/account"
          className="mt-4 block rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100"
        >
          Your email isn't verified yet — visit Account settings to get a verification link.
        </Link>
      )}

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading dashboard...</p>}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-medium text-slate-900">Your Subjects</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data?.subjects.map((s) => (
              <Link
                key={s.id}
                to={`/subjects/${s.id}`}
                state={{ subjectName: s.name }}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow"
              >
                <div className="font-medium text-slate-900">{s.name}</div>
                <div className="mt-1 text-xs text-slate-500">{s.category ?? 'Quizzes & past papers'}</div>
              </Link>
            ))}
            {data && data.subjects.length === 0 && (
              <p className="text-sm text-slate-500">No subjects found for your curriculum yet.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-medium text-slate-900">Recent Quizzes</h2>
          <div className="space-y-3">
            {data?.recentQuizzes.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">
                    {r.subject} {r.level}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      r.score >= 50 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {r.score}%
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{r.quizTitle}</div>
              </div>
            ))}
            {data && data.recentQuizzes.length === 0 && (
              <p className="text-sm text-slate-500">No quizzes taken yet. Pick a subject to get started!</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
