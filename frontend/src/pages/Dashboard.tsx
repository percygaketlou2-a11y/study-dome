import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Layout } from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import { AnimatedNumber } from '../components/AnimatedNumber'

interface Subject {
  id: string
  name: string
  category: string | null
  quizzesCompleted: number
  quizzesTotal: number
}

interface RecentQuiz {
  id: string
  quizId: string
  quizTitle: string
  subjectId: string
  subject: string
  level: string
  score: number
  completedAt: string
}

interface DashboardData {
  user: { id: string; name: string; emailVerified: boolean }
  curriculum: { id: string; name: string } | null
  subjects: Subject[]
  continueSubject: { id: string; name: string } | null
  recentQuizzes: RecentQuiz[]
  currentStreak: number
  totalActiveDays: number
  studiedToday: boolean
}

function StreakCard({ streak, activeDays, studiedToday }: { streak: number; activeDays: number; studiedToday: boolean }) {
  return (
    <Link to="/leaderboard" className="card-interactive flex items-center gap-4 px-4 py-3">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${
          streak > 0 ? 'bg-amber-50' : 'bg-slate-50'
        } ${studiedToday ? 'animate-pulse-ring' : ''}`}
      >
        🔥
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900">
          {streak > 0 ? (
            <>
              <AnimatedNumber value={streak} />-day streak
            </>
          ) : (
            'Start a streak today'
          )}
        </div>
        <div className="text-xs text-slate-500">
          {activeDays} active {activeDays === 1 ? 'day' : 'days'} ·{' '}
          {studiedToday ? (
            <span className="font-medium text-emerald-600">Today's goal done ✓</span>
          ) : (
            <span className="text-slate-400">Today's goal: study once</span>
          )}
        </div>
      </div>
    </Link>
  )
}

function SubjectCard({ s }: { s: Subject }) {
  const progress = s.quizzesTotal > 0 ? Math.round((s.quizzesCompleted / s.quizzesTotal) * 100) : 0
  return (
    <Link to={`/subjects/${s.id}`} state={{ subjectName: s.name }} className="card-interactive p-4">
      <div className="font-semibold text-slate-900">{s.name}</div>
      <div className="mt-1 text-xs text-slate-500">{s.category ?? 'Quizzes & past papers'}</div>
      {s.quizzesTotal > 0 && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {s.quizzesCompleted}/{s.quizzesTotal} quizzes done
          </div>
        </div>
      )}
    </Link>
  )
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
          <h1 className="page-title">Welcome back, {data?.user.name ?? authUser?.name}!</h1>
          {data?.curriculum && (
            <p className="mt-1 text-sm text-slate-500">
              Curriculum: <span className="font-medium text-slate-700">{data.curriculum.name}</span>
            </p>
          )}
        </div>
        {data && <StreakCard streak={data.currentStreak} activeDays={data.totalActiveDays} studiedToday={data.studiedToday} />}
      </div>

      {data && !data.user.emailVerified && (
        <Link
          to="/account"
          className="mt-4 block rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 transition hover:bg-amber-100"
        >
          Your email isn't verified yet — visit Account settings to get a verification link.
        </Link>
      )}

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading dashboard...</p>}

      {data?.continueSubject && (
        <div className="animate-fade-up mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-indigo-600 px-6 py-5 text-white shadow-sm">
          <div>
            <div className="eyebrow text-indigo-200">Continue learning</div>
            <div className="mt-0.5 text-lg font-semibold">{data.continueSubject.name}</div>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/subjects/${data.continueSubject.id}`}
              state={{ subjectName: data.continueSubject.name }}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-50"
            >
              Continue subject
            </Link>
            <Link
              to={`/subjects/${data.continueSubject.id}#past-papers`}
              state={{ subjectName: data.continueSubject.name }}
              className="rounded-lg border border-white/40 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Past papers
            </Link>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="section-title mb-3">Your Subjects</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data?.subjects.map((s) => <SubjectCard key={s.id} s={s} />)}
            {data && data.subjects.length === 0 && (
              <p className="text-sm text-slate-500">No subjects found for your curriculum yet.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="section-title mb-3">Recent Quizzes</h2>
          <div className="space-y-3">
            {data?.recentQuizzes.map((r) => (
              <Link
                key={r.id}
                to={`/quizzes/${r.quizId}/take`}
                state={{ title: r.quizTitle, subjectId: r.subjectId }}
                className="card-interactive block p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">
                    {r.subject} {r.level}
                  </span>
                  <span className={`text-sm font-semibold ${r.score >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {r.score}%
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{r.quizTitle}</div>
                <div className="mt-1 text-xs font-medium text-indigo-600">Retake &rarr;</div>
              </Link>
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
