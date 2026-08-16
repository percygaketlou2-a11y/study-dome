import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Onboarding } from './pages/Onboarding'
import { Dashboard } from './pages/Dashboard'
import { SubjectDetail } from './pages/SubjectDetail'
import { TakeQuiz } from './pages/TakeQuiz'
import { Leaderboard } from './pages/Leaderboard'
import { AdminNotes } from './pages/AdminNotes'
import { AdminAccess } from './pages/AdminAccess'
import { Upgrade } from './pages/Upgrade'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { VerifyEmail } from './pages/VerifyEmail'
import { Account } from './pages/Account'
import { ProtectedRoute, RequireCurriculum, RequireAdmin } from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RequireCurriculum>
              <Dashboard />
            </RequireCurriculum>
          </ProtectedRoute>
        }
      />
      <Route
        path="/subjects/:subjectId"
        element={
          <ProtectedRoute>
            <RequireCurriculum>
              <SubjectDetail />
            </RequireCurriculum>
          </ProtectedRoute>
        }
      />
      <Route
        path="/quizzes/:quizId/take"
        element={
          <ProtectedRoute>
            <RequireCurriculum>
              <TakeQuiz />
            </RequireCurriculum>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <ProtectedRoute>
            <Leaderboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/notes"
        element={
          <ProtectedRoute>
            <RequireAdmin>
              <AdminNotes />
            </RequireAdmin>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/access"
        element={
          <ProtectedRoute>
            <RequireAdmin>
              <AdminAccess />
            </RequireAdmin>
          </ProtectedRoute>
        }
      />
      <Route
        path="/upgrade"
        element={
          <ProtectedRoute>
            <Upgrade />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <Account />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
