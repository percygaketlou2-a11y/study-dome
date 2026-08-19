import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Layout } from '../components/Layout'

interface Transaction {
  id: string
  userName: string
  userEmail: string
  provider: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed'
  createdAt: string
  completedAt: string | null
}

const STATUS_STYLES: Record<Transaction['status'], string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
}

export function AdminPayments() {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => (await api.get<Transaction[]>('/admin/payments')).data,
  })

  const totalPaid = transactions
    ?.filter((t) => t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
      <p className="mt-1 text-sm text-slate-500">Admin only. Every DPO checkout attempt, verified server-side.</p>

      {transactions && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-sm text-slate-500">Total received: </span>
          <span className="text-lg font-semibold text-slate-900">P{totalPaid ?? 0}</span>
        </div>
      )}

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

      {transactions && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{t.userName}</div>
                    <div className="text-xs text-slate-400">{t.userEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{t.provider}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {t.amount} {t.currency}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status]}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {t.completedAt ? new Date(t.completedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    No payment attempts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
