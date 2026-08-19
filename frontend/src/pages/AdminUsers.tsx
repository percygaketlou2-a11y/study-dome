import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'
import { useAuthStore } from '../store/authStore'

interface AdminUser {
  id: string
  name: string
  email: string
  isAdmin: boolean
  plan: 'free' | 'premium'
  emailVerified: boolean
  curriculum: string | null
  createdAt: string
}

export function AdminUsers() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get<AdminUser[]>('/admin/users')).data,
  })

  const updateUser = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<AdminUser, 'isAdmin' | 'plan'>> }) =>
      (await api.patch(`/admin/users/${id}`, patch)).data,
    onSuccess: (_data, { id, patch }) => {
      queryClient.setQueryData<AdminUser[]>(['admin-users'], (old) =>
        old?.map((u) => (u.id === id ? { ...u, ...patch } : u))
      )
    },
    onError: (err) => alert(getErrorMessage(err)),
  })

  const deleteUser = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<AdminUser[]>(['admin-users'], (old) => old?.filter((u) => u.id !== id))
    },
    onError: (err) => alert(getErrorMessage(err)),
  })

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
      <p className="mt-1 text-sm text-slate-500">Admin only. Toggle admin access or plan, or remove an account.</p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

      {users && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Curriculum</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-900">
                    {u.name}
                    {u.id === currentUser?.id && <span className="ml-1 text-xs text-indigo-500">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500">{u.curriculum ?? '—'}</td>
                  <td className="px-4 py-3">
                    {u.emailVerified ? (
                      <span className="text-emerald-600">Yes</span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={u.isAdmin}
                      onChange={(e) => updateUser.mutate({ id: u.id, patch: { isAdmin: e.target.checked } })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.plan}
                      onChange={(e) =>
                        updateUser.mutate({ id: u.id, patch: { plan: e.target.value as 'free' | 'premium' } })
                      }
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${u.name} (${u.email})? This removes their quiz history too.`)) {
                            deleteUser.mutate(u.id)
                          }
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
