import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Reset your password</h1>
        <p className="mb-6 text-sm text-slate-500">Enter your account email and we'll issue a reset link.</p>

        {!message ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">{message}</p>
            {devLink && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
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

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link to="/login" className="text-indigo-600 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  )
}
