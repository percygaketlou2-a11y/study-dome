import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import { AuthLayout } from '../components/AuthLayout'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [devLink, setDevLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      setMessage(data.message)
      setDevLink(data.devResetLink ?? null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Reset your password</h1>
      <p className="mb-6 text-sm text-slate-500">Enter your account email and we'll issue a reset link.</p>

      {!message ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">{message}</p>
          {devLink && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 text-xs font-medium text-amber-800">
                No email provider is set up yet, so here's your link directly:
              </p>
              <Link to={devLink} className="break-all text-sm text-indigo-600 hover:underline">
                {devLink}
              </Link>
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  )
}
