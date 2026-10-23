import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import { ROLE_LABEL, type Role } from '../lib/roles'

interface AdminUser {
  id: string
  name: string
  email: string
  role: Role
  isOwner: boolean
  plan: 'free' | 'premium'
  emailVerified: boolean
  curriculum: string | null
  createdAt: string
}

type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

interface Invitation {
  id: string
  email: string
  role: 'reviewer' | 'admin'
  status: InviteStatus
  invitedBy: string | null
  createdAt: string
  expiresAt: string
}

interface CreatedInvite {
  email: string
  role: 'reviewer' | 'admin'
  inviteLink: string
  emailed: boolean
  expiresAt: string
}

const STATUS_STYLE: Record<InviteStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-slate-100 text-slate-700',
  revoked: 'bg-red-100 text-red-800',
}

function InviteStaff() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'reviewer' | 'admin'>('reviewer')
  const [created, setCreated] = useState<CreatedInvite | null>(null)
  const [copied, setCopied] = useState(false)

  const invite = useMutation({
    mutationFn: async () => (await api.post<CreatedInvite>('/admin/invitations', { email, role })).data,
    onSuccess: (data) => {
      setCreated(data)
      setCopied(false)
      setEmail('')
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] })
    },
  })

  async function copyLink() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.inviteLink)
      setCopied(true)
    } catch {
      setCopied(false) // clipboard blocked: the link is in a selectable box below
    }
  }

  return (
    <section className="card mt-6 p-5" aria-labelledby="invite-heading">
      <h2 id="invite-heading" className="section-title">
        Invite staff
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Teachers and other admins join by invitation only. The link works once, for that email address, and expires in 7 days.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          invite.mutate()
        }}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="invite-email" className="field-label">
            Email address
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="field-label">
            Role
          </label>
          <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as 'reviewer' | 'admin')} className="field-input">
            <option value="reviewer">Reviewer (teacher): Content Review only</option>
            <option value="admin">Admin: full access</option>
          </select>
        </div>
        <button type="submit" disabled={invite.isPending} className="btn-primary">
          {invite.isPending ? 'Creating...' : 'Create invitation'}
        </button>
      </form>

      {invite.isError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {getErrorMessage(invite.error)}
        </p>
      )}

      {created && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4" role="status">
          <p className="text-sm font-medium text-emerald-900">
            Invitation created for {created.email} as {ROLE_LABEL[created.role]}.
            {created.emailed ? ' It has also been emailed to them.' : ' Send them this link yourself:'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor="invite-link" className="sr-only">
              Invitation link
            </label>
            <input
              id="invite-link"
              readOnly
              value={created.inviteLink}
              onFocus={(e) => e.currentTarget.select()}
              className="field-input min-w-[16rem] flex-1 font-mono text-xs"
            />
            <button type="button" onClick={copyLink} className="btn-secondary">
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <p className="mt-2 text-xs text-emerald-900">
            This is the only time the link is shown. Anyone who has it can create the account, so share it privately. If it is lost, create a new invitation and the old one stops working.
          </p>
        </div>
      )}
    </section>
  )
}

function Invitations() {
  const queryClient = useQueryClient()
  const { data: invitations } = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: async () => (await api.get<Invitation[]>('/admin/invitations')).data,
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/invitations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-invitations'] }),
  })

  if (!invitations || invitations.length === 0) return null

  return (
    <section className="card mt-6 overflow-x-auto" aria-labelledby="invitations-heading">
      <h2 id="invitations-heading" className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
        Invitations
      </h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-3">Email</th>
            <th scope="col" className="px-4 py-3">Role</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Invited by</th>
            <th scope="col" className="px-4 py-3">Expires</th>
            <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((i) => (
            <tr key={i.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3 text-slate-900">{i.email}</td>
              <td className="px-4 py-3 text-slate-700">{ROLE_LABEL[i.role]}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[i.status]}`}>{i.status}</span>
              </td>
              <td className="px-4 py-3 text-slate-700">{i.invitedBy ?? 'Unknown'}</td>
              <td className="px-4 py-3 text-xs text-slate-600">{new Date(i.expiresAt).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-right">
                {i.status === 'pending' && (
                  <button
                    onClick={() => revoke.mutate(i.id)}
                    disabled={revoke.isPending}
                    aria-label={`Revoke invitation for ${i.email}`}
                    className="btn-danger-text"
                  >
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function AdminUsers() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const [error, setError] = useState<string | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get<AdminUser[]>('/admin/users')).data,
  })

  const updateUser = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<AdminUser, 'role' | 'plan'>> }) =>
      (await api.patch(`/admin/users/${id}`, patch)).data,
    onSuccess: (_data, { id, patch }) => {
      setError(null)
      queryClient.setQueryData<AdminUser[]>(['admin-users'], (old) => old?.map((u) => (u.id === id ? { ...u, ...patch } : u)))
    },
    onError: (err) => setError(getErrorMessage(err)),
  })

  const deleteUser = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: (_data, id) => {
      setError(null)
      queryClient.setQueryData<AdminUser[]>(['admin-users'], (old) => old?.filter((u) => u.id !== id))
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] })
    },
    onError: (err) => setError(getErrorMessage(err)),
  })

  return (
    <Layout>
      <h1 className="page-title">Users</h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin only. Students sign up themselves; teachers and admins are invited. Change a role or plan, or remove an account.
      </p>

      <InviteStaff />
      <Invitations />

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

      {users && (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">All accounts</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Curriculum</th>
                <th scope="col" className="px-4 py-3">Verified</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Plan</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id
                const roleLocked = u.isOwner || isSelf
                return (
                  <tr key={u.id} className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">
                      {u.name}
                      {isSelf && <span className="ml-1 badge-indigo">you</span>}
                      {u.isOwner && <span className="ml-1 badge-amber">owner</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 text-slate-600">{u.curriculum ?? '—'}</td>
                    <td className="px-4 py-3">
                      {u.emailVerified ? <span className="text-emerald-700">Yes</span> : <span className="text-slate-600">No</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={roleLocked}
                        title={u.isOwner ? 'The owner is always an admin' : isSelf ? "You can't change your own role" : undefined}
                        aria-label={`Role for ${u.name}`}
                        onChange={(e) => updateUser.mutate({ id: u.id, patch: { role: e.target.value as Role } })}
                        className="field-input px-2 py-1 text-xs disabled:bg-slate-50"
                      >
                        <option value="student">{ROLE_LABEL.student}</option>
                        <option value="reviewer">{ROLE_LABEL.reviewer}</option>
                        <option value="admin">{ROLE_LABEL.admin}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.plan}
                        aria-label={`Plan for ${u.name}`}
                        onChange={(e) => updateUser.mutate({ id: u.id, patch: { plan: e.target.value as 'free' | 'premium' } })}
                        className="field-input px-2 py-1 text-xs"
                      >
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && !u.isOwner && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${u.name} (${u.email})? This removes their quiz history too.`)) {
                              deleteUser.mutate(u.id)
                            }
                          }}
                          aria-label={`Delete ${u.name}`}
                          className="btn-danger-text"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
