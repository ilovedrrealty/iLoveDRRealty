import { c } from '../design'

export const CATS = [
  { key: 'All',       label: 'All Guides',     icon: '📚', a: c.ink,      b: '#2a3a5e' },
  { key: 'Moving',    label: 'Moving Here',     icon: '🌴', a: c.green,    b: '#1a5128' },
  { key: 'Investing', label: 'Investing',       icon: '📈', a: c.sea,      b: '#075480' },
  { key: 'Buying',    label: 'Buying Process',  icon: '🏠', a: c.coral,    b: c.coralDeep },
  { key: 'Lifestyle', label: 'Lifestyle',       icon: '☀️', a: c.gold,     b: '#c98700' },
  { key: 'Legal',     label: 'Legal & Tax',     icon: '⚖️', a: '#7c3aed',  b: '#5b21b6' },
] as const

export type CatKey = typeof CATS[number]['key']

export function catInfo(key: string) {
  return CATS.find(c => c.key === key) ?? CATS[0]
}

export const STATS: [string, string][] = [
  [
    "12",
    "Articles in the guide library"
  ],
  [
    "2",
    "Article languages"
  ],
  [
    "6",
    "Purchase-planning stages"
  ],
  [
    "3",
    "Selected guide topics"
  ],
  [
    "2026",
    "Dated guide edition"
  ]
]

export const STAT_COLORS = [c.gold, c.coral, c.sea, c.green, c.gold]

// ── Blog index cards ──────────────────────────────────────────────
// The featured + editor-pick slots showcase our flagship, in-depth guides.
export const FEATURED = {
  "slug": "can-americans-buy",
  "tag": "BUYER GUIDE · 2026",
  "title": "Can Americans Buy Property in the Dominican Republic? (2026 Guide)",
  "desc": "Americans can generally buy Dominican property as nonresidents. Use this guide to organize title checks, a written closing budget and the questions to resolve before committing funds.",
  "author": "iLoveDRRealty Team",
  "role": "Real estate guides",
  "read": "14 min read",
  "initials": "DR",
  "img": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80&auto=format&fit=crop"
}

export const EDITOR_PICKS = [
  {
    "slug": "closing-costs-dr",
    "img": "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=80&auto=format&fit=crop",
    "cat": "Buying",
    "icon": "🧾",
    "title": "Closing Costs in the Dominican Republic, Fully Explained (2026)",
    "desc": "Build a written purchase budget covering transfer tax, legal services, notary and registration, with a clearly hypothetical example and separate recurring costs.",
    "author": "iLoveDRRealty Team",
    "read": "11 min"
  },
  {
    "slug": "punta-cana-airbnb-roi",
    "img": "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=400&q=80&auto=format&fit=crop",
    "cat": "Investing",
    "icon": "📈",
    "title": "Punta Cana Rental Investment: A Practical ROI Model (2026)",
    "desc": "Build a property-specific rental model from documented income, available nights and itemized costs. Separate measured performance from assumptions and test what happens when bookings fall.",
    "author": "iLoveDRRealty Team",
    "read": "13 min"
  }
]

// The filterable guides grid now showcases our generated, in-depth posts.
export const GUIDES = [
  {
    "slug": "can-americans-buy",
    "cat": "Buying",
    "icon": "🏠",
    "title": "Can Americans Buy Property in the Dominican Republic? (2026 Guide)",
    "desc": "Americans can generally buy Dominican property as nonresidents. Use this guide to organize title checks, a written closing budget and the questions to resolve before committing funds.",
    "read": "14 min",
    "img": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80&auto=format&fit=crop"
  },
  {
    "slug": "closing-costs-dr",
    "cat": "Buying",
    "icon": "🧾",
    "title": "Closing Costs in the Dominican Republic, Fully Explained (2026)",
    "desc": "Build a written purchase budget covering transfer tax, legal services, notary and registration, with a clearly hypothetical example and separate recurring costs.",
    "read": "11 min",
    "img": "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=500&q=80&auto=format&fit=crop"
  },
  {
    "slug": "punta-cana-airbnb-roi",
    "cat": "Investing",
    "icon": "📈",
    "title": "Punta Cana Rental Investment: A Practical ROI Model (2026)",
    "desc": "Build a property-specific rental model from documented income, available nights and itemized costs. Separate measured performance from assumptions and test what happens when bookings fall.",
    "read": "13 min",
    "img": "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=500&q=80&auto=format&fit=crop"
  }
]

// Staged for future weeks — not rendered on the blog index. To publish a post,
// move its entry back up into GUIDES. The article pages still exist in ARTICLES.
export const HIDDEN_GUIDES = [
  {
    "slug": "can-canadians-buy",
    "cat": "Buying",
    "icon": "🍁",
    "title": "Can Canadians Buy Property in the Dominican Republic? (2026 Guide)",
    "desc": "A Canadian buyer should plan two linked reviews: the Dominican property transaction and the Canadian tax/reporting position. Here are the documents and questions to organize before committing funds.",
    "read": "12 min",
    "img": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=500&q=80&auto=format&fit=crop"
  },
  {
    "slug": "property-taxes-ipi",
    "cat": "Legal",
    "icon": "🧮",
    "title": "Dominican Republic Property Taxes & IPI, Fully Explained (2026)",
    "desc": "Understand the 2026 general individual-owner IPI basis, its annual exemption, payment dates and a DOP-only calculation. Keep transfer tax and any specifically approved relief separate.",
    "read": "11 min",
    "img": "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=500&q=80&auto=format&fit=crop"
  },
  {
    "slug": "las-terrenas",
    "cat": "Moving",
    "icon": "🏖️",
    "title": "Living in Las Terrenas: The Expat Guide (2026)",
    "desc": "Explore Las Terrenas through the practical questions that matter for a move: daily routes, beach access, services, a personal budget and the evidence behind a property purchase.",
    "read": "12 min",
    "img": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&q=80&auto=format&fit=crop"
  },
  {
    "slug": "best-places-to-retire",
    "cat": "Lifestyle",
    "icon": "🌅",
    "title": "Retirement in the Dominican Republic: Compare Places and Requirements (2026)",
    "desc": "Compare potential retirement bases using your healthcare, transport, housing and budget needs. Review the published pensioner and rentista requirements separately from the property decision.",
    "read": "13 min",
    "img": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=500&q=80&auto=format&fit=crop"
  },
  {
    "slug": "dr-real-estate-safe",
    "cat": "Buying",
    "icon": "🛡️",
    "title": "Is Dominican Republic Real Estate Safe? Scams to Avoid (2026)",
    "desc": "Assess legal, physical, financial and personal-safety risks separately. This guide organizes the documents, payment controls and independent checks to resolve before committing to a property.",
    "read": "12 min",
    "img": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=500&q=80&auto=format&fit=crop"
  },
  {
    "slug": "living-punta-cana",
    "cat": "Moving",
    "icon": "🌴",
    "title": "Living in Punta Cana: The Complete Expat Guide (2026)",
    "desc": "Compare the communities in the Bávaro–Punta Cana area using actual daily routes, services, association rules and a property-specific budget. Separate a holiday experience from the requirements of living or investing there.",
    "read": "13 min",
    "img": "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=500&q=80&auto=format&fit=crop"
  },
  {
    "slug": "confotur-explained",
    "cat": "Legal",
    "icon": "🏛️",
    "title": "CONFOTUR Explained: Project-Specific Tax Incentives in the DR (2026)",
    "desc": "Understand what project classification does and does not establish. Check the unit, acquisition, tax authorization and remaining approved period before including any benefit in a purchase budget.",
    "read": "11 min",
    "img": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=500&q=80&auto=format&fit=crop"
  },
  {
    "slug": "dr-vs-miami",
    "cat": "Investing",
    "icon": "⚖️",
    "title": "Dominican Republic vs Miami: The 2026 Investor Case",
    "desc": "Compare actual properties in two jurisdictions using the same price basis, rental period, expense definitions and risk questions. Separate local tax rules from hypothetical arithmetic and unsupported market averages.",
    "read": "12 min",
    "img": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=500&q=80&auto=format&fit=crop"
  },
  {
    "slug": "living-cabarete-sosua",
    "cat": "Moving",
    "icon": "🏄",
    "title": "Living in Cabarete & Sosúa: North Coast Expat Guide (2026)",
    "desc": "Compare Cabarete and Sosúa through daily-life and property questions: beach access, water-sport interests, transport, services, actual costs and the evidence needed before renting or buying.",
    "read": "12 min",
    "img": "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=500&q=80&auto=format&fit=crop"
  }
]

export const STEPS: [string, string, string, string][] = [
  [
    "01",
    "🔍",
    "Search & discover",
    "Define goals, budget and shortlisted regions."
  ],
  [
    "02",
    "🤝",
    "Make an offer",
    "Review offer, reservation and deposit conditions."
  ],
  [
    "03",
    "📋",
    "Due diligence",
    "Check title, survey, authority, permits and condition."
  ],
  [
    "04",
    "✍️",
    "Promise of sale",
    "Agree price, deadlines, custody and release conditions."
  ],
  [
    "05",
    "🏦",
    "Financing",
    "Confirm funding, currency and any lender approval."
  ],
  [
    "06",
    "🔑",
    "Closing & transfer",
    "Confirm applicable taxes, documents and registration."
  ]
]

export const STEP_COLORS = [c.gold, c.coral, c.sea, '#7c3aed', c.green, c.gold]

export const FAQS: [string, string][] = [
  [
    "Can foreigners own property in the Dominican Republic?",
    "Foreigners can generally acquire Dominican property without residence under the national-treatment framework. Confirm the exact title, ownership structure, coastal/public-domain, environmental and use restrictions with independent counsel."
  ],
  [
    "What taxes do I pay when buying property?",
    "The general real-estate transfer-tax rate is 3%, subject to the actual DGII basis and authorized relief. Individual-owner annual IPI generally applies at 1% above the annual exemption on combined taxable assessed holdings. Verify the year, owner structure and specific approvals; a CONFOTUR label is not automatic relief."
  ],
  [
    "How long does the buying process take?",
    "The schedule depends on documents, title and survey issues, financing, required approvals and registry processing. Agree evidence-based milestones; no fixed completion time is promised here."
  ],
  [
    "Do I need a Dominican attorney?",
    "Engage independent Dominican counsel, verify professional standing and conflicts, and agree the written scope. Ask who handles title, survey, seller authority, contract conditions, custody and registration; professional review does not guarantee every risk is removed."
  ],
  [
    "What is residency and do I need it to buy property?",
    "Buying and residence are separate processes. A purchase does not itself grant residence, extend a visitor stay or create blanket tax relief. Check current visa/residence requirements and any separately approved benefits for your circumstances."
  ],
  [
    "Can I rent out my property when I'm not using it?",
    "Confirm the property’s lawful rental use, association rules, permits, tax obligations, insurance and management arrangements before offering it. Do not assume that a listing or booking tool establishes rental permission or supports payment processing."
  ]
]

export const FAQ_COLORS = [c.coral, c.sea, c.green, c.gold, '#7c3aed', c.coral]

// ── Article content model ─────────────────────────────────────────
// Rich block types let articles read like true, in-depth blog posts:
// headings, paragraphs, lists, tables, expert-tip callouts and inline
// internal links. Inline links use [[Label|page]] or [[Label|article|slug]]
// markup inside any paragraph or list item.
export type Block =
  | ['h', string]                                              // H2 section heading
  | ['h3', string]                                             // H3 sub-heading
  | ['p', string]                                              // paragraph (supports [[link]] markup)
  | ['ul', string[]]                                           // bulleted list
  | ['ol', string[]]                                           // numbered list
  | ['tip', string]                                            // expert-tip callout
  | ['table', { headers: string[]; rows: string[][] }]         // comparison table
  | ['cta', { label: string; page: string; slug?: string }]   // inline conversion button

// Kept for backwards compatibility with any external imports.
export type ArticleBody = Block

export type Faq = { q: string; a: string }

export type Article = {
  catKey: CatKey
  catLabel: string
  read: string
  reads: string
  date: string
  author: string
  role: string
  initials: string
  title: string
  lede: string
  facts: [string, string][]
  body: Block[]
  img: string
  faqs?: Faq[]
  // SEO
  metaTitle?: string
  metaDescription?: string
  keywords?: string[]
}

export const ARTICLES: Record<string, Article> = {
  "can-americans-buy": {
    "catKey": "Buying",
    "catLabel": "Buyer Guide",
    "read": "14 min",
    "reads": "—",
    "date": "June 29, 2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "Can Americans Buy Property in the Dominican Republic? (2026 Guide)",
    "lede": "Americans can generally buy Dominican property as nonresidents. Use this guide to organize title checks, a written closing budget and the questions to resolve before committing funds.",
    "metaTitle": "Can Americans Buy Property in the Dominican Republic? (2026 Guide)",
    "metaDescription": "Americans can generally buy Dominican property without residence. Organize independent title checks, transaction documents, actual closing quotes and immigration questions.",
    "keywords": [
      "can americans buy property in dominican republic",
      "foreigners buying property dominican republic",
      "us citizen buy real estate dominican republic",
      "dominican republic property for foreigners"
    ],
    "facts": [
      [
        "Ownership",
        "Confirm title and permitted use"
      ],
      [
        "Residence",
        "A separate immigration process"
      ],
      [
        "3%",
        "General transfer-tax rate"
      ],
      [
        "Documents",
        "Obtain a transaction checklist"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "American nationality does not generally prevent a Dominican real-estate purchase. The national-treatment principle for foreign investment does not remove parcel-specific title, coastal/public-domain, environmental or land-use restrictions. Have independent counsel confirm the ownership structure and rights that can actually be transferred."
      ],
      [
        "p",
        "Start by separating the asking price, the registered property rights and the planned use. A listing or sales presentation does not establish legal ownership, buildability, rental permission or the condition of the building. This guide gives you a sequence for asking for evidence before signing or paying."
      ],
      [
        "h",
        "Do Americans really have the same property rights?"
      ],
      [
        "p",
        "Law 16-95 establishes national treatment for foreign investment, subject to its exceptions and other applicable laws. Ask your lawyer to check the particular title, registered rights, access, zoning and coastal restrictions rather than interpreting equal treatment as permission to buy or build anywhere."
      ],
      [
        "p",
        "Before sending or repatriating money, ask the sending and receiving banks what identification, source-of-funds, currency-conversion and tax documents they require. Obtain exchange-rate and wire-fee quotes in writing. A legal right to remit funds does not remove banking checks or taxes that apply to the transaction."
      ],
      [
        "tip",
        "Compare individual and company ownership with legal and tax advisers using your actual plans, succession needs and reporting obligations. Do not create a company simply because a sales pitch describes it as mandatory, and do not assume personal ownership is always the least expensive choice."
      ],
      [
        "h",
        "Do you need residency or a visa to buy?"
      ],
      [
        "p",
        "Buying a property and obtaining permission to live in the country are separate matters. A purchase does not extend a visitor stay or grant residence. If you plan to relocate, check the appropriate visa and residence requirements before agreeing a move date."
      ],
      [
        "p",
        "Residence and tax incentives need separate eligibility and approval checks. A purchase alone does not produce a blanket exemption on foreign income. Use the official immigration and tax requirements for your circumstances; [[contact our team|contact]] to discuss the property search, and engage appropriate independent advisers for legal or tax decisions."
      ],
      [
        "h",
        "The step-by-step buying process"
      ],
      [
        "p",
        "A purchase can be organized into the six stages below. The actual schedule depends on title issues, survey work, financing, approvals and registry processing. Ask the responsible advisers for transaction-specific milestones, required documents and updates before agreeing a completion date."
      ],
      [
        "ol",
        [
          "Define your goal and shortlist. Decide whether this is a lifestyle home, a pure rental investment, or both — it changes which region and property type fit. Start narrowing with our [[property search|search]].",
          "Make an offer. Have independent counsel review the reservation terms, deposit holder, refund conditions and expiry before you sign or pay.",
          "Due diligence. Obtain current registry information, verify the seller and authority to sign, and review the survey, taxes, permits and restrictions relevant to the property.",
          "Promise of Sale. Document the price, conditions, deadlines, deposit custody, release milestones, default remedies and responsibility for each cost. Deposit percentages and refund rights must be negotiated, not assumed.",
          "Arrange the balance. Obtain written lender terms if borrowing; otherwise confirm the bank transfer, currency, source-of-funds requirements and payment conditions with counsel.",
          "Closing and transfer. The final Deed of Sale (Contrato de Venta) is signed before a Notary, the transfer tax is paid, and the title is filed at the Registry so the property is recorded in your name."
        ]
      ],
      [
        "h",
        "What documents do Americans need?"
      ],
      [
        "p",
        "Ask your lawyer and the registry for the current document list for the buyer, seller and ownership structure. Common preparation topics include:"
      ],
      [
        "ul",
        [
          "Valid identity documents; foreign individuals may be asked for a passport.",
          "Any marriage, company, succession or representation documents relevant to the purchase.",
          "The tax registration or identification applicable to your specific transaction.",
          "Bank evidence of source of funds and any required translations, apostilles or legalizations."
        ]
      ],
      [
        "p",
        "Document requirements vary with the parties and transaction. Resolve missing identity or representation documents before agreeing an unconditional closing date."
      ],
      [
        "h",
        "What does it cost to buy?"
      ],
      [
        "p",
        "Build a line-by-line closing budget from the assessed transfer basis and written professional quotes. A percentage rule of thumb cannot replace the actual tax calculation, services, filing costs and any approved exemption."
      ],
      [
        "table",
        {
          "headers": [
            "Cost",
            "How to budget",
            "Evidence"
          ],
          "rows": [
            [
              "Transfer tax",
              "General rate 3%, unless approved relief applies",
              "DGII calculation and any exemption authorization"
            ],
            [
              "Attorney's services",
              "Written quote",
              "Scope, taxes, disbursements and payment terms"
            ],
            [
              "Notary and registration",
              "Itemized estimate",
              "Applicable fees and services"
            ],
            [
              "Annual IPI",
              "Separate recurring calculation",
              "Owner-wide taxable holdings and applicable exemptions"
            ]
          ]
        }
      ],
      [
        "p",
        "Our [[closing-cost guide|article|closing-costs-dr]] shows an illustrative calculation, not a quote for your purchase. Any CONFOTUR relief must be confirmed for the unit, acquisition and remaining approved period before it is included in your budget."
      ],
      [
        "cta",
        {
          "label": "Estimate your all-in costs with the ROI calculator",
          "page": "calculator"
        }
      ],
      [
        "h",
        "Can Americans get a mortgage in the DR?"
      ],
      [
        "p",
        "Compare written financing offers rather than assuming a nonresident borrower will receive a particular rate or loan-to-value ratio. Check eligibility, required down payment, currency, rate resets, fees, insurance, early-repayment terms and the property valuation. Borrowing against a home abroad creates obligations in that separate jurisdiction too."
      ],
      [
        "tip",
        "If financing is necessary, make the contract conditions reflect lender approval and a realistic funding schedule. Stress-test payments and exchange-rate changes before signing an unconditional obligation."
      ],
      [
        "h",
        "Is it safe? The real risks (and how to avoid them)"
      ],
      [
        "p",
        "A purchase involves legal, physical, financial and personal-safety risks. No country label, title certificate or online listing removes all of them. Independent due diligence should address the specific property and transaction, including the following issues:"
      ],
      [
        "ul",
        [
          "Check adviser independence, professional standing, conflicts and the written scope of work.",
          "Agree who holds deposits, release conditions, refunds and dispute handling; do not assume a custody arrangement exists.",
          "Verify the developer’s title, permits, contractual delivery obligations and track record for land or off-plan purchases.",
          "Compare registered survey information with the physical site and legal access."
        ]
      ],
      [
        "p",
        "Ask who has checked each document, when it was checked and what the review did not cover. Do not treat a listing approval as a legal opinion, building inspection or guaranteed investment. You can [[browse listings|search]] and [[talk to our team|contact]] while arranging independent verification."
      ],
      [
        "h",
        "Mistakes to guard against"
      ],
      [
        "ol",
        [
          "Assuming the closing works like a US transaction. Confirm the responsibilities, custody arrangements and any available insurance directly; do not presume any service is automatic.",
          "Underbudgeting. Obtain actual tax calculations and itemized professional quotes rather than relying only on a general closing-cost percentage.",
          "Confusing residency with ownership and over-engineering a corporate structure they do not need.",
          "Buying purely on vacation emotion. The villa that feels magical in February still has to make sense as a year-round asset."
        ]
      ],
      [
        "h",
        "The bottom line"
      ],
      [
        "p",
        "For an American buyer, the decision should rest on documented transferable rights, a workable budget and a clear contract. Verify the property independently, resolve funding and custody before payment, and treat immigration and tax planning as separate workstreams."
      ],
      [
        "cta",
        {
          "label": "Browse property listings",
          "page": "search"
        }
      ]
    ],
    "faqs": [
      {
        "q": "Can a US citizen own property in the Dominican Republic outright?",
        "a": "Americans can generally acquire Dominican real estate, subject to applicable law and the rights attached to the particular parcel. Have independent counsel verify title, ownership structure, access and use restrictions."
      },
      {
        "q": "Do I need to be a resident to buy property in the DR?",
        "a": "Property ownership and immigration permission are separate. A purchase does not grant residence or extend a visitor stay; obtain advice on the status needed for your intended length of stay."
      },
      {
        "q": "How much are closing costs for a foreign buyer?",
        "a": "Use the DGII transfer calculation, itemized legal/notarial/registration quotes and any specifically approved relief. A worked example is a budgeting aid, not evidence of the amount due on your purchase."
      },
      {
        "q": "Can Americans get a mortgage in the Dominican Republic?",
        "a": "Ask lenders for their current nonresident eligibility and written terms. Compare currency, down payment, valuation, rate changes, fees, insurance and early-repayment rules; approval is not guaranteed."
      },
      {
        "q": "Is buying property in the DR safe?",
        "a": "No process eliminates every risk. Independent legal, survey and physical checks, clear custody/release terms and a documented funding plan help you assess the particular transaction before committing."
      }
    ]
  },
  "closing-costs-dr": {
    "catKey": "Buying",
    "catLabel": "Costs & Taxes",
    "read": "11 min",
    "reads": "—",
    "date": "June 29, 2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "Closing Costs in the Dominican Republic, Fully Explained (2026)",
    "lede": "Build a written purchase budget covering transfer tax, legal services, notary and registration, with a clearly hypothetical example and separate recurring costs.",
    "metaTitle": "Dominican Republic Closing Costs Explained (2026) — Full Breakdown",
    "metaDescription": "A complete breakdown of closing costs when buying property in the Dominican Republic: the 3% transfer tax, attorney fees, notary costs, IPI property tax, plus a worked example.",
    "keywords": [
      "closing costs dominican republic",
      "dominican republic property transfer tax",
      "cost of buying property dominican republic",
      "IPI property tax dominican republic"
    ],
    "facts": [
      [
        "3%",
        "General transfer-tax rate"
      ],
      [
        "Quote",
        "Legal services"
      ],
      [
        "Itemize",
        "Notary and registry"
      ],
      [
        "Separate",
        "Annual ownership costs"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "The asking price is only one part of a purchase budget. Obtain the applicable tax assessment, written professional quotes and payment milestones before committing. This guide separates one-time acquisition costs from recurring ownership costs and illustrates arithmetic without presenting it as a market fee schedule."
      ],
      [
        "h",
        "The 3% transfer tax (Impuesto de Transferencia)"
      ],
      [
        "p",
        "DGII publishes a general 3% real-estate transfer charge. Ask for the calculation for your transaction, including its taxable basis and any authorized relief. Do not simply multiply an advertised asking price if that is not the accepted taxable value."
      ],
      [
        "p",
        "The contract should allocate transfer tax and other closing costs between the parties. Confirm the legal payment and filing deadlines with counsel; the negotiated closing date does not replace an official deadline."
      ],
      [
        "h",
        "Attorney fees: compare scope and written quotes"
      ],
      [
        "p",
        "Request a written legal-services quote defining the work, exclusions, taxes and disbursements. Do not assume an attorney automatically provides escrow, insurance, technical inspections or every registration service. Ask specifically who will carry out and document these tasks:"
      ],
      [
        "ul",
        [
          "Run a full title search at the Title Registry to confirm clean ownership and no liens.",
          "Verify boundaries, that property taxes are current, and that there are no encumbrances.",
          "Draft or review the Promise of Sale and the final Deed of Sale.",
          "Agree custody and release conditions for funds, coordinate closing and confirm who files and follows up the registration."
        ]
      ],
      [
        "tip",
        "Compare professional standing, independence, scope, communication and the written quote. Ask which title, survey, contract and registration tasks are included and which require another specialist. A low fee alone does not establish the quality or completeness of the review."
      ],
      [
        "h",
        "Notary and registration costs"
      ],
      [
        "p",
        "Ask the notary and registry for the services and fees applicable to the actual instrument and property. Keep taxes, official service charges and professional fees in separate budget lines, including translations, powers of attorney and other case-specific documents."
      ],
      [
        "h",
        "Annual costs you should plan for"
      ],
      [
        "p",
        "Closing costs are one-time, but two recurring costs matter for your budget:"
      ],
      [
        "ul",
        [
          "IPI: obtain the owner's aggregate taxable-property assessment and applicable exemptions. A home's asking price alone cannot establish annual IPI; see the dedicated tax guide for the current individual-owner basis.",
          "HOA / condo fees: if you buy in a gated community or condo building, monthly maintenance fees fund security, landscaping, pools and amenities. These vary widely — confirm the exact figure before you commit, especially for a rental-investment underwrite."
        ]
      ],
      [
        "h",
        "CONFOTUR: confirm any applicable relief"
      ],
      [
        "p",
        "A qualifying acquisition in an approved tourism project may receive specified tax relief. Obtain the definitive project classification and required transaction-specific tax authorization; do not budget an exemption solely because a brochure says CONFOTUR."
      ],
      [
        "p",
        "Check that the documents cover the exact unit, buyer, acquisition and applicable period. Resale benefits must not be presumed, and a later purchase does not automatically restart a project exemption term. Keep the professional review with your closing records."
      ],
      [
        "h",
        "A worked example"
      ],
      [
        "p",
        "For illustration only, assume a US$250,000 purchase and taxable transfer basis, a quoted legal fee equal to 1.25% and assumed notary/registration costs of 0.5%. These are chosen calculation inputs, not current market fee averages or a quote:"
      ],
      [
        "table",
        {
          "headers": [
            "Line item",
            "Assumed rate",
            "Illustrative amount (USD)"
          ],
          "rows": [
            [
              "Purchase price",
              "—",
              "$250,000"
            ],
            [
              "Transfer tax",
              "3%",
              "$7,500"
            ],
            [
              "Assumed legal quote",
              "1.25%",
              "$3,125"
            ],
            [
              "Assumed notary/registration",
              "0.5%",
              "$1,250"
            ],
            [
              "Total assumed one-time costs",
              "4.75%",
              "$11,875"
            ],
            [
              "Illustrative acquisition cash",
              "—",
              "$261,875"
            ]
          ]
        }
      ],
      [
        "p",
        "If a specific transfer exemption were approved, remove only that applicable tax line from the example. Do not erase legal, registration, financing or annual operating costs without separate evidence that they are covered."
      ],
      [
        "cta",
        {
          "label": "Model your exact numbers in the ROI calculator",
          "page": "calculator"
        }
      ],
      [
        "h",
        "Who pays what?"
      ],
      [
        "p",
        "Record the agreed cost allocation in the contract. Ask counsel to identify which obligations belong legally to each party and which professional fees are negotiable; a customary allocation is not a substitute for the signed terms."
      ],
      [
        "h",
        "Bottom line"
      ],
      [
        "p",
        "Bring together the tax calculation, itemized quotes, funding plan and any written relief before comparing the all-in price of different properties. Keep recurring IPI, community fees, insurance, repairs and financing separate so the purchase budget does not hide ownership costs."
      ],
      [
        "cta",
        {
          "label": "See how this fits the full buying process",
          "page": "article",
          "slug": "can-americans-buy"
        }
      ]
    ],
    "faqs": [
      {
        "q": "What are the total closing costs when buying property in the Dominican Republic?",
        "a": "There is no single total that fits every purchase. Use the actual tax basis and written quotes; the 4.75% in this guide is a hypothetical worked example, not a current market average."
      },
      {
        "q": "Who pays the transfer tax in the DR?",
        "a": "The general transfer charge is 3%. Confirm the assessed basis, applicable relief, legal deadline and the allocation between the parties for the particular transaction."
      },
      {
        "q": "What is the IPI property tax?",
        "a": "IPI is a recurring tax distinct from transfer tax. Its general individual-owner calculation uses combined taxable assessed real-estate holdings and applicable exemptions, not a fresh exemption for each home."
      },
      {
        "q": "Can closing costs be reduced?",
        "a": "Only include relief supported by the required approval for the particular acquisition. Compare itemized professional quotes without removing necessary due-diligence work or assuming a resale inherits another buyer’s exemption."
      }
    ]
  },
  "punta-cana-airbnb-roi": {
    "catKey": "Investing",
    "catLabel": "Investment Intelligence",
    "read": "13 min",
    "reads": "—",
    "date": "June 29, 2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "Punta Cana Rental Investment: A Practical ROI Model (2026)",
    "lede": "Build a property-specific rental model from documented income, available nights and itemized costs. Separate measured performance from assumptions and test what happens when bookings fall.",
    "metaTitle": "Punta Cana Rental ROI: Costs, Cash Flow and Scenario Planning",
    "metaDescription": "How to model a Punta Cana rental investment: verify occupancy and nightly rates, separate revenue from net cash flow, budget costs and compare downside scenarios.",
    "keywords": [
      "punta cana airbnb investment",
      "dominican republic real estate roi",
      "punta cana rental yield",
      "best airbnb investment dominican republic"
    ],
    "facts": [
      [
        "Evidence",
        "Dated property records"
      ],
      [
        "Revenue",
        "Occupied nights × rate"
      ],
      [
        "Costs",
        "Itemized operating budget"
      ],
      [
        "Scenarios",
        "Test lower bookings"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "An attractive rental listing is a starting point, not proof of investment performance. Build the decision around the property’s lawful rental use, dated booking records, operating condition and total acquisition cost. No market-average yield is asserted in this guide."
      ],
      [
        "h",
        "What does a Punta Cana rental actually earn?"
      ],
      [
        "p",
        "Request monthly records showing available nights, occupied nights, rates actually collected, refunds, fees and owner stays. Calendar blocks are not necessarily bookings, and advertised nightly rates are not collected income. When records are unavailable, label the model as a projection and document each assumption."
      ],
      [
        "p",
        "Calculate gross rental income separately from operating profit, financing and tax. State whether a return is based on purchase price, total acquisition cost or cash invested; those denominators produce different measures. A model should not call a manual booking total reconciled revenue."
      ],
      [
        "tip",
        "Ask for source documents behind any promised occupancy or return. Compare like-for-like properties and full-year periods, keep owner stays separate and test lower occupancy and higher costs before deciding."
      ],
      [
        "h",
        "Test the value of beach access"
      ],
      [
        "p",
        "Measure the actual walking route, public access and amenities. Compare dated bookings for genuinely similar units before assigning a premium to beachfront or near-beach positioning. Also budget insurance, maintenance and any access restrictions; a beach location does not guarantee occupancy."
      ],
      [
        "h",
        "Where to buy for rental performance"
      ],
      [
        "p",
        "Compare communities using the same evidence checklist rather than ranking them by an unsupported yield claim:"
      ],
      [
        "ul",
        [
          "Cap Cana: check the exact unit, association fees, rental rules, amenity access and operating quote.",
          "Bávaro: verify the precise location, guest access, competition and documented rental results.",
          "Uvero Alto: check transport, services, construction activity and the property’s permitted rental use."
        ]
      ],
      [
        "p",
        "Use the same model for other regions, including Las Terrenas and Cabarete, without assuming their prices or demand are lower or higher. Start with our [[property search|search]], then collect evidence for the shortlisted units."
      ],
      [
        "h",
        "The CONFOTUR tax advantage for investors"
      ],
      [
        "p",
        "Model CONFOTUR-related relief only after receiving the documents and tax approval applicable to the unit and transaction. Keep an ordinary-tax scenario alongside any confirmed-relief scenario; see the [[closing-cost and CONFOTUR discussion|article|closing-costs-dr]]. Relief is not proof of rental demand or net return."
      ],
      [
        "h",
        "The costs nobody puts in the brochure"
      ],
      [
        "p",
        "Gross rental revenue is not what you keep. A realistic Punta Cana underwrite has to subtract:"
      ],
      [
        "ul",
        [
          "Management: obtain a written fee quote specifying included services, minimums, taxes and charges paid separately.",
          "HOA / community fees: gated resort communities charge monthly fees for security and amenities — confirm the exact number, as it varies widely and hits net yield directly.",
          "Furnishing and setup: a rental-ready furnishing package is a real upfront cost that affects both your nightly rate and your first-year return.",
          "Utilities, internet, pool and garden upkeep, and a vacancy/maintenance reserve.",
          "Platform and payment fees, refunds and seasonal variation; annualize the model rather than extending a peak-week result to every month."
        ]
      ],
      [
        "h",
        "A transparent scenario model"
      ],
      [
        "p",
        "The table gives calculation rules, not market benchmarks. Enter property-specific evidence and document the changed assumptions in a downside case:"
      ],
      [
        "table",
        {
          "headers": [
            "Input or measure",
            "Evidence-based base case",
            "Downside test"
          ],
          "rows": [
            [
              "Occupancy",
              "Occupied nights ÷ genuinely available nights",
              "Fewer bookings or additional closure nights"
            ],
            [
              "Average daily rate",
              "Collected rental income ÷ occupied nights",
              "Lower collected rate and more refunds"
            ],
            [
              "Management fee",
              "Written quoted fee and separate charges",
              "Higher fee or reduced included services"
            ],
            [
              "Net return",
              "State costs and denominator explicitly",
              "Recalculate after vacancy and repair reserve"
            ],
            [
              "Appreciation",
              "Keep separate from operating income",
              "Do not require appreciation to pay expenses"
            ]
          ]
        }
      ],
      [
        "p",
        "Compare scenarios using the same period and currency. Show missing information rather than entering invented occupancy or costs. The ROI calculator can help explore chosen assumptions; its output remains a model, not evidence that a property earned those amounts."
      ],
      [
        "cta",
        {
          "label": "Run your own numbers in the ROI calculator",
          "page": "calculator"
        }
      ],
      [
        "h",
        "Mistakes investors make in Punta Cana"
      ],
      [
        "ol",
        [
          "Treating a quoted yield as verified performance without source records.",
          "Leaving management, payment fees or owner-paid bills outside the calculation.",
          "Assuming a beach location guarantees higher rates or occupancy.",
          "Budgeting tax relief without checking the specific approval and term.",
          "Using peak-week revenue as the forecast for every week of the year."
        ]
      ],
      [
        "h",
        "Is a Punta Cana Airbnb a good investment in 2026?"
      ],
      [
        "p",
        "A property may fit your objectives if its documented use, acquisition cost and realistic downside cash flow fit your budget and risk tolerance. Resolve missing records and obtain independent legal and tax advice before relying on an investment model."
      ],
      [
        "cta",
        {
          "label": "Browse investment listings",
          "page": "search"
        }
      ]
    ],
    "faqs": [
      {
        "q": "What ROI can I expect from a Punta Cana Airbnb?",
        "a": "There is no verified market-average ROI supplied here. Calculate the specific property using documented revenue, costs, financing and tax, and state the period and invested-capital basis."
      },
      {
        "q": "What is the average occupancy and nightly rate in Punta Cana?",
        "a": "Request dated property-level booking and payout records. Distinguish occupied from blocked nights and collected from advertised rates. Without those records, use clearly labeled assumptions rather than a claimed current average."
      },
      {
        "q": "How much does property management cost?",
        "a": "Obtain a written quote with scope, taxes, minimums and separately billed services. Compare the total annual operating cost, not only the headline fee percentage."
      },
      {
        "q": "Does CONFOTUR help short-term rental investors?",
        "a": "A particular acquisition may receive specified relief through the applicable approvals. Confirm the unit, transaction and remaining term; do not infer rental-income exemption or stronger demand from the project label."
      }
    ]
  },
  "can-canadians-buy": {
    "catKey": "Buying",
    "catLabel": "Buyer Guide",
    "read": "12 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "Can Canadians Buy Property in the Dominican Republic? (2026 Guide)",
    "lede": "A Canadian buyer should plan two linked reviews: the Dominican property transaction and the Canadian tax/reporting position. Here are the documents and questions to organize before committing funds.",
    "metaTitle": "Can Canadians Buy Property in the Dominican Republic? (2026 Guide)",
    "metaDescription": "Canadians can generally acquire Dominican real estate. Review title and transaction restrictions, closing costs and Canadian-resident tax and foreign-property reporting.",
    "keywords": [
      "can canadians buy property in dominican republic",
      "canadian buying dominican republic real estate",
      "dominican republic property canadian taxes",
      "snowbird property dominican republic"
    ],
    "facts": [
      [
        "Purchase",
        "Verify transferable rights"
      ],
      [
        "Residence",
        "Separate from ownership"
      ],
      [
        "1977",
        "Treaty entered into force"
      ],
      [
        "CRA",
        "Check resident reporting"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "Canadians can generally acquire Dominican real estate under the national-treatment framework. Confirm the particular title, ownership structure and restrictions with independent counsel; nationality alone does not establish what can be built, rented or transferred."
      ],
      [
        "p",
        "The property review and the Canadian tax review answer different questions. Confirm your Canadian tax-residence position rather than assuming citizenship alone decides your obligations, and give a cross-border accountant the actual intended personal and rental use."
      ],
      [
        "h",
        "The same rights as everyone else"
      ],
      [
        "p",
        "Law 16-95 provides national treatment subject to applicable exceptions and special laws. Confirm parcel restrictions, the legal interest being acquired and the banking/tax requirements for money movements; do not interpret general investment rights as unrestricted ownership or tax-free repatriation in every case."
      ],
      [
        "h",
        "Do Canadians need residency or a visa to buy?"
      ],
      [
        "p",
        "Ownership does not grant immigration permission or extend a visitor stay. Plan your intended length of stay separately from the purchase, and use our [[step-by-step buying guide|article|can-americans-buy]] to organize the transaction questions."
      ],
      [
        "h",
        "What it costs on the Dominican side"
      ],
      [
        "p",
        "Obtain a written transfer-tax calculation, legal/notarial/registration quotes and a separate annual ownership budget. Do not rely on an unsupported total closing-cost percentage. See the [[closing-cost example|article|closing-costs-dr]] and the [[IPI guide|article|property-taxes-ipi]] for the separate calculations."
      ],
      [
        "tip",
        "A CONFOTUR label is not proof that your acquisition is exempt. Request the definitive project resolution and the tax authorization for the exact unit and transaction. Check the remaining approved period and resale rules; a later purchase does not automatically start a new 15-year term."
      ],
      [
        "h",
        "Canadian reporting: residence and property use matter"
      ],
      [
        "p",
        "Canadian tax residents generally report worldwide income. Ask an accountant how the actual property use affects the appropriate income return, foreign-property reporting and any available credit:"
      ],
      [
        "ul",
        [
          "Rental income: report foreign rental income under the applicable Canadian rules. Form T776 is used for real-estate rentals; additional services can affect whether income is treated as business income instead.",
          "Foreign property reporting (T1135): Canadian-resident taxpayers generally file when the combined cost amount of specified foreign property exceeds CAD $100,000 at any time in the year. Property held primarily for personal use may be excluded, including some limited rentals that only recover expenses. Mixed-use treatment depends on the facts; income reporting is a separate obligation.",
          "Foreign tax credit (T2209): Canadian residents may qualify for a credit for eligible Dominican income taxes on income reported in Canada, subject to Canadian limits and their circumstances. The Canada–DR tax convention was signed on 6 August 1976 and entered into force on 23 September 1977; it does not guarantee that every tax payment is fully creditable."
        ]
      ],
      [
        "tip",
        "Arrange the cross-border tax review before committing to the purchase. Give the adviser your tax-residence facts, intended personal/rental use, acquisition cost and funding plan; confirm the applicable reporting and credit treatment in writing."
      ],
      [
        "h",
        "Financing: cash vs. a mortgage"
      ],
      [
        "p",
        "Obtain written financing quotes and compare them with available cash. Check borrower eligibility, currency, rates, fees, repayment terms and the consequences of using Canadian property as collateral. This guide does not assert current mortgage rates, approval probabilities or typical loan-to-value ratios."
      ],
      [
        "h",
        "Mistakes Canadian buyers make"
      ],
      [
        "ol",
        [
          "Ignoring the Canadian side. The DR purchase can be clean and still create a T1135/T776 obligation at home — plan for it before you buy.",
          "Assuming personal-use and rental are taxed the same. Mixed personal and rental use must be assessed on the facts; do not infer the T1135 outcome solely from an Airbnb listing.",
          "Skipping independent legal review or assuming a particular insurance/custody service is automatic. Agree who verifies title, handles funds and confirms registration.",
          "Budgeting CONFOTUR benefits without the documents and authorization for the specific transaction."
        ]
      ],
      [
        "h",
        "The bottom line for Canadians"
      ],
      [
        "p",
        "Keep the property evidence, Dominican closing budget and Canadian reporting plan together before deciding. Review the mixed-use and exchange-rate assumptions with qualified advisers, and do not let an advertised yield or tax benefit replace the underlying documents."
      ],
      [
        "cta",
        {
          "label": "Browse property listings",
          "page": "search"
        }
      ]
    ],
    "faqs": [
      {
        "q": "Can a Canadian own property in the Dominican Republic outright?",
        "a": "Canadians can generally acquire Dominican real estate. The title, ownership structure and any applicable parcel or use restrictions must still be verified independently."
      },
      {
        "q": "Do Canadians pay a foreign-buyer tax in the DR?",
        "a": "Ask counsel for the tax calculation applicable to the actual buyer and transaction, rather than assuming nationality alone establishes the total. Confirm the ordinary transfer charge and any specifically approved exemption."
      },
      {
        "q": "Do I have to report my DR property to the CRA?",
        "a": "Rental income and foreign-property reporting are separate. T1135 generally applies when a Canadian-resident taxpayer's aggregate cost amount of specified foreign property exceeds CAD $100,000 at any time in the year, unless a relevant exclusion applies. Primarily personal-use property can be excluded; mixed-use rentals require a facts-based assessment. A cross-border accountant should confirm your income-reporting and T1135 obligations."
      },
      {
        "q": "Will I be taxed twice on rental income?",
        "a": "The Canada–Dominican Republic tax convention, signed in 1976 and effective from 23 September 1977, provides rules addressing double taxation. Canadian residents may qualify for a foreign tax credit using Form T2209, but eligibility and the amount depend on the income, eligible taxes paid and Canadian limits. Confirm the treatment with a cross-border accountant."
      },
      {
        "q": "Is the DR good for Canadian snowbirds?",
        "a": "Compare your planned length of stay, immigration status, healthcare/insurance, seasonal budget and rental rules. The right property depends on these practical requirements; advertised tax incentives do not establish suitability."
      }
    ]
  },
  "property-taxes-ipi": {
    "catKey": "Legal",
    "catLabel": "Legal & Tax",
    "read": "11 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "Dominican Republic Property Taxes & IPI, Fully Explained (2026)",
    "lede": "Understand the 2026 general individual-owner IPI basis, its annual exemption, payment dates and a DOP-only calculation. Keep transfer tax and any specifically approved relief separate.",
    "metaTitle": "Dominican Republic Property Tax (IPI) Explained — 2026 Guide",
    "metaDescription": "A clear 2026 guide to Dominican Republic property taxes: the 1% annual IPI, the RD$10.7M exemption threshold, payment dates, CONFOTUR exemptions, and a worked example.",
    "keywords": [
      "dominican republic property tax",
      "IPI tax dominican republic",
      "dominican republic property tax exemption 2026",
      "how much is property tax in dominican republic"
    ],
    "facts": [
      [
        "1%",
        "Annual IPI rate"
      ],
      [
        "RD$10,695,494",
        "2026 individual exemption"
      ],
      [
        "Mar 11 / Sep 11",
        "Two payment dates"
      ],
      [
        "Up to 15 yrs",
        "CONFOTUR term to verify"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "The annual IPI (Impuesto al Patrimonio Inmobiliario) generally charges individuals 1% on their combined DGII-assessed taxable real estate above an annual exemption. The exemption is applied to the owner's qualifying holdings together, not separately to each home. Trusts and company-owned property follow different rules. Here is the individual-owner calculation for 2026."
      ],
      [
        "h",
        "How IPI works"
      ],
      [
        "p",
        "For individuals, IPI is assessed at 1% on the portion of their combined DGII-assessed taxable real-estate holdings above the annual exemption. Only the excess is taxed. DGII adjusts the threshold annually; it is not a separate allowance for every property."
      ],
      [
        "p",
        "For 2026, DGII publishes an exemption of RD$10,695,494 for individuals. If an owner's combined taxable holdings do not exceed that amount, no IPI is due on those holdings. A single home's value below the threshold does not by itself establish that the owner owes no IPI. The statutory figure is in Dominican pesos; confirm the applicable year and assessment with DGII."
      ],
      [
        "tip",
        "Obtain the DGII assessment and a complete list of the owner’s taxable real estate. Do not assume that the assessment is lower than the asking price, or that one apparently inexpensive property proves the owner owes no IPI."
      ],
      [
        "h",
        "A worked example"
      ],
      [
        "p",
        "This illustration uses the owner's entire taxable portfolio at DGII-assessed values, the 2026 exemption of RD$10,695,494 and no additional exemption. All amounts are in Dominican pesos; they are not purchase-price appraisals or individual tax assessments:"
      ],
      [
        "table",
        {
          "headers": [
            "Combined taxable DGII-assessed holdings (DOP)",
            "Excess over RD$10,695,494 (DOP)",
            "Annual IPI at 1% (DOP)"
          ],
          "rows": [
            [
              "RD$9,000,000",
              "RD$0",
              "RD$0"
            ],
            [
              "RD$15,000,000",
              "RD$4,304,506",
              "RD$43,045.06"
            ],
            [
              "RD$25,000,000",
              "RD$14,304,506",
              "RD$143,045.06"
            ],
            [
              "RD$45,000,000",
              "RD$34,304,506",
              "RD$343,045.06"
            ]
          ]
        }
      ],
      [
        "p",
        "These are arithmetic examples for the stated aggregate holdings. Actual IPI depends on DGII assessments, the owner's total taxable portfolio and any applicable exemptions. Do not apply the exemption separately to each home or convert it into a fixed US-dollar threshold."
      ],
      [
        "h",
        "When and how you pay"
      ],
      [
        "p",
        "IPI is paid annually, typically split into two equal installments due on or before March 11 and September 11. You can pay at the DGII or online, and late payment triggers surcharges and interest — so it is worth setting a calendar reminder or having a property manager handle it. The tax is assessed per individual owner across their total qualifying real estate, not strictly per property."
      ],
      [
        "h",
        "The one-time transfer tax (not IPI)"
      ],
      [
        "p",
        "Don't confuse the annual IPI with the one-time 3% transfer tax paid at purchase to register the title in your name. They are separate. We cover the full purchase-side breakdown — transfer tax, attorney, notary — in our [[closing costs guide|article|closing-costs-dr]]."
      ],
      [
        "h",
        "Check specifically authorized CONFOTUR relief"
      ],
      [
        "p",
        "Eligible acquisitions in an approved tourism project may receive specified relief. Obtain the project documents and the relevant tax authorization, including the exact unit, transaction and remaining period. Do not assume a resale carries the same benefits as the original acquisition or that a purchase starts a fresh 15-year term."
      ],
      [
        "h",
        "Other taxes owners should know"
      ],
      [
        "ul",
        [
          "Rental income: ask an accountant which Dominican declarations and any withholding apply to the actual owner and rental activity. Canadian residents should also examine their home-country obligations; see the [[Canadian buyer guide|article|can-canadians-buy]].",
          "A future sale: retain acquisition and improvement documents, and ask an adviser to calculate the applicable tax treatment and allowable adjustments rather than assuming all spending is deductible.",
          "Ownership structure: individuals, companies and trusts can have different rules. Compare the full legal and tax consequences before changing the ownership structure."
        ]
      ],
      [
        "h",
        "Bottom line"
      ],
      [
        "p",
        "For individuals in 2026, the general IPI calculation is 1% of combined taxable DGII-assessed holdings above RD$10,695,494, subject to applicable exemptions. Transfer tax is a separate purchase cost. Mark the March and September IPI dates, and verify any CONFOTUR approval, its tax scope and the unit's remaining exemption period before budgeting."
      ],
      [
        "cta",
        {
          "label": "Estimate your taxes and returns in the ROI calculator",
          "page": "calculator"
        }
      ]
    ],
    "faqs": [
      {
        "q": "How much is property tax in the Dominican Republic?",
        "a": "For individuals in 2026, the general IPI rate is 1% of combined DGII-assessed taxable real-estate holdings above RD$10,695,494, subject to applicable exemptions. The threshold is applied to the owner's qualifying holdings together, not once per home. Trusts and company-owned property have different rules."
      },
      {
        "q": "When is IPI due?",
        "a": "IPI is paid annually, usually in two equal installments due on or before March 11 and September 11. Late payments incur surcharges and interest."
      },
      {
        "q": "Is the transfer tax the same as IPI?",
        "a": "No. The 3% transfer tax is a one-time cost at purchase to register the title. IPI is the recurring annual 1% property tax. They are separate charges."
      },
      {
        "q": "Can I avoid property tax in the DR?",
        "a": "An individual's combined taxable holdings below the annual exemption can produce no IPI due, and other legal exemptions may apply. CONFOTUR-related relief requires verification of the specific project, unit, transaction and remaining approved period. Do not assume a separate exemption for each home or an automatic new 15-year term."
      },
      {
        "q": "Does property tax differ for company-owned property?",
        "a": "Companies and trusts may follow a different tax basis from the individual-owner IPI calculation shown here. Have an adviser compare the applicable regimes and exemptions for your actual structure."
      }
    ]
  },
  "las-terrenas": {
    "catKey": "Moving",
    "catLabel": "Neighborhood Guide",
    "read": "12 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "Living in Las Terrenas: The Expat Guide (2026)",
    "lede": "Explore Las Terrenas through the practical questions that matter for a move: daily routes, beach access, services, a personal budget and the evidence behind a property purchase.",
    "metaTitle": "Living in Las Terrenas, Dominican Republic — 2026 Expat Guide",
    "metaDescription": "A complete 2026 guide to living in Las Terrenas: the expat community, cost of living, beaches, getting there, healthcare, and the real estate market for buyers and investors.",
    "keywords": [
      "living in las terrenas",
      "las terrenas dominican republic expat",
      "las terrenas real estate",
      "moving to las terrenas samana"
    ],
    "facts": [
      [
        "Samaná",
        "Compare exact locations"
      ],
      [
        "Access",
        "Test daily routes"
      ],
      [
        "Budget",
        "Collect current quotes"
      ],
      [
        "Property",
        "Verify each listing"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "Las Terrenas is on the Samaná Peninsula and is associated with beaches including Las Ballenas, Bonita and Cosón. A visit can help you distinguish the town center, beach areas and inland locations; living needs differ from holiday preferences."
      ],
      [
        "h",
        "Who Las Terrenas is for"
      ],
      [
        "p",
        "Write a list of what you need every week: work connection, groceries, school, pharmacy, healthcare, transport and social activities. Test those needs from the exact address you are considering rather than relying on a broad expatriate-population estimate or a neighborhood label."
      ],
      [
        "tip",
        "Compare lifestyle fit and investment performance separately. A place you enjoy visiting may have rental restrictions, high operating costs or demand that does not match your model. Neither the town’s reputation nor another region’s results establish your property’s return."
      ],
      [
        "h",
        "The beaches"
      ],
      [
        "p",
        "Visit the specific beach areas and the legal access route from each shortlisted home. Conditions, noise, parking and water activities vary by location and weather; do not treat a scenic photograph as proof of safe swimming or unrestricted access."
      ],
      [
        "ul",
        [
          "Las Ballenas: inspect the precise section, route, access and day-to-day surroundings.",
          "Playa Bonita: compare the actual home-to-beach route, services and conditions during your visit.",
          "Cosón: check access, transport, utilities and the maintenance implications of the exact site."
        ]
      ],
      [
        "h",
        "Getting there and infrastructure"
      ],
      [
        "p",
        "Compare current itineraries and actual transfer quotes for El Catey (AZS) and other airports that suit your trip. Test driving times at the hours you would travel. Before working remotely or relocating, verify the specific internet connection, backup power, water supply, insurance and healthcare you need."
      ],
      [
        "h",
        "Cost of living"
      ],
      [
        "p",
        "Build the monthly budget from dated quotes rather than a claimed town-wide average. Include one-time moving costs and a contingency separately from recurring spending:"
      ],
      [
        "table",
        {
          "headers": [
            "Profile or cost",
            "Quotes to collect",
            "Practical check"
          ],
          "rows": [
            [
              "Remote worker",
              "Rent, internet, backup power, workspace",
              "Test connection and interruptions at the property"
            ],
            [
              "Couple or retirees",
              "Housing, transport, insurance, healthcare",
              "Check coverage and access for your needs"
            ],
            [
              "Family",
              "School, transport, housing, utilities",
              "Confirm admissions, fees and travel routes"
            ],
            [
              "Rental home",
              "Lease, deposit, included bills, renewal terms",
              "Check duration, season and currency"
            ]
          ]
        }
      ],
      [
        "p",
        "Compare the same inclusions and lease duration when reviewing quotes. Add transport and recurring bills before deciding that an inland or beach-area option is cheaper."
      ],
      [
        "h",
        "The real estate market"
      ],
      [
        "p",
        "Compare current property evidence: asking price and date, legal area and title, physical condition, community costs and use restrictions. Asking prices are not verified sale prices. Any CONFOTUR relief must be established for the actual unit and acquisition rather than inferred from a development’s marketing."
      ],
      [
        "p",
        "For a rental investment, request dated bookings and costs and separate owner stays from paid demand. The [[rental ROI framework|article|punta-cana-airbnb-roi]] can organize the calculation; use Las Terrenas property evidence rather than copying another market’s assumptions."
      ],
      [
        "cta",
        {
          "label": "Browse Las Terrenas listings",
          "page": "search"
        }
      ],
      [
        "h",
        "The honest trade-offs"
      ],
      [
        "ol",
        [
          "Test the services and transport you need rather than assuming a small town supplies every city convenience.",
          "Visit at different times and ask for year-round utility and rental records; do not infer every season from one trip.",
          "Compare total ownership or rental costs before assigning a premium to beach proximity.",
          "Arrange independent title, survey, physical-condition and contract review before committing."
        ]
      ],
      [
        "h",
        "Is Las Terrenas right for you?"
      ],
      [
        "p",
        "Choose from the exact addresses that meet your daily needs, not a ranking of the “best” expatriate towns. Compare Las Terrenas with other shortlisted places using the same budget, service and property checklist, and rent first if the lifestyle fit is still uncertain."
      ],
      [
        "cta",
        {
          "label": "Talk to our team",
          "page": "contact"
        }
      ]
    ],
    "faqs": [
      {
        "q": "Is Las Terrenas a good place for expats to live?",
        "a": "It depends on your daily needs and the specific location. Test transport, work connection, healthcare, schools and the community during a visit; this guide does not supply a verified expatriate population or quality ranking."
      },
      {
        "q": "How do you get to Las Terrenas?",
        "a": "Compare current flights to airports suited to your trip, including El Catey, and obtain an actual ground-transfer quote to your address. Timetables and driving times must be checked for your travel dates."
      },
      {
        "q": "How much does real estate cost in Las Terrenas?",
        "a": "Use current dated listings and independent valuation evidence for comparable properties. Check asking versus completed-sale prices, legal area, condition and all recurring costs; no unsupported entry-price range is supplied here."
      },
      {
        "q": "Is Las Terrenas good for rental investment?",
        "a": "Assess the specific property’s permitted use, documented income and costs. Separate lifestyle value from rental performance and do not assume location or a tax-incentive label guarantees a return."
      },
      {
        "q": "What is the cost of living in Las Terrenas?",
        "a": "Prepare a personal budget with dated rent, utilities, transport, food, insurance and any school or healthcare quotes. State the currency, lease duration and seasonal terms; there is no verified average budget asserted here."
      }
    ]
  },
  "best-places-to-retire": {
    "catKey": "Lifestyle",
    "catLabel": "Retirement",
    "read": "13 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "Retirement in the Dominican Republic: Compare Places and Requirements (2026)",
    "lede": "Compare potential retirement bases using your healthcare, transport, housing and budget needs. Review the published pensioner and rentista requirements separately from the property decision.",
    "metaTitle": "Retiring in the Dominican Republic: Places and Requirements (2026)",
    "metaDescription": "Compare retirement locations using your own service and housing needs. Review pensionado/rentista requirements and the conditional scope of Law 171-07 benefits.",
    "keywords": [
      "best places to retire in dominican republic",
      "retire in dominican republic",
      "dominican republic pensionado visa",
      "cost of retiring in dominican republic"
    ],
    "facts": [
      [
        "US$1,500/mo",
        "Published pension minimum"
      ],
      [
        "DGM",
        "Application review required"
      ],
      [
        "Conditional",
        "Law 171-07 benefits"
      ],
      [
        "Personal budget",
        "Collect current quotes"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "Retirement in the Dominican Republic combines a warm climate with several distinct places to live. Eligible pensioners and rentistas can apply through an income-based residence route, and Law 171-07 provides conditional tax benefits for qualifying declared pension or renta. Eligibility, renewal requirements and the scope of each benefit should be checked before relocating."
      ],
      [
        "p",
        "The places below are options to investigate, not a quality ranking or a promise that a visa will be easy. Match the exact home and daily services to your requirements, then check residence eligibility, timing and costs through the current official process."
      ],
      [
        "h",
        "Why retire in the Dominican Republic?"
      ],
      [
        "ul",
        [
          "Budget: price your own housing, food, utilities, transport, insurance and contingency; do not use an unsupported average for “most couples.”",
          "Travel: compare current flights, entry requirements and the actual ground journey to the home.",
          "Tax benefits: qualifying approved pensioners/rentistas may receive specified Law 171-07 benefits; household and vehicle imports have separate conditions, and vehicle relief is partial.",
          "Healthcare: confirm needed specialties, emergency access, prescriptions, insurer acceptance and out-of-pocket costs before selecting a location."
        ]
      ],
      [
        "h",
        "The Pensionado and Rentista visas"
      ],
      [
        "p",
        "DGM publishes separate residence services for eligible foreign-income pensioners and rentistas. A minimum income figure is only one part of the application: check the required visa, evidence, dependants, documents, fees and renewals before making a relocation commitment."
      ],
      [
        "ul",
        [
          "Pensionado residence route: DGM requires at least US$1,500 in monthly foreign pension income from a government, official body or private company, plus US$250 for each included direct dependent. Employment salary does not meet the pension-income requirement.",
          "Rentista residence route: the published minimum is US$2,000 in stable monthly qualifying renta from abroad, with supporting source/history documents. Law 171-07 also requires US$250 per included dependent. Salary is not a substitute for the qualifying renta."
        ]
      ],
      [
        "p",
        "Use the current consular and DGM checklists for your exact route, including income evidence, identity, police and medical documents and any required apostille, legalization or judicial translation. Obtain official timing information for your file; no processing or citizenship timeline is promised here. Naturalization is a separate application with its own requirements."
      ],
      [
        "tip",
        "Owning a home does not grant residence. Avoid making a nonrefundable property or moving commitment contingent on an unconfirmed immigration outcome. [[Contact our team|contact]] about property options and obtain independent immigration advice for your status."
      ],
      [
        "h",
        "Compare potential retirement bases"
      ],
      [
        "p",
        "Use the same requirements for each place. The table suggests questions to investigate; it does not certify service quality, affordability or a property’s suitability:"
      ],
      [
        "table",
        {
          "headers": [
            "Place",
            "Daily-life questions",
            "Property checks"
          ],
          "rows": [
            [
              "Las Terrenas",
              "Can you reach the services you need from the exact address?",
              "Access, utilities, maintenance and rental rules"
            ],
            [
              "Sosúa and Cabarete",
              "Do transport, activities and noise fit your routine?",
              "Legal access, condition and operating budget"
            ],
            [
              "Puerto Plata",
              "Which neighborhoods meet your transport and service needs?",
              "Title, condition, recurring fees"
            ],
            [
              "Punta Cana",
              "Which community’s actual services and rules fit you?",
              "Association fees, access and use restrictions"
            ],
            [
              "Santo Domingo",
              "Do the daily routes and urban setting work for you?",
              "Building condition, community costs and parking"
            ],
            [
              "Jarabacoa",
              "Does the location suit your travel and healthcare needs?",
              "Site access, drainage, utilities and maintenance"
            ]
          ]
        }
      ],
      [
        "h3",
        "Las Terrenas"
      ],
      [
        "p",
        "Compare the town center, beach areas and inland addresses using an actual visit. Test grocery, work-connection and healthcare requirements rather than assuming all properties share the same services; see the [[Las Terrenas guide|article|las-terrenas]]."
      ],
      [
        "h3",
        "Sosúa, Cabarete & Puerto Plata"
      ],
      [
        "p",
        "Visit properties across the north-coast corridor and compare the complete monthly budget. Test transport, activities, noise and the specific healthcare services you need. A town’s reputation for value is not a current rent quote or proof of medical suitability."
      ],
      [
        "h3",
        "Punta Cana"
      ],
      [
        "p",
        "Compare the specific communities and their actual association rules, amenity access and recurring fees. Confirm the travel route and healthcare/insurance requirements for your household; see the [[Punta Cana guide|article|living-punta-cana]]."
      ],
      [
        "h",
        "What retirement actually costs"
      ],
      [
        "p",
        "Build a household budget with dated housing, food, utility, transport, insurance and healthcare quotes. Add visa/residence costs, moving expenses, exchange-rate changes and a reserve. The income threshold for a residence category is not evidence that the same amount will cover your living costs."
      ],
      [
        "h",
        "Smart steps before you retire here"
      ],
      [
        "ol",
        [
          "Visit in both high and low season before committing — towns feel very different in July than in February.",
          "Rent before you buy. Spend a few months in your shortlisted town to confirm the fit before purchasing.",
          "Confirm healthcare providers, insurance coverage and emergency access before committing; do not rely on a general countrywide quality claim.",
          "Talk to a cross-border tax advisor so your pension and any rental income are handled correctly in both countries."
        ]
      ],
      [
        "h",
        "Bottom line"
      ],
      [
        "p",
        "A sound relocation plan connects the place, property, household budget, healthcare and official immigration process. Visit and consider renting first, document the unresolved questions, and avoid treating a tax incentive or an advertised low budget as a substitute for that work."
      ],
      [
        "cta",
        {
          "label": "Explore homes in retirement-friendly towns",
          "page": "search"
        }
      ]
    ],
    "faqs": [
      {
        "q": "What is the best place to retire in the Dominican Republic?",
        "a": "There is no universal best location. Compare exact addresses against your healthcare, transport, accessibility, social and budget requirements, using visits and current quotes rather than an unsupported ranking."
      },
      {
        "q": "How much money do I need to retire in the DR?",
        "a": "Separate the published income requirement for your residence route from your actual living budget. Obtain current housing, insurance, healthcare, food, utility and transport quotes and include reserves and immigration costs."
      },
      {
        "q": "What are the requirements for the Pensionado visa?",
        "a": "DGM publishes a minimum foreign pension of US$1,500 per month from a government, official body or private company, plus US$250 for each included direct dependent. Rentista uses a US$2,000 qualifying monthly renta minimum and additional documentation. Income alone does not establish eligibility: confirm the complete current consular and DGM requirements."
      },
      {
        "q": "Do I need residency to buy a retirement home in the DR?",
        "a": "Buying a home and obtaining immigration permission are separate. A purchase does not grant residence; confirm the status required for your intended stay before moving or committing funds on that assumption."
      },
      {
        "q": "Are there tax benefits for retirees?",
        "a": "Law 171-07 provides conditional benefits for approved pensioners and rentistas, including exemption for qualifying declared pension or renta and eligible household imports. Vehicle-import relief is partial and follows separate customs rules. This is not an exemption for all foreign income or every import; verify each benefit and approval with the relevant authority."
      }
    ]
  },
  "dr-real-estate-safe": {
    "catKey": "Buying",
    "catLabel": "Safety & Trust",
    "read": "12 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "Is Dominican Republic Real Estate Safe? Scams to Avoid (2026)",
    "lede": "Assess legal, physical, financial and personal-safety risks separately. This guide organizes the documents, payment controls and independent checks to resolve before committing to a property.",
    "metaTitle": "Is Dominican Republic Real Estate Safe? Scams & How to Avoid Them",
    "metaDescription": "A practical Dominican property due-diligence guide: verify registered rights, seller authority, surveys, contract terms, payment controls and building condition.",
    "keywords": [
      "is dominican republic real estate safe",
      "dominican republic real estate scams",
      "dominican republic property fraud",
      "buying property dominican republic safely"
    ],
    "facts": [
      [
        "Title",
        "Obtain current registry evidence"
      ],
      [
        "Seller",
        "Check identity and authority"
      ],
      [
        "Funds",
        "Agree custody and release"
      ],
      [
        "Scope",
        "Independent legal and physical checks"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "No property transaction is risk-free. National treatment for foreign investors does not guarantee a clean title, a safe building, a reliable seller or an appropriate investment. Assess the exact transaction before deciding what risks you can accept."
      ],
      [
        "p",
        "Use the evidence checklist below to investigate warning signs, record unresolved issues and agree payment conditions. It is an organizing guide, not a legal opinion or certification of a listed property."
      ],
      [
        "h",
        "Check legal and physical risks separately"
      ],
      [
        "p",
        "Engage independent counsel with a written scope and check their professional standing and conflicts. Agree who examines registry records, seller authority, taxes, contracts and custody of funds, and arrange separate technical inspections. Do not assume an insurer or escrow provider is automatically assigned, or claim that no such services exist."
      ],
      [
        "tip",
        "Check the identity, professional status and authority of every adviser and intermediary under current applicable requirements. Ask what a platform or agent actually verified, when, and with which limitations; a badge or business title does not replace independent evidence."
      ],
      [
        "h",
        "Warning patterns to investigate"
      ],
      [
        "p",
        "The following patterns warrant questions and independent review. They are examples of risks, not a measured ranking of Dominican fraud cases:"
      ],
      [
        "ul",
        [
          "Reservation-deposit traps: you are pressured to pay a deposit to \"hold\" a unit before anyone has verified it is real, unencumbered, and actually owned by the seller. Once the money is gone, so is the leverage.",
          "Title or ownership misrepresentation: the person selling is not the true registered owner, or cannot legally transfer clean title. This is where forged or outdated title certificates show up.",
          "Hidden encumbrances: liens, an existing mortgage, unpaid property taxes, or boundary disputes that only surface after you have paid.",
          "Boundary and survey gaps: buying land or a lot without a registered survey (deslinde), then discovering it is smaller — or located differently — than advertised."
        ]
      ],
      [
        "p",
        "Complete the appropriate checks before releasing funds, and document any conditions that remain unresolved. Verification can reduce specific risks but does not make every financial, construction or personal-safety risk disappear."
      ],
      [
        "h",
        "How to protect yourself — the non-negotiables"
      ],
      [
        "ol",
        [
          "Hire independent Dominican counsel, verify professional standing and conflicts, and agree the written scope.",
          "Obtain current registry evidence, including the Certificación del Estado Jurídico del Inmueble. It describes registered rights, charges and encumbrances; separately verify identity, representation, consent and any other authority needed to sell.",
          "Have an appropriate professional compare the cadastral records and survey with the physical site, legal access and any unresolved boundary issues.",
          "Agree a documented custody arrangement: who holds funds, applicable regulation, release instructions, refund conditions and dispute handling. Independently verify payment details.",
          "Make deposit and closing conditions reflect the unresolved title, survey, finance and inspection issues; do not assume a deposit is refundable unless the terms establish it.",
          "For off-plan, vet the developer’s title, permits, and delivery track record before paying anything."
        ]
      ],
      [
        "h",
        "Red flags to walk away from"
      ],
      [
        "ul",
        [
          "Pressure to pay a deposit quickly \"before someone else takes it.\"",
          "A seller or agent who resists you bringing your own attorney.",
          "Title documents provided only as copies, or that cannot be confirmed at the registry.",
          "A price well below market with a vague explanation — too-good-to-be-true usually is.",
          "Unclear custody, release or refund terms, or resistance to documenting the agreement in a language you understand."
        ]
      ],
      [
        "h",
        "Questions to ask before relying on a listing"
      ],
      [
        "p",
        "Ask for the available title, survey, permits, cost records and condition reports, and identify which still need independent confirmation. A listing approval is not a legal title opinion or building inspection. Use the [[buying-process guide|article|can-americans-buy]] and [[closing-cost guide|article|closing-costs-dr]] to organize the remaining steps."
      ],
      [
        "h",
        "Bottom line"
      ],
      [
        "p",
        "Proceed only when you understand the evidence, unresolved issues, cost exposure and contractual remedies. Independent legal and technical review and controlled payments support an informed decision; they do not guarantee safety or investment performance."
      ],
      [
        "cta",
        {
          "label": "Browse property listings",
          "page": "search"
        }
      ]
    ],
    "faqs": [
      {
        "q": "Is it safe to buy property in the Dominican Republic as a foreigner?",
        "a": "Assess the specific property and transaction. Foreign-investment protections do not remove title, construction, financial or personal-safety risks; obtain independent evidence and agree payment conditions before committing."
      },
      {
        "q": "What are the most common real estate scams in the DR?",
        "a": "Examples to investigate include pressured deposits, unclear seller authority, outdated or inconsistent title records, hidden charges and survey discrepancies. The guide does not claim a statistical ranking or that these are the only risks."
      },
      {
        "q": "How do I verify a property title in the DR?",
        "a": "Ask independent counsel to obtain current registry evidence and review the registered rights and charges. Check seller identity, representation and other authority separately, and compare cadastral information with an appropriate site/survey review."
      },
      {
        "q": "Should I use an escrow service?",
        "a": "Discuss suitable custody and release arrangements with independent counsel. Verify the provider and account details, written conditions, refund rules and dispute process; do not assume the word escrow itself guarantees protection."
      },
      {
        "q": "Are real estate agents regulated in the Dominican Republic?",
        "a": "Verify current applicable requirements and the intermediary’s actual identity, authority and professional standing. Do not rely on an unsupported blanket statement that every agent is unregulated or automatically vetted."
      }
    ]
  },
  "living-punta-cana": {
    "catKey": "Moving",
    "catLabel": "Neighborhood Guide",
    "read": "13 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "Living in Punta Cana: The Complete Expat Guide (2026)",
    "lede": "Compare the communities in the Bávaro–Punta Cana area using actual daily routes, services, association rules and a property-specific budget. Separate a holiday experience from the requirements of living or investing there.",
    "metaTitle": "Living in Punta Cana, Dominican Republic — 2026 Expat Guide",
    "metaDescription": "Compare Punta Cana addresses, services, transport, household costs and property documents using a practical relocation and investment checklist.",
    "keywords": [
      "living in punta cana",
      "punta cana expat guide",
      "best neighborhoods punta cana",
      "moving to punta cana dominican republic"
    ],
    "facts": [
      [
        "PUJ",
        "Check current flights"
      ],
      [
        "Community",
        "Read actual rules and fees"
      ],
      [
        "Budget",
        "Use dated quotes"
      ],
      [
        "Rentals",
        "Verify permitted use"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "The Bávaro–Punta Cana area contains different residential and tourism communities. Compare exact addresses, legal access, association rules and the services your household needs. Do not assume that a resort-area listing includes every amenity, airport transfer or healthcare service shown in promotional material."
      ],
      [
        "h",
        "Who Punta Cana is for"
      ],
      [
        "p",
        "Start with your purpose: year-round residence, seasonal use or rental investment. For a home, test daily journeys and services. For an investment, check lawful rental use, documented demand and costs. Neither convenience nor a managed entrance establishes financial performance or personal safety."
      ],
      [
        "h",
        "Communities to compare"
      ],
      [
        "p",
        "Use the names below as search areas, then verify the particular address and what its fees actually include:"
      ],
      [
        "ul",
        [
          "Cap Cana: confirm the unit’s association fees, access rights, rental restrictions and amenity charges.",
          "Puntacana Village: test the address-to-work, school, shopping and airport routes.",
          "Cocotal: review the particular community rules, maintenance and any golf or amenity access.",
          "Los Corales and El Cortecito: inspect the actual beach-access route, parking, noise and rental permissions.",
          "White Sands and Arena Gorda: confirm the specific development, entry arrangements and service obligations.",
          "Uvero Alto: test transport, utilities, services and the impact of nearby construction."
        ]
      ],
      [
        "h",
        "Cost of living"
      ],
      [
        "p",
        "Collect dated quotes and compare the same inclusions and lease terms. Use a personal spending plan rather than a claimed citywide comfortable budget:"
      ],
      [
        "table",
        {
          "headers": [
            "Household or cost",
            "Information to price",
            "What to confirm"
          ],
          "rows": [
            [
              "Single resident",
              "Rent, utilities, internet, food, transport",
              "Which bills are included and in what currency"
            ],
            [
              "Resident with amenities",
              "Association charges, parking, recreation",
              "Actual access rights and extra charges"
            ],
            [
              "Couple or retirees",
              "Housing, transport, insurance, healthcare",
              "Coverage, access and contingency"
            ],
            [
              "Rental contract",
              "Term, deposit, renewal and maintenance",
              "Seasonality, included services and restrictions"
            ]
          ]
        }
      ],
      [
        "p",
        "Compare the full monthly total, travel requirements and contingency before deciding which community fits your budget. A more expensive rent may include costs another quote excludes, so compare the line items."
      ],
      [
        "h",
        "Getting around, healthcare and amenities"
      ],
      [
        "p",
        "Check current services at Punta Cana International Airport (PUJ) and quote the ground trip to your exact address. Confirm healthcare specialties, insurance acceptance, schools, internet and backup utilities directly with the relevant providers. Test whether the journeys work with your actual schedule."
      ],
      [
        "h",
        "Safety"
      ],
      [
        "p",
        "Assess personal safety at the address and along daily routes, including emergency access, lighting and the services actually contracted by a community. Controlled entry is one feature to examine, not a guarantee against crime, accidents or other risks."
      ],
      [
        "h",
        "Real estate and investment"
      ],
      [
        "p",
        "Request current listing documents, costs and rental records before comparing investments. Any tax relief requires the relevant unit/transaction approval. Use the [[rental ROI guide|article|punta-cana-airbnb-roi]] for a transparent scenario model and the [[closing-cost guide|article|closing-costs-dr]] for an acquisition budget; neither supplies a guaranteed market return."
      ],
      [
        "cta",
        {
          "label": "Browse Punta Cana listings",
          "page": "search"
        }
      ],
      [
        "h",
        "The honest trade-offs"
      ],
      [
        "ol",
        [
          "Visit the exact property and community rather than choosing only from promotional photographs.",
          "Test how you will travel; an area label does not establish walkability or a usable transport option.",
          "Read all recurring fees and actual amenity rights before comparing prices.",
          "Compare different dates and full-year records when considering seasonal use or rentals."
        ]
      ],
      [
        "h",
        "Is Punta Cana right for you?"
      ],
      [
        "p",
        "Choose the location that meets your documented priorities at a sustainable total cost. Compare exact addresses in the region with options in [[Las Terrenas|article|las-terrenas]], using the same evidence checklist rather than an unsupported convenience or investment ranking."
      ],
      [
        "cta",
        {
          "label": "Talk to our team",
          "page": "contact"
        }
      ]
    ],
    "faqs": [
      {
        "q": "Is Punta Cana a good place to live as an expat?",
        "a": "It depends on the exact home, your daily needs and the community’s actual services and rules. Test transport, healthcare, schools, work connection and total costs during a visit."
      },
      {
        "q": "What are the best neighborhoods in Punta Cana for expats?",
        "a": "Compare the specific communities and addresses in areas such as Cap Cana, Puntacana Village, Cocotal, Los Corales, El Cortecito, White Sands, Arena Gorda and Uvero Alto. This is a search checklist, not a ranking of safety or returns."
      },
      {
        "q": "How much does it cost to live in Punta Cana?",
        "a": "Use dated quotes for rent, utilities, transport, food, insurance and your chosen services, with a contingency. Compare identical lease terms and inclusions; no current average household budget is asserted here."
      },
      {
        "q": "Is Punta Cana safe?",
        "a": "Assess the address, daily routes, emergency access and the actual security arrangements. A community name or controlled gate does not guarantee safety."
      },
      {
        "q": "Is Punta Cana good for real estate investment?",
        "a": "Assess the particular property’s lawful use, documented income, condition and all costs. Use base and downside scenarios and verify any approved relief; no strongest-market or guaranteed-demand claim is made here."
      }
    ]
  },
  "confotur-explained": {
    "catKey": "Legal",
    "catLabel": "Tax Incentive",
    "read": "11 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "CONFOTUR Explained: Project-Specific Tax Incentives in the DR (2026)",
    "lede": "Understand what project classification does and does not establish. Check the unit, acquisition, tax authorization and remaining approved period before including any benefit in a purchase budget.",
    "metaTitle": "CONFOTUR Law Explained (2026) — Tax Relief and Project Verification",
    "metaDescription": "How the Dominican Republic's CONFOTUR framework can affect transfer and property taxes, why approval is unit-specific, how remaining terms work and what to verify before buying.",
    "keywords": [
      "confotur",
      "confotur law dominican republic",
      "confotur tax exemption",
      "dominican republic tax free property"
    ],
    "facts": [
      [
        "Law 158-01",
        "Tourism-incentive framework"
      ],
      [
        "Unit-specific",
        "Verify transfer-tax relief"
      ],
      [
        "Project term",
        "Verify remaining period"
      ],
      [
        "Approval",
        "Documentary confirmation"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "CONFOTUR administers a tourism-incentive framework, but a sales label is not a tax authorization. Use the actual project resolution and transaction documents to establish whether a particular acquisition receives a particular benefit. Do not treat the framework as a blanket promise of tax-free ownership."
      ],
      [
        "h",
        "What is CONFOTUR?"
      ],
      [
        "p",
        "CONFOTUR administers the tourism-incentive framework under Law 158-01 and its amendments. Approved projects may receive specified tax benefits, and some benefits may apply to qualifying unit acquisitions. Project classification alone is not a substitute for verifying the buyer, transaction, unit, required tax authorization and applicable period."
      ],
      [
        "h",
        "What CONFOTUR waives for a buyer"
      ],
      [
        "ul",
        [
          "Transfer tax: qualifying acquisitions can obtain relief from the normal 3% tax through the applicable authorization process. Verify the specific transaction with the Ministry of Finance and DGII; a CONFOTUR label in a brochure is not sufficient.",
          "Annual IPI: eligible property in an approved project may receive relief during the applicable approved period. Article 7, as amended by Law 195-13, sets a 15-year project exemption period from completion of construction and equipment; a later purchase does not automatically start a fresh 15 years.",
          "Rental income tax: do not assume that a unit's transfer-tax or IPI relief also exempts the owner's rental income. Request a separate determination of any ISR benefit and its conditions for the taxpayer, activity and property."
        ]
      ],
      [
        "p",
        "If relief is specifically authorized, include only the covered tax and period in the model. Keep a comparison without unconfirmed relief so that a delayed or unsuccessful application does not leave the purchase dependent on an assumed saving."
      ],
      [
        "h",
        "How much does it actually save you?"
      ],
      [
        "p",
        "For an arithmetic example only, assume an individual’s sole taxable property and the accepted transfer basis are both RD$15,000,000, with no other exemption. The relief column assumes written approvals covering that same unit and acquisition; n is the number of remaining IPI periods actually confirmed, not a new 15-year grant:"
      ],
      [
        "table",
        {
          "headers": [
            "Cost or term (DOP)",
            "Hypothetical standard calculation",
            "Only if specifically authorized"
          ],
          "rows": [
            [
              "Transfer tax at assumed 3% basis",
              "RD$450,000",
              "Relief subject to transaction approval"
            ],
            [
              "Annual IPI at 2026 aggregate basis",
              "RD$43,045.06",
              "Relief only for approved remaining periods"
            ],
            [
              "Remaining approved IPI periods",
              "Not applicable",
              "Verify n for the specific unit"
            ],
            [
              "Hypothetical reduction if both benefits apply",
              "—",
              "RD$450,000 + RD$43,045.06 × n"
            ]
          ]
        }
      ],
      [
        "p",
        "This is an arithmetic illustration in Dominican pesos, not a forecast or tax quote. It holds the 2026 threshold and assumed assessments constant solely to explain the formula; actual future thresholds, ownership, assessments and approved periods may change. See the [[closing costs guide|article|closing-costs-dr]] and [[IPI explainer|article|property-taxes-ipi]] for the separate taxes and the aggregate-owner basis."
      ],
      [
        "h",
        "Who qualifies?"
      ],
      [
        "ul",
        [
          "Check the applicant and acquisition requirements rather than inferring eligibility from nationality or residence alone.",
          "Obtain the definitive classification resolution and confirm that the specific unit and approved activity are covered.",
          "Confirm the treatment of the exact transaction, particularly resale or land/build arrangements; a tourism-zone location or future construction promise is not sufficient."
        ]
      ],
      [
        "tip",
        "Ask both questions: does the project have the relevant classification, and does this buyer’s specific acquisition qualify for the benefit requested? Have the documentary answer checked independently before committing funds or removing taxes from the budget."
      ],
      [
        "h",
        "How to verify a project really has CONFOTUR"
      ],
      [
        "ol",
        [
          "Request the official CONFOTUR approval resolution (with its number and date) from the developer.",
          "Have your independent attorney confirm the approval is genuine, current, and covers the specific unit you are buying.",
          "Verify the exact taxes, approvals and remaining period; rental-income tax must be assessed separately from a unit’s transfer-tax or IPI relief.",
          "Get the exemption reflected in writing in your Promise of Sale, so it is part of the deal you actually sign."
        ]
      ],
      [
        "h",
        "The caveats"
      ],
      [
        "p",
        "CONFOTUR relief is not automatic or an exemption from every tax. Verify the project's classification, the specific unit and transaction, the required tax approvals and the remaining period. The statutory project term is measured from construction and equipment completion under the amended Article 7, not simply from the buyer's closing date. Rental-income ISR treatment requires its own analysis."
      ],
      [
        "h",
        "Bottom line"
      ],
      [
        "p",
        "Verify the specific acquisition before assigning any savings. Preserve the classification resolution, tax approval, unit identification and term evidence with the closing records. The [[rental ROI guide|article|punta-cana-airbnb-roi]] can compare chosen scenarios, but a tax benefit does not prove rental performance."
      ],
      [
        "cta",
        {
          "label": "Estimate your savings in the ROI calculator",
          "page": "calculator"
        }
      ]
    ],
    "faqs": [
      {
        "q": "What is the CONFOTUR law?",
        "a": "CONFOTUR administers the tourism-incentive framework under Law 158-01 and its amendments. Specific project and unit transactions may qualify for transfer-tax or IPI relief through the applicable approvals. Verify the exact tax scope and remaining period; a later buyer does not automatically receive a fresh 15-year exemption."
      },
      {
        "q": "How much can CONFOTUR save me?",
        "a": "Calculate each tax on its actual taxable basis, then apply only the benefits and remaining periods confirmed for the unit. In the hypothetical RD$15,000,000 example, the assumed transfer tax is RD$450,000 and 2026 aggregate-owner IPI is RD$43,045.06 for one year. Those figures are not a quote, forecast or evidence that a particular purchase is exempt."
      },
      {
        "q": "Do foreigners qualify for CONFOTUR?",
        "a": "Nationality alone does not establish approval. Confirm the applicant, project, unit and acquisition requirements and obtain the relevant tax authorization; do not assume residence status alone determines eligibility."
      },
      {
        "q": "Does buying land qualify for CONFOTUR?",
        "a": "A location in a tourism zone or a land-and-build sales package does not itself prove tax relief. Have the project resolution and exact acquisition checked, including the approved activity, unit and required authorization."
      },
      {
        "q": "How do I confirm a project has CONFOTUR?",
        "a": "Ask the developer for the official CONFOTUR approval resolution and have your independent attorney verify it is genuine, current, and covers your specific unit — then get it written into your Promise of Sale."
      }
    ]
  },
  "dr-vs-miami": {
    "catKey": "Investing",
    "catLabel": "Investment Intelligence",
    "read": "12 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "Dominican Republic vs Miami: The 2026 Investor Case",
    "lede": "Compare actual properties in two jurisdictions using the same price basis, rental period, expense definitions and risk questions. Separate local tax rules from hypothetical arithmetic and unsupported market averages.",
    "metaTitle": "Dominican Republic vs Miami Real Estate — 2026 Investor Comparison",
    "metaDescription": "A property-specific Dominican Republic–Miami investment comparison: comparable costs, rental evidence, taxes, financing, currency exposure and downside scenarios.",
    "keywords": [
      "dominican republic vs miami real estate",
      "dominican republic real estate investment",
      "invest dominican republic or miami",
      "caribbean real estate investment 2026"
    ],
    "facts": [
      [
        "Compare",
        "Like-for-like properties"
      ],
      [
        "Income",
        "Use dated rental evidence"
      ],
      [
        "Tax",
        "Assess both jurisdictions"
      ],
      [
        "Risk",
        "Test downside cash flow"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "An international property comparison should start with specific assets and your objectives, not a countrywide yield or price ranking. Align the type, condition, tenure, location and permitted rental use, then compare all-in costs and a common reporting period."
      ],
      [
        "h",
        "Entry cost: compare the whole acquisition"
      ],
      [
        "p",
        "Use dated comparable evidence and distinguish asking prices from completed transactions. Convert square meters and square feet consistently and identify whether the area is internal, built, gross or land area. Add closing, repairs, furnishings, finance and currency-conversion costs before deciding which investment has a lower basis."
      ],
      [
        "h",
        "A like-for-like comparison sheet"
      ],
      [
        "table",
        {
          "headers": [
            "Factor",
            "Dominican property evidence",
            "Miami property evidence"
          ],
          "rows": [
            [
              "Acquisition basis",
              "Price, closing, setup and repair quotes",
              "Price, closing, setup and repair quotes"
            ],
            [
              "Area and condition",
              "Legal area, survey and inspection",
              "Comparable area definition and inspection"
            ],
            [
              "Gross rental income",
              "Actual paid stays and refunds for a stated period",
              "Actual paid stays and refunds for the same period"
            ],
            [
              "Net cash flow",
              "Itemized operating costs, financing and tax",
              "The same cost categories and denominator"
            ],
            [
              "Property tax",
              "Actual owner/structure assessment and exemptions",
              "Actual parcel assessment, levies and exemptions"
            ],
            [
              "Incentives and restrictions",
              "Unit/transaction-specific written approvals",
              "Applicable documented local rules and approvals"
            ]
          ]
        }
      ],
      [
        "p",
        "Leave unknown values visible. A comparison with missing costs is not improved by inserting an unsupported regional average. State whether each number is a completed transaction, a quote, a projection or an illustrative input."
      ],
      [
        "h",
        "Returns and taxes: keep the basis consistent"
      ],
      [
        "p",
        "Use the same cost categories, period and return denominator in both models. For arithmetic only, an assumed 2.45% annual rate on US$485,000 is US$11,882.50; neither assumption is a current Miami tax quote. Obtain the actual parcel calculation. For the Dominican model, obtain the owner/structure-specific assessment and verify any [[CONFOTUR|article|confotur-explained]] approval rather than assuming every purchase is exempt."
      ],
      [
        "h",
        "Questions to resolve for a Miami property"
      ],
      [
        "p",
        "Assess the particular building, parcel and transaction with appropriate local advisers:"
      ],
      [
        "ul",
        [
          "Exit evidence: compare dated completed sales, marketing time and selling costs rather than assuming liquidity.",
          "Legal and building review: verify title/custody arrangements, rental restrictions, association records and technical condition.",
          "Financing: obtain written eligibility, rate, insurance and repayment terms for your borrower profile.",
          "Currency and tax: compare your funding currency, residence, reporting and cross-border obligations."
        ]
      ],
      [
        "h",
        "Questions to resolve for a Dominican property"
      ],
      [
        "ul",
        [
          "Confirm title, survey, lawful access, permitted use and the seller’s authority.",
          "Obtain actual operating records and quotes; do not substitute a regional yield claim.",
          "Verify the actual tax assessment and any transaction-specific relief and remaining term.",
          "Test financing, currency movements, maintenance and an exit without assumed appreciation."
        ]
      ],
      [
        "h",
        "The honest trade-off"
      ],
      [
        "p",
        "Each property has its own liquidity, legal, construction, operating and currency risks. Compare them explicitly rather than calling one country inherently safer or higher-yielding. Use the [[property due-diligence guide|article|dr-real-estate-safe]] to organize the Dominican-side questions."
      ],
      [
        "h",
        "Which should you choose?"
      ],
      [
        "p",
        "Choose based on the evidence for the assets you can actually buy and manage. Compare base and downside cash flow, funding requirements and an exit plan with qualified advisers. If key information is missing, resolving it is more useful than assigning a winner to the two markets."
      ],
      [
        "cta",
        {
          "label": "Model a DR deal in the ROI calculator",
          "page": "calculator"
        }
      ]
    ],
    "faqs": [
      {
        "q": "Is the Dominican Republic a better investment than Miami?",
        "a": "There is no universal winner established here. Compare specific properties using consistent acquisition, income, expense, tax, financing and exit assumptions that fit your objectives."
      },
      {
        "q": "How do rental yields compare?",
        "a": "Use dated property-level records and the same period and net-return definition. Keep gross revenue, operating profit, financing, tax and appreciation separate; no current regional yield average is supplied here."
      },
      {
        "q": "How much cheaper is DR property than Miami?",
        "a": "A countrywide discount is not established. Compare like-for-like assets using dated sale evidence, consistent area definitions and total acquisition costs. Asking prices alone do not prove the discount."
      },
      {
        "q": "What about property taxes?",
        "a": "Obtain an actual assessment for each property and owner structure. The example 2.45% × US$485,000 = US$11,882.50 is arithmetic with chosen assumptions, not a verified Miami rate or tax quote. Confirm the applicable Dominican basis and any approved relief separately."
      },
      {
        "q": "What is the catch with the DR?",
        "a": "Identify the actual property’s legal, physical, operating, currency and exit risks. Do not assume title/custody services, rental permissions, financing or future appreciation; investigate the evidence and contractual protections."
      }
    ]
  },
  "living-cabarete-sosua": {
    "catKey": "Moving",
    "catLabel": "Neighborhood Guide",
    "read": "12 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Real estate guides",
    "initials": "DR",
    "title": "Living in Cabarete & Sosúa: North Coast Expat Guide (2026)",
    "lede": "Compare Cabarete and Sosúa through daily-life and property questions: beach access, water-sport interests, transport, services, actual costs and the evidence needed before renting or buying.",
    "metaTitle": "Living in Cabarete & Sosúa — North Coast DR Expat Guide (2026)",
    "metaDescription": "A 2026 guide to living in Cabarete and Sosúa on the DR north coast: expat community, cost of living, kitesurfing, getting there, and the real estate and investment market.",
    "keywords": [
      "living in cabarete",
      "living in sosua",
      "cabarete sosua expat",
      "north coast dominican republic real estate"
    ],
    "facts": [
      [
        "Cabarete",
        "Water-sport interests"
      ],
      [
        "Sosúa",
        "Bay and town locations"
      ],
      [
        "Transport",
        "Test the actual route"
      ],
      [
        "Budget",
        "Compare current quotes"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "Cabarete and Sosúa are North Coast destinations in Puerto Plata province with different beach and town settings. Compare exact addresses rather than broad claims that one offers the country’s best value. Your daily routine, access needs and property evidence should guide the choice."
      ],
      [
        "h",
        "Cabarete: investigate the water-sport setting"
      ],
      [
        "p",
        "Cabarete is associated with surfing, windsurfing and kitesurfing. If those activities matter to you, speak with suitable local instructors, check current conditions and visit the actual access route and storage facilities. Do not infer safe or suitable conditions every day from an area’s reputation, and check event dates with the organizer."
      ],
      [
        "h",
        "Sosúa: compare town and bay locations"
      ],
      [
        "p",
        "Compare the specific routes from a Sosúa address to shopping, the beach and services you need. Inspect noise, parking, accessibility, water and power arrangements. A general description as family-friendly, established or inexpensive is not a substitute for checking your own requirements."
      ],
      [
        "tip",
        "Stay near the addresses you are considering and test journeys at your normal hours. Compare the cost and practicality of transport between activities and home rather than relying on a fixed ten-minute drive claim."
      ],
      [
        "h",
        "Getting there and infrastructure"
      ],
      [
        "p",
        "Compare current itineraries through Gregorio Luperón (POP), Santiago (STI) or another airport that fits your trip and obtain an address-specific ground-transfer quote. Confirm the actual internet, backup utilities, school options and healthcare/insurance requirements with the providers concerned."
      ],
      [
        "h",
        "Cost of living"
      ],
      [
        "p",
        "Collect current quotes for your household and compare like-for-like lease terms. Separate recurring costs, deposits, moving costs and a contingency:"
      ],
      [
        "table",
        {
          "headers": [
            "Profile or cost",
            "Budget evidence",
            "What to test"
          ],
          "rows": [
            [
              "Single or remote worker",
              "Rent, internet, backup power, food, transport",
              "Actual work connection and daily routes"
            ],
            [
              "Couple or retirees",
              "Housing, transport, insurance, healthcare",
              "Coverage and services needed by the household"
            ],
            [
              "Condo rental",
              "Written lease, deposit, fees and included bills",
              "Duration, season, currency and use restrictions"
            ]
          ]
        }
      ],
      [
        "h",
        "The real estate market"
      ],
      [
        "p",
        "Compare current asking prices with dated comparable evidence, legal area, condition and total costs. Community names do not establish security, amenity access or investment value. Verify the exact unit and any approval before including tax relief; see the [[CONFOTUR guide|article|confotur-explained]]."
      ],
      [
        "p",
        "For a rental investment, request full-year paid booking records and itemized costs. Keep long-term and short-term models separate and do not assume future appreciation. The [[rental ROI framework|article|punta-cana-airbnb-roi]] can organize property-specific scenarios without importing another region’s claimed averages."
      ],
      [
        "cta",
        {
          "label": "Browse north-coast listings",
          "page": "search"
        }
      ],
      [
        "h",
        "The honest trade-offs"
      ],
      [
        "ol",
        [
          "Test the exact home and surroundings at different times, including noise and access.",
          "Visit the actual route to work, shopping and activities rather than judging the town center alone.",
          "Compare transport availability and costs for your routine before deciding whether you need a car.",
          "Obtain independent legal and technical review; see the [[due-diligence guide|article|dr-real-estate-safe]]."
        ]
      ],
      [
        "h",
        "Is the north coast right for you?"
      ],
      [
        "p",
        "Choose the address that meets your daily needs and documented budget. If you are comparing regions, apply the same criteria to [[Punta Cana|article|living-punta-cana]] and [[Las Terrenas|article|las-terrenas]], rather than relying on an unsupported best-value or amenity ranking."
      ],
      [
        "cta",
        {
          "label": "Talk to our team",
          "page": "contact"
        }
      ]
    ],
    "faqs": [
      {
        "q": "Is Cabarete or Sosúa better for expats?",
        "a": "Compare specific addresses against your activities, transport, work, healthcare and budget requirements. Visit both and test the practical routine rather than assuming one town is inherently better for a demographic group."
      },
      {
        "q": "How much does it cost to live on the DR north coast?",
        "a": "Use dated housing, utility, transport, food, insurance and service quotes for your own household. State lease duration, inclusions and currency and keep deposits and moving costs separate."
      },
      {
        "q": "How do you get to Cabarete and Sosúa?",
        "a": "Check current flights and obtain actual ground-transfer quotes from suitable airports, including POP or STI where appropriate. Fixed drive times and seasonal routes should not be assumed."
      },
      {
        "q": "How much does real estate cost in Cabarete and Sosúa?",
        "a": "Compare dated asking and completed-sale evidence for genuinely comparable properties. Include legal area, condition, recurring costs and restrictions; this guide does not supply a verified current price range."
      },
      {
        "q": "Is the north coast good for kitesurfing?",
        "a": "Cabarete is known for water sports, but suitability depends on the beach, conditions and your ability. Consult appropriate instructors, current forecasts and local safety guidance; neither daily wind nor a particular event date is guaranteed here."
      }
    ]
  }
}
