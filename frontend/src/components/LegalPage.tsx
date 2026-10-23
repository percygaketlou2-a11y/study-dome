import type { ReactNode } from 'react'
import { Layout } from './Layout'

// Shared chrome for Privacy/Terms/Cookie/Refund policy pages: consistent
// title, last-updated date and readable prose width. These render inside the
// normal Layout (not behind auth) so anyone - a prospective student, a
// parent, the regional office - can read them without an account.
export function LegalPage({ title, lastUpdated, children }: { title: string; lastUpdated: string; children: ReactNode }) {
  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <h1 className="page-title">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">Last updated: {lastUpdated}</p>
        <div className="mt-6 space-y-4 text-sm leading-6 text-slate-700">{children}</div>
      </div>
    </Layout>
  )
}
