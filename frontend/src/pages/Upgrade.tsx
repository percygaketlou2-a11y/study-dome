import { useMutation } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'
import { useAuthStore } from '../store/authStore'

export function Upgrade() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const location = useLocation()
  const reason = (location.state as { reason?: string } | null)?.reason

  const upgradeMutation = useMutation({
    mutationFn: async () => (await api.post<{ plan: 'free' | 'premium' }>('/billing/upgrade')).data,
    onSuccess: (data) => updateUser({ plan: data.plan }),
  })

  const downgradeMutation = useMutation({
    mutationFn: async () => (await api.post<{ plan: 'free' | 'premium' }>('/billing/downgrade')).data,
    onSuccess: (data) => updateUser({ plan: data.plan }),
  })

  const isPremium = user?.plan === 'premium'

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-slate-900">Unlock Everything</h1>
      <p className="mt-1 text-sm text-slate-500">One payment, made once. No subscription, nothing to renew.</p>
      {reason && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{reason}</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">Free</h2>
          <p className="mt-1 text-sm text-slate-500">Core quizzes and subject notes.</p>
          <p className="mt-4 text-2xl font-semibold text-slate-900">P0</p>
          {!isPremium && (
            <p className="mt-4 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Current plan
            </p>
          )}
        </div>

        <div className="rounded-lg border border-indigo-300 bg-indigo-50 p-5 shadow-sm">
          <h2 className="text-lg font-medium text-indigo-900">Premium</h2>
          <p className="mt-1 text-sm text-indigo-700">Every past paper and every quiz, unlocked for good.</p>
          <p className="mt-4 text-2xl font-semibold text-indigo-900">
            P60 <span className="text-sm font-normal text-indigo-700">once-off</span>
          </p>
          {isPremium ? (
            <>
              <p className="mt-4 inline-block rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                Current plan
              </p>
              <button
                onClick={() => downgradeMutation.mutate()}
                disabled={downgradeMutation.isPending}
                className="mt-4 block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                {downgradeMutation.isPending ? 'Resetting...' : 'Reset to Free (testing only)'}
              </button>
            </>
          ) : (
            <button
              onClick={() => upgradeMutation.mutate()}
              disabled={upgradeMutation.isPending}
              className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {upgradeMutation.isPending ? 'Unlocking...' : 'Pay P60 once, unlock everything'}
            </button>
          )}
          {(upgradeMutation.isError || downgradeMutation.isError) && (
            <p className="mt-2 text-sm text-red-600">
              {getErrorMessage(upgradeMutation.error ?? downgradeMutation.error)}
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        No payment is processed yet — this button switches your plan directly so the unlock can be tested
        before real payments are wired in. "Reset to Free" exists only for testing; a real one-time purchase
        would not be self-service reversible.
      </p>
    </Layout>
  )
}
