import type { AuthUser } from '../store/authStore'

export type Role = AuthUser['role']

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Student',
  reviewer: 'Reviewer (teacher)',
  admin: 'Admin',
}

export const isStaff = (role?: Role) => role === 'admin' || role === 'reviewer'

// Where someone lands after signing in. Admins start on the main dashboard
// (which can show every curriculum), reviewers go straight to Content Review,
// and students pick a curriculum first if they have not already.
export function homePathFor(user: Pick<AuthUser, 'role' | 'selectedCurriculumId'>): string {
  if (user.role === 'admin') return '/'
  if (user.role === 'reviewer') return '/admin/content'
  return user.selectedCurriculumId ? '/' : '/onboarding'
}
