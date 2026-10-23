import { Link } from 'react-router-dom'
import { LegalPage } from '../../components/LegalPage'

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="25 October 2026">
      <p>
        Study Dome ("we", "us") is an exam-preparation platform for JC, BGCSE, IGCSE, A-Level, IB and IEB students.
        This policy explains what information we collect, why, and how it's protected. It is written to be read
        by students, parents and teachers, and is intended to comply with Botswana's Data Protection Act, 2018.
      </p>

      <h2 className="text-base font-semibold text-slate-900">1. What we collect</h2>
      <p>We collect only what the platform needs to function — nothing beyond that:</p>
      <ul className="ml-5 list-disc space-y-1">
        <li>Account details: name, email address, and an encrypted (hashed) password — we never store your actual password.</li>
        <li>Your selected curriculum, so we can show the right subjects.</li>
        <li>Quiz results and study activity (which days you studied), used for your own dashboard, streak and progress tracking.</li>
        <li>If you purchase Premium: a payment record (amount, status, timestamps) from our payment provider, DPO Pay. We do not see or store your card details — those are handled entirely by DPO Pay under its own security and privacy terms.</li>
        <li>If you use the Contact form: your name, email and message, so we can reply.</li>
      </ul>
      <p>We do not collect your address, phone number, or any government ID. We do not ask for more than this.</p>

      <h2 className="text-base font-semibold text-slate-900">2. Cookies and tracking</h2>
      <p>
        We do not use cookies, advertising trackers, or analytics scripts of any kind. The only thing stored in
        your browser is a login token in local storage, so you stay signed in — this is strictly necessary for
        the app to work and is never used to track you across other sites. See our{' '}
        <Link to="/cookie-policy" className="font-medium text-indigo-600 hover:underline">
          Cookie Policy
        </Link>{' '}
        for details.
      </p>

      <h2 className="text-base font-semibold text-slate-900">3. Third-party video lessons</h2>
      <p>
        Some subjects include video lessons embedded from YouTube or Vimeo. Playing one of these loads that
        provider's own video player, which may set its own cookies according to its own privacy policy — this is
        outside our control. We don't embed anything from any other source.
      </p>

      <h2 className="text-base font-semibold text-slate-900">4. Who can see your data</h2>
      <p>
        Your quiz results and activity are visible to you and to Study Dome administrators for support and quality
        purposes. A partner school may request an aggregate, non-identifying engagement summary (e.g. how many
        students are active); we do not share an individual student's results with a school without consent.
        We do not sell or share your data with advertisers or any other third party.
      </p>

      <h2 className="text-base font-semibold text-slate-900">5. How long we keep it</h2>
      <p>
        We keep your account and activity data for as long as your account is active. If you'd like your account
        or data deleted or exported, contact us and we'll action it — see Section 7.
      </p>

      <h2 className="text-base font-semibold text-slate-900">6. Security</h2>
      <p>
        Passwords are stored encrypted, never in plain text. Access to administrative tools is restricted to
        verified administrators and re-checked on every request. We do not return internal error details to your
        browser if something goes wrong on our end.
      </p>

      <h2 className="text-base font-semibold text-slate-900">7. Your rights and how to reach us</h2>
      <p>
        You can ask to see, correct, export or delete your data at any time, consistent with Botswana's Data
        Protection Act, 2018. To do so, use our{' '}
        <Link to="/contact" className="font-medium text-indigo-600 hover:underline">
          Contact page
        </Link>
        .
      </p>

      <h2 className="text-base font-semibold text-slate-900">8. Changes to this policy</h2>
      <p>If this policy changes, we'll update the date at the top of this page.</p>
    </LegalPage>
  )
}
