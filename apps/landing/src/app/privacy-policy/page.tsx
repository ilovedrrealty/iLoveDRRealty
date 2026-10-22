import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How I Love DR Realty collects, uses, and protects your information.',
  robots: { index: true, follow: true },
}

export default function Page() {
  return (
    <div className="max-w-175 mx-auto px-4 sm:px-6 py-14 sm:py-18 font-sans text-ink">
      <div className="mb-8">
        <div className="text-2.75 font-bold tracking-[.18em] uppercase text-sea mb-3">Legal</div>
        <h1 className="text-7 font-bold text-ink mb-2 tracking-[-.02em]">Privacy Policy</h1>
        <p className="text-[13px] text-dim">Last updated: October 22, 2026</p>
      </div>

      <div className="listing-prose">
        <p>
          I Love DR Realty ("we", "us", "our") respects your privacy. This policy explains what
          information we collect through ilovedrrealty.com and our related pages, how we use it,
          and the choices you have.
        </p>

        <h2>Information we collect</h2>
        <p>
          When you submit a form, request a call, or message us on WhatsApp, we collect the
          details you provide — such as your name, phone number, email address, and the
          information you share about your property interests. We also automatically collect
          referral information after you allow optional advertising measurement,
          including advertising identifiers such as <code>gclid</code>, <code>gbraid</code>,
          <code>wbraid</code>, and UTM campaign parameters. We save the inquiry's form, page,
          language and permission choices separately from your comments so our team can follow up
          and understand the source. Advertising identifiers are kept privately with the inquiry.
        </p>

        <h2>How we use your information</h2>
        <ul>
          <li>To respond to your inquiry and follow up about buying, selling, or investing in property.</li>
          <li>To route your request to the right agent through our internal systems and CRM.</li>
          <li>To measure which marketing channels and campaigns are effective.</li>
          <li>To improve our website and services.</li>
        </ul>

        <h2>How we share information</h2>
        <p>
          We do not sell your personal information. We share it only with service providers who
          help us operate — including our customer relationship management (CRM) platform, email
          delivery provider, and hosting/analytics providers — solely to deliver the services
          described above, and with individual agents assigned to assist you.
        </p>

        <h2>Cookies and advertising</h2>
        <p>
          If you choose “Allow measurement,” we load the Google advertising tag to measure
          accepted buying, selling, renting and general contact inquiries and WhatsApp clicks. We do not send your name, email,
          phone number or form comments in these advertising events, enable personalized
          advertising, or upload enhanced conversions. A random inquiry reference helps
          prevent duplicate conversion events. Google determines whether an event can be
          attributed to an eligible ad interaction; an inquiry does not guarantee an ad conversion.
          Choosing “No thanks” still allows you to submit an inquiry. Your permission to be
          contacted about a request is separate from optional advertising measurement.
          You may change “Privacy choices” at the bottom left of the site at any time.
          We remember that choice for up to 180 days, and retain campaign identifiers in
          your browser for up to 30 days after consent. Declining clears this site's stored
          campaign reference and stops future measurement events. You can also manage
          existing cookies through your browser settings.
        </p>

        <h2>Your choices</h2>
        <p>
          You may ask us to access, correct, or delete the information we hold about you at any
          time by contacting us using the details below.
        </p>

        <h2>Contact us</h2>
        <p>
          Questions about this policy? Reach us at{' '}
          <a href="mailto:ilovedrrealty@gmail.com">ilovedrrealty@gmail.com</a> or{' '}
          <a href="tel:+18096108094">+1 (809) 610-8094</a>.
        </p>
      </div>
    </div>
  )
}
