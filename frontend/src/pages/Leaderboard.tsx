import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Layout } from '../components/Layout'

interface LeaderboardRow {
  rank: number
  userId: string
  name: string
  curriculum: string | null
  totalActiveDays: number
  currentStreak: number
  isCurrentUser: boolean
}

export function Leaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => (await api.get<LeaderboardRow[]>('/leaderboard')).data,
  })

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-slate-900">Leaderboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Ranked by total active days &mdash; complete a quiz each day to climb.
      </p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading leaderboard...</p>}

      {data && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Curriculum</th>
                <th className="px-4 py-3 text-right">Streak</th>
                <th className="px-4 py-3 text-right">Active Days</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.userId}
                  className={`border-b border-slate-100 last:border-0 ${
                    row.isCurrentUser ? 'bg-indigo-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {row.name}
                    {row.isCurrentUser && <span className="ml-2 text-xs text-indigo-600">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.curriculum ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {row.currentStreak > 0 ? `🔥 ${row.currentStreak}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{row.totalActiveDays}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    No students yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
