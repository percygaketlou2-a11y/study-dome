import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const ADMIN_LINKS = [
  { to: '/admin/content', label: 'Content Review' },
  { to: '/admin/quizzes', label: 'Quizzes' },
  { to: '/admin/curricula', label: 'Curricula' },
  { to: '/admin/notes', label: 'Notes' },
  { to: '/admin/videos', label: 'Videos' },
  { to: '/admin/tutorials', label: 'Tutorials' },
  { to: '/admin/contact-messages', label: 'Messages' },
  { to: '/admin/access', label: 'Access' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/payments', label: 'Payments' },
]

// Reviewers (teachers) get Content Review and nothing else from the admin area.
const REVIEWER_LINK = { to: '/admin/content', label: 'Content Review' }

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
  const adminMenuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!adminMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target as Node)) {
        setAdminMenuOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAdminMenuOpen(false)
        adminMenuButtonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [adminMenuOpen])

  const isAdminSection = location.pathname.startsWith('/admin')
  const navLinkClass = (active: boolean) =>
    `text-sm font-medium transition ${active ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link to="/" className="flex items-center gap-2">
              <DomeMark />
              <span className="text-lg font-bold tracking-tight text-slate-900">Study Dome</span>
            </Link>
            {user && user.role !== 'reviewer' && (
              <Link to="/leaderboard" className={navLinkClass(location.pathname === '/leaderboard')}>
                Leaderboard
              </Link>
            )}
            {user?.role === 'reviewer' && (
              <Link to={REVIEWER_LINK.to} className={navLinkClass(isAdminSection)}>
                {REVIEWER_LINK.label}
              </Link>
            )}
            {user?.role === 'admin' && (
              <div className="relative" ref={adminMenuRef}>
                <button
                  ref={adminMenuButtonRef}
                  onClick={() => setAdminMenuOpen((v) => !v)}
                  aria-haspopup="true"
                  aria-expanded={adminMenuOpen}
                  className={`flex items-center gap-1 ${navLinkClass(isAdminSection)}`}
                >
                  Admin
                  <span aria-hidden="true" className={`text-xs transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>
                {adminMenuOpen && (
                  <div role="menu" className="absolute left-0 top-full z-10 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
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
              {user.role === 'reviewer' ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Reviewer</span>
              ) : (
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
              )}
              <Link to="/account" className="font-medium text-slate-700 hover:text-indigo-600">
                {user.name}
              </Link>
              <button
                onClick={() => {
                  logout()
                  navigate(user.role === 'student' ? '/login' : '/admin/login')
                }}
                className="btn-secondary px-3 py-1.5"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:px-6">
          <span>&copy; {new Date().getFullYear()} Study Dome</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legal">
            <Link to="/privacy-policy" className="hover:text-indigo-600">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-indigo-600">
              Terms & Conditions
            </Link>
            <Link to="/cookie-policy" className="hover:text-indigo-600">
              Cookie Policy
            </Link>
            <Link to="/refund-policy" className="hover:text-indigo-600">
              Refund Policy
            </Link>
            <Link to="/contact" className="hover:text-indigo-600">
              Contact Us
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
