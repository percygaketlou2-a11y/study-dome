import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DomeMark } from './Layout'

export function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-4 py-12">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-sm'}`}>
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <DomeMark />
          <span className="text-xl font-bold tracking-tight text-slate-900">Study Dome</span>
        </Link>
        <div className="card p-8">{children}</div>
      </div>
    </div>
  )
}
