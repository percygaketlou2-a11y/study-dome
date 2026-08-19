import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const ADMIN_LINKS = [
  { to: '/admin/quizzes', label: 'Quizzes' },
  { to: '/admin/curricula', label: 'Curricula' },
  { to: '/admin/notes', label: 'Notes' },
  { to: '/admin/access', label: 'Access' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/payments', label: 'Payments' },
]

export function Layout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const adminMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!adminMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target as Node)) {
        setAdminMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [adminMenuOpen])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link to="/" className="text-lg font-semibold text-indigo-600">
              Study Dome
            </Link>
            {user && (
              <Link to="/leaderboard" className="text-sm font-medium text-slate-600 hover:text-indigo-600">
                Leaderboard
              </Link>
            )}
            {user?.isAdmin && (
              <div className="relative" ref={adminMenuRef}>
                <button
                  onClick={() => setAdminMenuOpen((v) => !v)}
                  className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-indigo-600"
                >
                  Admin
                  <span className="text-xs">▾</span>
                </button>
                {adminMenuOpen && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    {ADMIN_LINKS.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setAdminMenuOpen(false)}
                        className="block px-3 py-1.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-2 text-sm text-slate-600 sm:gap-4">
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
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
