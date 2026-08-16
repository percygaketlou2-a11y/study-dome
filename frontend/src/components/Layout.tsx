import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function Layout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-semibold text-indigo-600">
              Study Dome
            </Link>
            {user && (
              <Link to="/leaderboard" className="text-sm font-medium text-slate-600 hover:text-indigo-600">
                Leaderboard
              </Link>
            )}
            {user?.isAdmin && (
              <>
                <Link to="/admin/notes" className="text-sm font-medium text-slate-600 hover:text-indigo-600">
                  Notes
                </Link>
                <Link to="/admin/access" className="text-sm font-medium text-slate-600 hover:text-indigo-600">
                  Access
                </Link>
              </>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <Link
                to="/upgrade"
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  user.plan === 'premium'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {user.plan === 'premium' ? 'Premium' : 'Free plan'}
              </Link>
              <Link to="/account" className="hover:text-indigo-600">
                {user.name}
              </Link>
              <button
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
