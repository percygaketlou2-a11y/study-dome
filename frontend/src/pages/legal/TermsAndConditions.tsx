import { Link } from 'react-router-dom'
import { LegalPage } from '../../components/LegalPage'

export function TermsAndConditions() {
  return (
    <LegalPage title="Terms & Conditions" lastUpdated="25 October 2026">
      <p>
        These terms govern your use of Study Dome. By creating an account, you agree to them. They are governed
        by the laws of Botswana.
      </p>

      <h2 className="text-base font-semibold text-slate-900">1. Accounts</h2>
      <ul className="ml-5 list-disc space-y-1">
        <li>You must provide accurate information when registering.</li>
        <li>Your account is personal to you and may not be shared, sold, or transferred to another person — including after you finish school. If we reasonably suspect an account is being used by someone other than the registered student, we may suspend it pending review.</li>
        <li>You're responsible for keeping your password secure. Tell us immediately if you think someone else has access to your account.</li>
      </ul>

      <h2 className="text-base font-semibold text-slate-900">2. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul className="ml-5 list-disc space-y-1">
        <li>Attempt to access another student's account or data.</li>
        <li>Upload, submit or share content that is unlawful, abusive, or infringes someone else's rights.</li>
        <li>Attempt to disrupt, reverse-engineer, or gain unauthorised access to the platform.</li>
        <li>Resell, redistribute or publicly republish Study Dome's study notes, quizzes, tutorials or video lessons outside the platform.</li>
      </ul>

      <h2 className="text-base font-semibold text-slate-900">3. Intellectual property</h2>
      <p>
        Study notes, quiz questions, tutorials and the Study Dome name and design belong to Study Dome or the
        teachers who contributed them, and are provided for your personal study use only. Past exam papers remain
        the property of their respective examination boards; we host them for revision purposes only.
      </p>

      <h2 className="text-base font-semibold text-slate-900">4. Premium plan</h2>
      <p>
        Premium is a one-time payment, not a recurring subscription — you pay once and keep access. See our{' '}
        <Link to="/refund-policy" className="font-medium text-indigo-600 hover:underline">
          Refund Policy
        </Link>{' '}
        for what happens if something goes wrong with a payment.
      </p>

      <h2 className="text-base font-semibold text-slate-900">5. Content accuracy</h2>
      <p>
        We do our best to keep study content accurate and up to date, but Study Dome is a revision aid, not a
        substitute for your school's own teaching or official syllabus materials. We don't guarantee any
        particular exam result from using the platform.
      </p>

      <h2 className="text-base font-semibold text-slate-900">6. Suspension & termination</h2>
      <p>
        We may suspend or close an account that breaches these terms. You can stop using Study Dome at any time;
        contact us if you'd like your account closed and data deleted.
      </p>

      <h2 className="text-base font-semibold text-slate-900">7. Liability</h2>
      <p>
        Study Dome is provided "as is". To the extent permitted by law, we are not liable for indirect or
        consequential loss arising from use of the platform, including exam outcomes. Nothing in these terms
        excludes liability that cannot lawfully be excluded.
      </p>

      <h2 className="text-base font-semibold text-slate-900">8. Contact</h2>
      <p>
        Questions about these terms?{' '}
        <Link to="/contact" className="font-medium text-indigo-600 hover:underline">
          Contact us
        </Link>
        .
      </p>
    </LegalPage>
  )
}
