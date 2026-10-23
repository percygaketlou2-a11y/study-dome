import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Layout } from '../components/Layout'

interface ContactMessage {
  id: string
  name: string
  email: string
  message: string
  createdAt: string
}

export function AdminContactMessages() {
  const { data: messages, isLoading } = useQuery({
    queryKey: ['admin-contact-messages'],
    queryFn: async () => (await api.get<ContactMessage[]>('/admin/contact-messages')).data,
  })

  return (
    <Layout>
      <h1 className="page-title">Contact Messages</h1>
      <p className="mt-1 text-sm text-slate-500">Admin only. Everything submitted through the public Contact Us form.</p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

      <div className="mt-6 space-y-3">
        {messages?.map((m) => (
          <div key={m.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900">{m.name}</span>
                <span className="ml-2 text-sm text-slate-500">{m.email}</span>
              </div>
              <span className="text-xs text-slate-500">{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{m.message}</p>
          </div>
        ))}
        {messages && messages.length === 0 && <p className="text-sm text-slate-500">No messages yet.</p>}
      </div>
    </Layout>
  )
}
