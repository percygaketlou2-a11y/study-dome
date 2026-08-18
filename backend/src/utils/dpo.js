// Integration with DPO Pay (3G Direct Pay), a payment gateway widely used
// across Africa including Botswana, supporting Pula (BWP) directly.
//
// DPO's API is XML-over-HTTP (API v6), not REST/JSON like most modern
// providers. The flow is:
//   1. createToken()  - POST an XML payload describing the charge, get back
//                        a TransToken.
//   2. Redirect the customer's browser to DPO's hosted payment page with
//      that token: https://secure.3gdirectpay.com/payv2.php?ID=<TransToken>
//   3. DPO redirects the browser back to our callback URL after payment.
//   4. verifyToken()  - POST the TransToken to confirm what actually
//                        happened server-side before trusting the redirect
//                        (a browser redirect alone is not proof of payment).
//
// This is built against DPO's documented API shape but has not been
// exercised against a live DPO account (none was available while building
// it) - test thoroughly in DPO's sandbox before relying on it for real
// payments, and treat this comment as a flag to re-verify field names
// against DPO's current API reference if anything doesn't behave as
// expected.

const xml2js = require('xml2js');

const LIVE_API_URL = 'https://secure.3gdirectpay.com/API/v6/';
const TEST_API_URL = 'https://secure.3gdirectpay.com/API/v6/'; // DPO uses the same endpoint; sandbox behavior is controlled by the test CompanyToken DPO issues
const LIVE_PAY_URL = 'https://secure.3gdirectpay.com/payv2.php';

function isDpoConfigured() {
  return Boolean(process.env.DPO_COMPANY_TOKEN && process.env.DPO_SERVICE_TYPE);
}

function apiUrl() {
  return process.env.DPO_SANDBOX === 'true' ? TEST_API_URL : LIVE_API_URL;
}

async function postXml(xmlBody) {
  const res = await fetch(apiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xmlBody,
  });
  const text = await res.text();
  const parsed = await xml2js.parseStringPromise(text, { explicitArray: false });
  return parsed.API3G;
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])
  );
}

// Creates a DPO checkout token for one payment attempt.
async function createToken({ amount, currency, reference, description, redirectUrl, backUrl }) {
  const companyToken = process.env.DPO_COMPANY_TOKEN;
  const serviceType = process.env.DPO_SERVICE_TYPE;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(companyToken)}</CompanyToken>
  <Request>createToken</Request>
  <Transaction>
    <PaymentAmount>${escapeXml(amount)}</PaymentAmount>
    <PaymentCurrency>${escapeXml(currency)}</PaymentCurrency>
    <CompanyRef>${escapeXml(reference)}</CompanyRef>
    <RedirectURL>${escapeXml(redirectUrl)}</RedirectURL>
    <BackURL>${escapeXml(backUrl)}</BackURL>
    <CompanyRefUnique>0</CompanyRefUnique>
    <PTL>15</PTL>
  </Transaction>
  <Services>
    <Service>
      <ServiceType>${escapeXml(serviceType)}</ServiceType>
      <ServiceDescription>${escapeXml(description)}</ServiceDescription>
      <ServiceDate>${new Date().toISOString().slice(0, 10)}</ServiceDate>
    </Service>
  </Services>
</API3G>`;

  const result = await postXml(xml);
  return {
    resultCode: result.Result,
    resultExplanation: result.ResultExplanation,
    transToken: result.TransToken,
  };
}

function paymentUrl(transToken) {
  return `${LIVE_PAY_URL}?ID=${encodeURIComponent(transToken)}`;
}

// Confirms what actually happened to a transaction - always call this
// server-side before granting access, never trust the redirect alone.
async function verifyToken(transToken) {
  const companyToken = process.env.DPO_COMPANY_TOKEN;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(companyToken)}</CompanyToken>
  <Request>verifyToken</Request>
  <TransactionToken>${escapeXml(transToken)}</TransactionToken>
</API3G>`;

  const result = await postXml(xml);
  return {
    resultCode: result.Result,
    resultExplanation: result.ResultExplanation,
    // DPO returns Result "000" for an approved/paid transaction.
    approved: result.Result === '000',
  };
}

module.exports = { isDpoConfigured, createToken, verifyToken, paymentUrl };
