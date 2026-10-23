import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { isStaff } from '../lib/roles'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

// The student site needs a chosen curriculum. Admins are exempt because they
// can browse every curriculum, and reviewers don't use the student site at all.
export function RequireCurriculum({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user?.role === 'reviewer') return <Navigate to="/admin/content" replace />
  if (user && user.role !== 'admin' && !user.selectedCurriculumId) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

// Admins only (users, payments, quizzes, ...).
export function RequireAdmin({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

// Admins and reviewers (Content Review).
export function RequireStaff({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!isStaff(user?.role)) return <Navigate to="/" replace />
  return <>{children}</>
}
