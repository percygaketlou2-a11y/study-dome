import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { AuthLayout } from '../components/AuthLayout'
import { homePathFor } from '../lib/roles'

interface InviteInfo {
  email: string
  role: 'reviewer' | 'admin'
}

const ROLE_BLURB: Record<InviteInfo['role'], string> = {
  reviewer: "You've been invited as a reviewer, to check study material and approve it before students see it.",
  admin: "You've been invited as an administrator.",
}

// Landing page for an invitation link. The email and role come from the
// invitation itself - the person only chooses their name and password.
export function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: invite, isLoading, isError } = useQuery({
    queryKey: ['invite-info', token],
    queryFn: async () => (await api.post<InviteInfo>('/auth/invite-info', { token })).data,
    enabled: Boolean(token),
    retry: false,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/accept-invite', { token, name, password, acceptedTerms })
      login(data.token, data.user)
      navigate(homePathFor(data.user))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (!token || isError) {
    return (
      <AuthLayout>
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Invitation not valid</h1>
        <p className="mb-6 text-sm text-slate-600">
          This invitation link is invalid, has expired, or has already been used. Ask an administrator to send you a new one.
        </p>
        <Link to="/admin/login" className="btn-secondary w-full py-2.5">
          Go to staff sign in
        </Link>
      </AuthLayout>
    )
  }

  if (isLoading || !invite) {
    return (
      <AuthLayout>
        <p className="text-sm text-slate-500">Checking your invitation...</p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Set up your account</h1>
      <p className="mb-6 text-sm text-slate-500">{ROLE_BLURB[invite.role]}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="invite-email" className="field-label">
            Email
          </label>
          <input id="invite-email" type="email" value={invite.email} readOnly className="field-input bg-slate-50 text-slate-600" />
        </div>
        <div>
          <label htmlFor="invite-name" className="field-label">
            Your name
          </label>
          <input
            id="invite-name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="invite-password" className="field-label">
            Choose a password
          </label>
          <input
            id="invite-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
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
          {loading ? 'Creating account...' : 'Accept invitation'}
        </button>
      </form>
    </AuthLayout>
  )
}
