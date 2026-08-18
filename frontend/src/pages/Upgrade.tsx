import { useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'
import { useAuthStore } from '../store/authStore'

interface BillingConfig {
  dpoConfigured: boolean
  price: number
  currency: string
}

export function Upgrade() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const location = useLocation()
  const reason = (location.state as { reason?: string } | null)?.reason
  const [searchParams, setSearchParams] = useSearchParams()
  const paymentResult = searchParams.get('payment')

  const { data: config } = useQuery({
    queryKey: ['billing-config'],
    queryFn: async () => (await api.get<BillingConfig>('/billing/config')).data,
  })

  // After DPO redirects back with ?payment=success, re-fetch the real plan
  // from the server rather than trusting the redirect alone.
  useEffect(() => {
    if (paymentResult !== 'success') return
    api.get<{ plan: 'free' | 'premium' }>('/billing/status').then(({ data }) => {
      updateUser({ plan: data.plan })
    })
  }, [paymentResult])

  const dpoMutation = useMutation({
    mutationFn: async () => (await api.post<{ checkoutUrl: string }>('/billing/dpo/initiate')).data,
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl
    },
  })

  const upgradeMutation = useMutation({
    mutationFn: async () => (await api.post<{ plan: 'free' | 'premium' }>('/billing/upgrade')).data,
    onSuccess: (data) => updateUser({ plan: data.plan }),
  })

  const downgradeMutation = useMutation({
    mutationFn: async () => (await api.post<{ plan: 'free' | 'premium' }>('/billing/downgrade')).data,
    onSuccess: (data) => updateUser({ plan: data.plan }),
  })

  const isPremium = user?.plan === 'premium'
  const price = config?.price ?? 60

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-slate-900">Unlock Everything</h1>
      <p className="mt-1 text-sm text-slate-500">One payment, made once. No subscription, nothing to renew.</p>
      {reason && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{reason}</p>
      )}
      {paymentResult === 'success' && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Payment received — Premium is unlocked.
        </p>
      )}
      {(paymentResult === 'failed' || paymentResult === 'error') && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {paymentResult === 'failed' ? 'Payment was not completed.' : 'Something went wrong starting payment.'}{' '}
          Please try again.
        </p>
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
            P{price} <span className="text-sm font-normal text-indigo-700">once-off</span>
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
          ) : config?.dpoConfigured ? (
            <>
              <button
                onClick={() => {
                  setSearchParams({})
                  dpoMutation.mutate()
                }}
                disabled={dpoMutation.isPending}
                className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {dpoMutation.isPending ? 'Starting checkout...' : `Pay P${price} with DPO`}
              </button>
              <button
                onClick={() => upgradeMutation.mutate()}
                disabled={upgradeMutation.isPending}
                className="mt-2 block text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                Use test unlock instead (dev only)
              </button>
            </>
          ) : (
            <button
              onClick={() => upgradeMutation.mutate()}
              disabled={upgradeMutation.isPending}
              className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {upgradeMutation.isPending ? 'Unlocking...' : `Pay P${price} once, unlock everything`}
            </button>
          )}
          {(upgradeMutation.isError || downgradeMutation.isError || dpoMutation.isError) && (
            <p className="mt-2 text-sm text-red-600">
              {getErrorMessage(upgradeMutation.error ?? downgradeMutation.error ?? dpoMutation.error)}
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        {config?.dpoConfigured
          ? 'Payments are processed by DPO Pay. "Reset to Free" and the test unlock are left in for development and are not part of the real checkout.'
          : 'No payment provider is connected yet — this button switches your plan directly so the unlock can be tested before real payments are wired in.'}
      </p>
    </Layout>
  )
}
