import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'
import { useAuthStore } from '../store/authStore'

export function Account() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)

  const [name, setName] = useState(user?.name ?? '')
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [devVerifyLink, setDevVerifyLink] = useState<string | null>(null)

  const nameMutation = useMutation({
    mutationFn: async () => (await api.patch('/user/profile', { name })).data,
    onSuccess: (data) => updateUser({ name: data.name }),
  })

  const emailMutation = useMutation({
    mutationFn: async () =>
      (await api.patch('/user/email', { newEmail, password: emailPassword })).data,
    onSuccess: (data) => {
      updateUser({ email: data.email, emailVerified: false })
      setDevVerifyLink(data.devVerifyLink)
      setNewEmail('')
      setEmailPassword('')
    },
  })

  const passwordMutation = useMutation({
    mutationFn: async () =>
      (await api.patch('/user/password', { currentPassword, newPassword })).data,
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
    },
  })

  const resendMutation = useMutation({
    mutationFn: async () => (await api.post('/auth/resend-verification')).data,
    onSuccess: (data) => setDevVerifyLink(data.devVerifyLink ?? null),
  })

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-slate-900">Account Settings</h1>

      {!user?.emailVerified && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">Your email address hasn't been verified yet.</p>
          <button
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            className="mt-2 text-sm font-medium text-indigo-600 hover:underline disabled:opacity-50"
          >
            {resendMutation.isPending ? 'Sending...' : 'Get verification link'}
          </button>
          {devVerifyLink && (
            <p className="mt-2 text-xs text-amber-700">
              No email provider is set up yet:{' '}
              <Link to={devVerifyLink} className="break-all text-indigo-600 hover:underline">
                {devVerifyLink}
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="mt-6 space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">Name</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              nameMutation.mutate()
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={nameMutation.isPending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Save
            </button>
          </form>
          {nameMutation.isSuccess && <p className="mt-2 text-sm text-emerald-600">Saved.</p>}
          {nameMutation.isError && (
            <p className="mt-2 text-sm text-red-600">{getErrorMessage(nameMutation.error)}</p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">Email</h2>
          <p className="mt-1 text-sm text-slate-500">Current: {user?.email}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              emailMutation.mutate()
            }}
            className="mt-3 space-y-2"
          >
            <input
              type="email"
              required
              placeholder="New email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="password"
              required
              placeholder="Current password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={emailMutation.isPending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {emailMutation.isPending ? 'Updating...' : 'Update email'}
            </button>
          </form>
          {emailMutation.isSuccess && (
            <p className="mt-2 text-sm text-emerald-600">
              Email updated. Check the verify-your-email banner above to re-verify.
            </p>
          )}
          {emailMutation.isError && (
            <p className="mt-2 text-sm text-red-600">{getErrorMessage(emailMutation.error)}</p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">Password</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              passwordMutation.mutate()
            }}
            className="mt-3 space-y-2"
          >
            <input
              type="password"
              required
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={passwordMutation.isPending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {passwordMutation.isPending ? 'Updating...' : 'Update password'}
            </button>
          </form>
          {passwordMutation.isSuccess && <p className="mt-2 text-sm text-emerald-600">Password updated.</p>}
          {passwordMutation.isError && (
            <p className="mt-2 text-sm text-red-600">{getErrorMessage(passwordMutation.error)}</p>
          )}
        </section>
      </div>
    </Layout>
  )
}
