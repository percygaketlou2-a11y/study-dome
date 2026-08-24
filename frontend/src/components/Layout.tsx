import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const ADMIN_LINKS = [
  { to: '/admin/quizzes', label: 'Quizzes' },
  { to: '/admin/curricula', label: 'Curricula' },
  { to: '/admin/notes', label: 'Notes' },
  { to: '/admin/access', label: 'Access' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/payments', label: 'Payments' },
]

export function DomeMark() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="currentColor" aria-hidden="true">
        <path d="M3 19a9 9 0 0 1 18 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
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

  const isAdminSection = location.pathname.startsWith('/admin')
  const navLinkClass = (active: boolean) =>
    `text-sm font-medium transition ${active ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link to="/" className="flex items-center gap-2">
              <DomeMark />
              <span className="text-lg font-bold tracking-tight text-slate-900">Study Dome</span>
            </Link>
            {user && (
              <Link to="/leaderboard" className={navLinkClass(location.pathname === '/leaderboard')}>
                Leaderboard
              </Link>
            )}
            {user?.isAdmin && (
              <div className="relative" ref={adminMenuRef}>
                <button
                  onClick={() => setAdminMenuOpen((v) => !v)}
                  className={`flex items-center gap-1 ${navLinkClass(isAdminSection)}`}
                >
                  Admin
                  <span className={`text-xs transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {adminMenuOpen && (
                  <div className="absolute left-0 top-full z-10 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {ADMIN_LINKS.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setAdminMenuOpen(false)}
                        className={`block px-3 py-2 text-sm transition ${
                          location.pathname === link.to
                            ? 'bg-indigo-50 font-medium text-indigo-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
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
            <div className="flex items-center gap-2 text-sm text-slate-600 sm:gap-3">
              <Link
                to="/upgrade"
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  user.plan === 'premium'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {user.plan === 'premium' ? 'Premium' : 'Free plan'}
              </Link>
              <Link to="/account" className="font-medium text-slate-700 hover:text-indigo-600">
                {user.name}
              </Link>
              <button
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                className="btn-secondary px-3 py-1.5"
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
