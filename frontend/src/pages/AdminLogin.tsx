import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { AuthLayout } from '../components/AuthLayout'
import { homePathFor, isStaff } from '../lib/roles'

// Staff (teachers and administrators) sign in here. Students use /login: the
// server refuses student accounts on this form, so the two are kept apart.
export function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const token = useAuthStore((s) => s.token)
  const currentUser = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  if (token && currentUser && isStaff(currentUser.role)) {
    return <Navigate to={homePathFor(currentUser)} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/staff-login', { email, password })
      login(data.token, data.user)
      navigate(homePathFor(data.user))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <p className="eyebrow mb-2">Staff</p>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Staff sign in</h1>
      <p className="mb-6 text-sm text-slate-500">For teachers and administrators. Staff accounts are created by invitation.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="staff-email" className="field-label">
            Email
          </label>
          <input
            id="staff-email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="staff-password" className="field-label mb-0">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs font-medium text-indigo-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="staff-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? 'Signing in...' : 'Sign in as staff'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Are you a student?{' '}
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Student log in
        </Link>
      </p>
    </AuthLayout>
  )
}
