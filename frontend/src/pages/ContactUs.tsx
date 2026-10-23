import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api/client'
import { Layout } from '../components/Layout'

export function ContactUs() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const submit = useMutation({
    mutationFn: async () => (await api.post('/contact', { name, email, message })).data,
    onSuccess: () => {
      setName('')
      setEmail('')
      setMessage('')
    },
  })

  return (
    <Layout>
      <div className="mx-auto max-w-lg">
        <h1 className="page-title">Contact Us</h1>
        <p className="mt-1 text-sm text-slate-500">
          Questions, support requests, data requests (access, correction, deletion), or partnership enquiries — send
          us a message and we'll get back to you.
        </p>

        {submit.isSuccess ? (
          <div className="card mt-6 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Thanks — your message has been sent. We'll reply to the email address you provided.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit.mutate()
            }}
            className="card mt-6 space-y-4 p-6"
          >
            <div>
              <label htmlFor="contact-name" className="field-label">
                Name
              </label>
              <input
                id="contact-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="field-label">
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="field-label">
                Message
              </label>
              <textarea
                id="contact-message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="field-input"
              />
            </div>

            {submit.isError && <p className="text-sm text-red-600">{getErrorMessage(submit.error)}</p>}

            <p className="text-xs text-slate-500">
              By submitting, you agree to our{' '}
              <Link to="/privacy-policy" className="font-medium text-indigo-600 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>

            <button type="submit" disabled={submit.isPending} className="btn-primary w-full py-2.5">
              {submit.isPending ? 'Sending...' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  )
}
