import { LegalPage } from '../../components/LegalPage'

export function CookiePolicy() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="25 October 2026">
      <p>
        Study Dome does not use cookies, and does not use any advertising or analytics trackers. That's why you
        won't see a cookie-consent banner on this site — there's nothing non-essential to ask your permission for.
      </p>

      <h2 className="text-base font-semibold text-slate-900">What we actually store in your browser</h2>
      <p>
        We use your browser's local storage — a different mechanism from cookies — to keep a single login token
        so you stay signed in between visits. This is strictly necessary for the app to function (without it,
        you'd have to log in every time you opened a page) and is never used to track your activity elsewhere.
      </p>

      <h2 className="text-base font-semibold text-slate-900">Third-party video players</h2>
      <p>
        If a subject includes a video lesson, it is embedded from YouTube or Vimeo. Playing it loads that
        provider's own player in your browser, and that provider may set its own cookies according to its own
        cookie and privacy policy. This is outside our control — we only choose which videos to link to, we don't
        operate the player.
      </p>

      <h2 className="text-base font-semibold text-slate-900">Changes</h2>
      <p>If this ever changes — for example, if we add analytics in future — we'll update this page and add a proper consent banner before doing so.</p>
    </LegalPage>
  )
}
