import { c } from '../design'

export const I = {
  globe:  ["M12 21a9 9 0 100-18 9 9 0 000 18z", "M3 12h18", "M12 3a14 14 0 000 18 14 14 0 000-18z"],
  bolt:   "M13 2L4 14h6l-1 8 9-12h-6z",
  layers: ["M12 3l9 5-9 5-9-5z", "M3 13l9 5 9-5"],
  chart:  ["M4 19V5", "M4 19h16", "M8 16l3-4 3 2 4-6"],
  shield: ["M12 3l8 3v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6z", "M9 12l2 2 4-4"],
}

export const PILLARS = [
  { icon: I.globe,  title: 'Global reach from day one',  desc: "Your listing appears across our platform, partner sites, AI search engines, and our social channels — reaching buyers in the diaspora and beyond, not just the local market.", tone: c.sea },
  { icon: I.bolt,   title: 'Verified, trust-first',       desc: "Every listing on our platform is reviewed for accuracy. That gatekeeping protects buyers — which is exactly why serious buyers come here first.", tone: c.coral },
  { icon: I.layers, title: 'Lead management built in',    desc: "Inquiries route to your dashboard and into GoHighLevel automatically. Hot leads tagged, follow-ups scheduled, nothing slips through.", tone: c.green },
  { icon: I.chart,  title: 'Data-backed pricing',         desc: "We review comparable listings and include verified sale data when it is available.", tone: c.gold },
]

export const REACH = [
  { num: 'ES / EN',    label: 'Bilingual listings translated automatically',   note: 'DeepL-powered translation reviewed before publish' },
  { num: 'USD + DOP',  label: 'Dual-currency display on every listing',         note: 'Daily FX update from DR Central Bank' },
  { num: 'AI-ready',   label: 'Schema markup for AI search engines',            note: 'Designed to be cited by ChatGPT, Perplexity, Google AI' },
  { num: 'WhatsApp',   label: 'Direct deep-link on every listing',              note: 'How DR buyers actually communicate' },
  { num: 'Open Graph', label: 'Clean previews on FB, IG, LinkedIn shares',      note: 'Tested on every social platform' },
  { num: 'Real-time',  label: 'Leads sync to GoHighLevel CRM',                  note: 'Plus dashboard view + email + Slack alerts' },
]

export const STEPS: [string, string, string][] = [
  ['01', 'Free home valuation',    "Tell us about your property. An agent reviews comparable listings, neighborhood demand, and any verified sales before preparing a price range."],
  ['02', 'Listing prep',           "Professional-grade listing with optimized photos, bilingual copy, location map, amenities, and pricing strategy. Reviewed by our admin team before going live."],
  ['03', 'Marketing launch',       "Listing pushed to our platform, partner sites, social channels, and the buyer-request database for instant matching with qualified leads."],
  ['04', 'Lead qualification',     "Inquiries filtered. You only spend time on serious buyers — pre-approved, budget-confirmed, and matched to your property's profile."],
  ['05', 'Offers & negotiation',   "We help with offers and use documented comparable properties to support your position."],
  ['06', 'Closing support',        "Attorney coordination, title transfer, escrow, deposit handling, and final handover — managed and tracked end to end."],
]

export const TRUST_ITEMS = [
  'Personalized marketing plan for every property',
  'Bilingual ES/EN listing, auto-translated and human-reviewed',
  'USD/DOP dual-currency on every page',
  "Listing approval queue keeps the platform's standard high",
  'Hot leads tagged and routed to you in real time',
  'Co-listing and referral splits supported transparently',
  'Commission tracker visible only to you and admins',
]

export const HERO_BG = 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1920&q=80&auto=format&fit=crop'
