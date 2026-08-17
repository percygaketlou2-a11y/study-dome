import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import { useAuthStore } from '../store/authStore'

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking')
  const [error, setError] = useState<string | null>(null)
  const updateUser = useAuthStore((s) => s.updateUser)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('This verification link is missing its token.')
      return
    }
    api
      .post('/auth/verify-email', { token })
      .then(() => {
        updateUser({ emailVerified: true })
        setStatus('success')
      })
      .catch((err) => {
        setStatus('error')
        setError(getErrorMessage(err))
      })
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {status === 'checking' && <p className="text-sm text-slate-500">Verifying your email...</p>}
        {status === 'success' && (
          <>
            <h1 className="mb-2 text-xl font-semibold text-slate-900">Email verified</h1>
            <p className="mb-4 text-sm text-slate-500">Your email address has been confirmed.</p>
            <Link to="/" className="text-sm text-indigo-600 hover:underline">
              Go to dashboard
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-sm text-red-600">{error}</p>
            <Link to="/" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
