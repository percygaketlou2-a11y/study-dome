import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function RequireCurriculum({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user && !user.selectedCurriculumId) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user?.isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}
