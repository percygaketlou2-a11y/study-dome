import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { AuthLayout } from '../components/AuthLayout'

export function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', { name, email, password, acceptedTerms })
      login(data.token, data.user)
      navigate('/onboarding')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
      <p className="mb-6 text-sm text-slate-500">Start preparing for your exams today.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-name" className="field-label">
            Name
          </label>
          <input
            id="signup-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="field-label">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="field-label">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            required
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-indigo-600"
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="font-medium text-indigo-600 hover:underline">
              Terms & Conditions
            </Link>{' '}
            and{' '}
            <Link to="/privacy-policy" target="_blank" className="font-medium text-indigo-600 hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading || !acceptedTerms} className="btn-primary w-full py-2.5">
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
