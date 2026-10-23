import { Link } from 'react-router-dom'
import { LegalPage } from '../../components/LegalPage'

export function RefundPolicy() {
  return (
    <LegalPage title="Refund Policy" lastUpdated="25 October 2026">
      <p>
        Premium is a single one-time payment that permanently unlocks every quiz, past paper, video lesson and
        tutorial — there's no subscription to cancel. This policy explains refunds for that payment.
      </p>

      <h2 className="text-base font-semibold text-slate-900">General rule</h2>
      <p>
        Because Premium unlocks digital content immediately, we don't offer refunds once you've accessed Premium
        material after upgrading.
      </p>

      <h2 className="text-base font-semibold text-slate-900">When a refund is available</h2>
      <p>We will refund your payment in full if, within 7 days of payment:</p>
      <ul className="ml-5 list-disc space-y-1">
        <li>you were charged in error (e.g. charged twice for the same upgrade), or</li>
        <li>a technical fault on our side prevented you from accessing Premium content at all.</li>
      </ul>

      <h2 className="text-base font-semibold text-slate-900">How to request one</h2>
      <p>
        <Link to="/contact" className="font-medium text-indigo-600 hover:underline">
          Contact us
        </Link>{' '}
        within 7 days of payment, including your account email and a description of the issue. We'll respond and,
        if approved, refund the payment through DPO Pay (our payment provider) back to your original payment
        method.
      </p>

      <h2 className="text-base font-semibold text-slate-900">Payment processing</h2>
      <p>
        Payments are processed by DPO Pay. We never see or store your card details — refer any payment-method
        questions to DPO Pay directly if needed.
      </p>
    </LegalPage>
  )
}
