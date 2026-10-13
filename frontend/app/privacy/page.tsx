import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Shield,
  Lock,
  Eye,
  Server,
  Cookie,
  UserCheck,
  HelpCircle,
  PhoneCall,
  Cpu,
  MapPin,
  Landmark,
  PhoneForwarded,
  UserX,
  Globe,
  ExternalLink,
  Share2
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | RealtyAsk',
  description: 'Privacy policy, data protection governance, DPDP Act 2023 compliance, TRAI communication consents, and cookie disclosures for RealtyAsk users.',
}

export default function PrivacyPolicy() {
  const lastUpdated = 'October 11, 2026'

  const sections = [
    {
      id: 'collection',
      icon: Eye,
      title: '1. Information We Collect',
      content: (
        <div className="space-y-3">
          <p>
            RealtyAsk gathers only the data necessary to deliver personalized property intelligence, conversational assistance, and developer connections under the Digital Personal Data Protection Act, 2023 (DPDP Act):
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Direct Interaction &amp; Conversational Data:</strong> Search parameters, shortlisted sectors, BHK configurations, budget constraints, and prompt inputs submitted to our AI advisory engine.
            </li>
            <li>
              <strong>Lead &amp; Site Visit Data:</strong> Full name, mobile number, and email address provided voluntarily when scheduling site inspections, requesting brochures, or asking for developer callbacks.
            </li>
            <li>
              <strong>Technical &amp; Geolocation Data:</strong> IP address, device fingerprints, approximate geolocation (used strictly to recommend nearby NCR micro-markets such as Sector 150, Noida Expressway, Yamuna Expressway, or Greater Noida West), and anonymous session tokens via first-party analytics (PostHog).
            </li>
            <li>
              <strong>Shared-Link Data:</strong> If you arrive on RealtyAsk through a link someone shared with you, we record which link, your device type (phone, tablet, or desktop), a best-effort guess at which app you opened it from (for example Instagram or WhatsApp's in-app browser), and the time. We also give your device its own shareable link so we can see if you pass RealtyAsk on. We do not ask for, or collect, your name through this process.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'lead-sharing-trai',
      icon: PhoneCall,
      title: '2. Lead Consent, Developer Sharing & TRAI / DND Waiver',
      badge: 'TRAI & DPDP Compliant',
      content: (
        <div className="space-y-3">
          <p>
            When you submit a request for a property callback, site visit, or brochure on RealtyAsk:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Authorized Third-Party Sharing:</strong> You explicitly authorize RealtyAsk to transmit your contact information (name, phone number, email, and property interest) to the concerned UP-RERA registered developer or their authorized UP-RERA registered Channel Partner (Real Estate Agent) to service your inquiry.
            </li>
            <li>
              <strong>Overriding National DND / TRAI Preference:</strong> In accordance with the Telecom Commercial Communications Customer Preference Regulations, 2018 (TRAI TCCR), you agree that this inquiry grants express authorization for developers and channel partners to contact you via Voice Calls, SMS, WhatsApp, and Email, notwithstanding your registration on the National Do Not Call (NDNC / DND) Registry.
            </li>
            <li>
              <strong>Zero Telemarketing Resale:</strong> We enforce strict partner agreements. Your contact details are shared solely with the specific developer/partner relevant to your requested project and are never sold, rented, or distributed to third-party telemarketing agencies.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'banking-loan-sharing',
      icon: Landmark,
      title: '3. Home Loan & Banking Partner Lead Sharing',
      badge: 'Financial Partners',
      content: (
        <div className="space-y-3">
          <p>
            When you opt for home loan eligibility assistance, builder Approved Project Financials (APF) validation, or custom EMI calculations on RealtyAsk:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Financial Data Transmission:</strong> You explicitly authorize RealtyAsk to securely transmit your voluntarily submitted financial indicators (estimated budget, income range, employment type, loan requirement, and contact details) to scheduled partner commercial banks and NBFCs (e.g., HDFC Bank, State Bank of India, ICICI Bank, Axis Bank) or their officially registered Direct Selling Agents (DSAs).
            </li>
            <li>
              <strong>Single-Purpose Processing:</strong> Transmitted financial data is used exclusively to evaluate home loan pre-approvals, check project APF tie-ups, and offer sanctioned interest rates.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'telephony-recording',
      icon: PhoneForwarded,
      title: '4. Telephony, WhatsApp & Call Recording Consent',
      badge: 'Quality & Audit',
      content: (
        <div className="space-y-3">
          <p>
            To deliver prompt real-time connectivity between property seekers and verified developers/channel partners, RealtyAsk integrates cloud telephony infrastructure (e.g., Exotel, MyOperator, Twilio) and official WhatsApp Business APIs:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Call &amp; Chat Monitoring:</strong> Inbound/outbound phone calls, IVR communications, WhatsApp messages, and virtual site tour sessions may be monitored, logged, or recorded.
            </li>
            <li>
              <strong>Purpose of Recording:</strong> Such records are maintained strictly for operational quality assurance, buyer-broker dispute resolution, agent training, and statutory regulatory compliance under RERA and consumer protection directives.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'ai-prompt-privacy',
      icon: Cpu,
      title: '5. AI Conversational Engine & Prompt Privacy',
      badge: 'Zero-Retention Model',
      content: (
        <div className="space-y-3">
          <p>
            RealtyAsk provides a domain-specific real estate advisory engine powered by enterprise-grade foundation models:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li>
              <strong>No Model Training on User Prompts:</strong> Your conversational queries, financial evaluations, and prompt inputs are processed via zero-data-retention enterprise APIs. Your conversations are <em>never</em> used to train public foundation models (such as Google Gemini, Anthropic Claude, or OpenAI models).
            </li>
            <li>
              <strong>Encrypted Session Continuity:</strong> Chat transcripts are stored encrypted at rest (AES-256), may be reviewed by the RealtyAsk founding team to improve answers and understand how the service is used, and are purged according to our data retention schedule.
            </li>
            <li>
              <strong>No Unconsented Behavioral Profiling:</strong> We do not sell prompt telemetry to ad-tech networks or data brokers for cross-site behavioral retargeting.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'usage',
      icon: UserCheck,
      title: '6. Purpose & Lawful Grounds of Processing',
      content: (
        <div className="space-y-3">
          <p>We process personal data strictly under lawful grounds of consent and legitimate uses as defined by the DPDP Act 2023:</p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li><strong>Contextual Property Matching:</strong> Generating real-time market evaluations, RERA comparisons, and price benchmark calculations.</li>
            <li><strong>Fulfilling User Inquiries:</strong> Enabling verified developers, RERA channel partners, and lending partners to coordinate site visits, pricing sheets, and loan pre-approvals.</li>
            <li><strong>Platform Security &amp; Anomaly Prevention:</strong> Monitoring query volume to prevent denial-of-service, scraping, or automated system abuse.</li>
            <li><strong>Understanding Shared Reach:</strong> Seeing whether and how RealtyAsk is shared from one person to another, so we can tell whether the product is genuinely useful.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'minors-data-protection',
      icon: UserX,
      title: '7. Age Restriction & Protection of Minors (DPDP Act Section 9)',
      badge: '18+ Platform',
      content: (
        <div className="space-y-3">
          <p>
            In strict compliance with Section 9 of the Digital Personal Data Protection Act, 2023:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Age Eligibility:</strong> RealtyAsk is designed exclusively for individuals who are at least 18 years of age and legally competent to enter into binding contracts under the Indian Contract Act, 1872.
            </li>
            <li>
              <strong>No Minor Data Collection:</strong> We do not knowingly collect, process, track, or target personal data or behavioral profiles of children under 18 years of age.
            </li>
            <li>
              <strong>Immediate Deletion:</strong> If we discover that personal data of a minor has been collected without verifiable parental/guardian consent, we take immediate corrective steps to permanently delete such records from our databases.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'processors-cross-border',
      icon: Globe,
      title: '8. Cross-Border Data Transfer & Infrastructure Security',
      badge: 'Enterprise Security',
      content: (
        <div className="space-y-3">
          <p>
            To deliver high availability, low-latency search indexing, and resilient AI advisory processing, RealtyAsk utilizes global enterprise cloud partners:
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white text-xs block">Supabase / PostgreSQL Cloud</span>
              <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">Encrypted at rest (AES-256) with strict Row-Level Security (RLS) policies.</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white text-xs block">Vercel &amp; Edge Delivery</span>
              <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">TLS 1.3 encryption in transit, automated DDoS mitigation, and global edge points of presence.</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white text-xs block">Enterprise AI Inference Providers</span>
              <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">Stateless AI processing governed by zero-data-retention and SOC 2 / ISO 27001 data safeguards.</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white text-xs block">PostHog Analytics</span>
              <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">First-party telemetry and UI performance metrics with privacy-preserving IP masking.</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            In accordance with DPDP Act 2023 provisions on cross-border transfers, data may transit or be processed on secure overseas cloud servers that comply with rigorous international data protection benchmarks.
          </p>
        </div>
      ),
    },
    {
      id: 'embedded-microsites',
      icon: ExternalLink,
      title: '9. Embedded Builder Microsites & Third-Party Widgets',
      content: (
        <div className="space-y-3">
          <p>
            RealtyAsk showcases verified projects from premier developers across Delhi NCR (such as Godrej Properties, M3M, Gaurs Group, ATS, Eldeco, and others). In certain instances, property pages may incorporate embedded iframe brochures, 360° virtual tour players, or developer-hosted scheduling widgets:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Independent Privacy Policies:</strong> Submitting information directly inside an embedded developer form or following external links navigates you outside RealtyAsk' direct governance. Such actions are subject solely to the respective builder's or vendor's privacy policy.
            </li>
            <li>
              <strong>Release of Liability:</strong> RealtyAsk is not responsible for data handling, storage, or unsolicited outreach initiated through independent third-party microsites or off-platform interactions.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'cookies',
      icon: Cookie,
      title: '10. Cookies, Local Storage & Geolocation Preferences',
      content: (
        <div className="space-y-3">
          <p>
            RealtyAsk utilizes essential cookies and browser local storage to maintain session continuity, guest token states, and saved property shortlists:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li><strong>Essential Cookies:</strong> Required for user authentication, security verification, and session state.</li>
            <li><strong>Geolocation Data:</strong> Used ephemerally to center the search radius to your relevant NCR sub-market (e.g. Noida vs Greater Noida or Yamuna Expressway). You can disable location permissions in your browser at any time without disrupting manual search.</li>
            <li><strong>Referral Code:</strong> Your device's own shareable code, and whether you have dismissed the chat-review notice, are stored in your browser's local storage.</li>
            <li><strong>Opt-Out:</strong> You can clear cookies or local storage directly in your browser settings at any time.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'shared-links',
      icon: Share2,
      title: '10a. Shared Links & Referral Tracking',
      content: (
        <div className="space-y-3">
          <p>
            RealtyAsk lets people share a link to the service with others, and lets our own team generate labelled links to see how the product spreads.
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li><strong>No Names Collected:</strong> A link records only your device type, a best-effort guess at the app you opened it from, and the time — never your name, unless you separately give us one (for example, on a callback request).</li>
            <li><strong>Internal Use Only:</strong> This data is visible only to RealtyAsk's founding team, never to builders, channel partners, or any third party.</li>
            <li><strong>Your Own Chats Stay Yours:</strong> Being part of a shared link does not change who can act on your account — it only lets us see that a chat happened and, at a summary level, what it was about.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'dpdp-rights',
      icon: Shield,
      title: '11. Data Principal Rights (DPDP Act 2023)',
      badge: 'Statutory Rights',
      content: (
        <div className="space-y-3">
          <p>
            Under the Digital Personal Data Protection Act, 2023 (DPDP Act) of India, you hold clear, legally enforceable rights:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li><strong>Right to Access &amp; Summary:</strong> Request an itemized summary of all personal data, inquiries, and transcripts processed by RealtyAsk.</li>
            <li><strong>Right to Correction &amp; Erasure:</strong> Request the immediate rectification of outdated details or the complete permanent erasure of your account, contact details, and search history.</li>
            <li><strong>Right to Consent Withdrawal:</strong> You may revoke consent for developer communications or platform data processing at any time by emailing our Grievance Cell. Upon withdrawal, your data processing will cease within statutory timeframes.</li>
            <li><strong>Right to Nominate:</strong> Nominate an individual to exercise your Data Principal rights in the event of incapacity or demise.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'retention',
      icon: Lock,
      title: '12. Data Retention & Erasure Schedule',
      content: (
        <div className="space-y-3">
          <p>
            Chat transcripts and search queries from unauthenticated guest sessions, and referral-link data, are automatically expired after 12 months. Registered user profiles and saved property collections remain active until account deletion is initiated. Upon receiving an erasure request, personal identifiers are completely purged from our active databases within 15 days.
          </p>
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-slate-800 dark:text-slate-200 transition-colors">
      {/* Header Banner */}
      <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="sr-only">Back to </span>
            <Image src="/images/icons/logo-wordmark-black.png" alt="RealtyAsk" width={96} height={34} className="object-contain block dark:hidden" />
            <Image src="/images/icons/logo-wordmark-white.png" alt="RealtyAsk" width={96} height={32} className="object-contain hidden dark:block" />
          </Link>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            Last Updated: {lastUpdated}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title Hero */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 mb-4">
            <Lock size={13} /> DPDP Act 2023 Governance
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            We value your trust and are committed to protecting your personal information with complete transparency, enterprise encryption, DPDP Act 2023 compliance, and strict TRAI communication standards.
          </p>
        </div>

        {/* Section Cards */}
        <div className="space-y-6">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <section
                key={section.id}
                id={section.id}
                className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Icon size={18} />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                      {section.title}
                    </h2>
                  </div>
                  {section.badge && (
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                      {section.badge}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {section.content}
                </div>
              </section>
            )
          })}
        </div>

        {/* Statutory Grievance Redressal Officer Card (Mandatory in India) */}
        <div className="mt-10 p-6 sm:p-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <HelpCircle size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Statutory Grievance Redressal &amp; Privacy Officer
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Designated officer under Section 5 of the Information Technology Rules, 2021 &amp; DPDP Act, 2023
              </p>
            </div>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block mb-1">Data Protection &amp; Grievance Officer:</span>
              <p>Legal &amp; Compliance Cell</p>
              <p>RealtyAsk Technologies Private Limited</p>
              <p className="mt-1 flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <MapPin size={13} className="text-emerald-500 shrink-0" />
                Sector 62, Noida, Gautam Buddh Nagar, UP 201301, India
              </p>
            </div>
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block mb-1">Official Channels &amp; Turnaround SLA:</span>
              <p>Email: <a href="mailto:privacy@realtyask.in" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">privacy@realtyask.in</a></p>
              <p>Grievance Escalations: <a href="mailto:grievance@realtyask.in" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">grievance@realtyask.in</a></p>
              <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Acknowledgment within 48 hours · Resolution within statutory DPDP timelines
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
