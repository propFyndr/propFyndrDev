'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Smartphone,
  Laptop,
  Copy,
  Check,
  Share2,
  Send,
  MessageCircle,
  Star,
  CornerUpLeft,
  Moon,
  Sun,
  Loader2,
  Sliders,
  Building2,
  Phone,
  CheckCircle2,
  AlertCircle,
  Search,
  Archive,
  Trash2,
  Clock,
  Reply,
  Printer,
  ExternalLink,
  Tag,
  Grid,
  Menu,
  ChevronDown,
  Wifi,
  Battery,
  Mail,
  MapPin,
  Layers,
  ArrowUpRight
} from 'lucide-react'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect from '@/components/admin/CustomSelect'

export type EmailTemplateType = 'builder_pitch' | 'team_invite'
export type ClientPreviewType = 'gmail' | 'outlook' | 'mobile'

interface EmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  initialTemplate?: EmailTemplateType
  defaultRecipientEmail?: string
  defaultRecipientName?: string
  defaultRecipientPhone?: string
  defaultProjectName?: string
  defaultProjectsList?: string[]
  defaultTargetCity?: string
  defaultSenderName?: string
  defaultSenderPhone?: string
  defaultSenderTitle?: string
  defaultRole?: string
  inviteLink?: string
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  initialTemplate = 'team_invite',
  defaultRecipientEmail = 'developer@partner.com',
  defaultRecipientName = 'Aadhaar Shri',
  defaultRecipientPhone = '',
  defaultProjectName = 'Everest',
  defaultProjectsList = [],
  defaultTargetCity = 'Delhi-NCR & Greater Noida',
  defaultSenderName = 'PropFyndr Team',
  defaultSenderPhone = '+91 98712 34567',
  defaultSenderTitle = 'Developer Partnerships Desk',
  defaultRole = 'ANALYST',
  inviteLink = '',
}: EmailPreviewModalProps) {
  const [template, setTemplate] = useState<EmailTemplateType>(initialTemplate)
  const [clientMode, setClientMode] = useState<ClientPreviewType>('gmail')
  const [isDarkPreview, setIsDarkPreview] = useState(false)
  const [copiedType, setCopiedType] = useState<'html' | 'text' | 'wa' | null>(null)

  // Mobile responsive view switcher (Editor vs Preview)
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('preview')

  // Resend live dispatch state
  const [isSending, setIsSending] = useState(false)
  const [sentSuccessId, setSentSuccessId] = useState<string | null>(null)

  // Adaptable fields for live preview & outreach to ANY developer or invitee
  const [recipientName, setRecipientName] = useState(defaultRecipientName)
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail)
  const [recipientPhone, setRecipientPhone] = useState(defaultRecipientPhone)
  const [projectName, setProjectName] = useState(defaultProjectName)
  const [projectsList, setProjectsList] = useState<string[]>(defaultProjectsList)
  const [targetCity, setTargetCity] = useState(defaultTargetCity)
  const [senderName, setSenderName] = useState(defaultSenderName)
  const [senderTitle, setSenderTitle] = useState(defaultSenderTitle)
  const [senderPhone, setSenderPhone] = useState(defaultSenderPhone)

  // Auto-sync whenever selected builder or props change
  useEffect(() => {
    if (isOpen) {
      if (initialTemplate) setTemplate(initialTemplate)
      setRecipientName(defaultRecipientName || 'Aadhaar Shri')
      setRecipientEmail(defaultRecipientEmail || 'partnerships@aadhaar-shri.com')
      setRecipientPhone(defaultRecipientPhone || '')
      setProjectName(defaultProjectName || 'Everest')
      setProjectsList(defaultProjectsList || [])
      setTargetCity(defaultTargetCity || 'Delhi-NCR & Greater Noida')
      if (defaultSenderName) setSenderName(defaultSenderName)
      if (defaultSenderPhone) setSenderPhone(defaultSenderPhone)
      if (defaultSenderTitle) setSenderTitle(defaultSenderTitle)
    }
  }, [
    isOpen,
    initialTemplate,
    defaultRecipientName,
    defaultRecipientEmail,
    defaultRecipientPhone,
    defaultProjectName,
    defaultProjectsList,
    defaultTargetCity,
    defaultSenderName,
    defaultSenderPhone,
    defaultSenderTitle,
  ])

  if (!isOpen) return null

  const generatedInviteLink =
    inviteLink ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/admin/accept-invite?token=prp_demo_invite_token`
      : 'https://propfyndr.in/admin/accept-invite?token=prp_demo_invite_token')

  // Subject line computation — 100% focused on the recipient developer
  const subject =
    template === 'builder_pitch'
      ? `${recipientName || 'Developer'} × PropFyndr — Direct buyer inquiries & verified portfolio showcase`
      : `You've been invited to join PropFyndr Admin as ${defaultRole}`

  // Plaintext version — 100% focused on selling to the developer
  const getPlainText = () => {
    if (template === 'builder_pitch') {
      const devName = recipientName || 'Developer'
      const pName = projectName || 'your marquee developments'
      const city = targetCity || 'Delhi-NCR'

      return `Hi ${devName} Team,

Greetings from PropFyndr.in.

We have compiled an executive buyer demand brief for ${devName}. High-intent homebuyers in ${city} are actively researching ${devName} projects, including ${pName}.

Why top developers partner with PropFyndr:

1. Direct In-House Buyer Routing (Zero Broker Dilution):
Every inquiry, cost sheet calculation, and site visit request for ${devName} routes directly to your official sales desk. We never resell leads to external competing brokers.

2. Sanctioned Architectural Clarity:
We present ${devName}'s UP-RERA registered carpet areas, sanctioned layouts, and possession milestones with full transparency, giving buyers the conviction to make faster booking decisions.

3. Official Developer Console:
Claim and verify your dedicated ${devName} desk on PropFyndr to manage project specs, publish live tower progress, and monitor real-time buyer demand analytics.

We would love to share exclusive access to activate ${devName}'s official showcase:
${generatedInviteLink}

Best regards,
${senderName}
${senderTitle}
Direct: ${senderPhone} · partnerships@propfyndr.in
PropFyndr Technologies · https://propfyndr.in`
    }

    return `Hi,

You have been invited to join the PropFyndr platform with ${defaultRole} administrative access.

To accept your invitation, verify your credentials, and access the admin intelligence console, please click the secure link below:

${generatedInviteLink}

This link is valid for 7 days. If you did not request this invitation, you can safely ignore this email.

Best regards,
The PropFyndr Team
https://propfyndr.in`
  }

  // WhatsApp formatted outreach pitch
  const getWhatsAppText = () => {
    const devName = recipientName || 'Developer'
    const pName = projectName || 'your developments'
    const city = targetCity || 'Delhi-NCR'

    return `Hi ${devName} Team,

Greetings from PropFyndr.in.

We are currently highlighting ${devName}'s portfolio (including ${pName}) to high-intent home buyers across ${city}.

Key advantages for ${devName}:
1. Direct Buyer Inquiries: Inquiries and site visits route directly to your in-house sales desk with zero broker commission dilution.
2. 100% Sanctioned Specs: We showcase your approved carpet areas and legal clearances directly to qualified buyers.
3. Official Developer Console: Claim your verified brand profile and monitor live buyer demand.

Explore your official developer portal preview here:
${generatedInviteLink}

Best regards,
${senderName} | PropFyndr Developer Relations
${senderPhone}`
  }

  // HTML email version with dynamic Dark Mode & Mobile client adaptation
  const getHtml = (isMobile = clientMode === 'mobile', isDark = isDarkPreview) => {
    if (template === 'builder_pitch') {
      const recipientLabel = recipientName || 'Developer'
      const projectLabel = projectName || 'Everest'
      const cityLabel = targetCity || 'Delhi-NCR & Greater Noida'
      const otherProjects = projectsList.filter((p) => p !== projectLabel)

      // Dynamic Dark Mode / Light Mode Color Palette
      const palette = isDark
        ? {
            bodyBg: isMobile ? '#0b0b0e' : '#070709',
            containerBg: '#0f0f13',
            heroBg: 'linear-gradient(180deg, #17171d 0%, #0a0a0d 100%)',
            heroBorder: 'rgba(255, 255, 255, 0.1)',
            heroTitle: '#ffffff',
            heroEm: '#fef08a',
            bodyCanvas: '#0f0f13',
            cardBg: '#18181f',
            cardBorder: 'rgba(255, 255, 255, 0.09)',
            textPrimary: '#f4f4f5',
            textSecondary: '#a1a1aa',
            textMuted: '#71717a',
            chipBg: 'rgba(254, 240, 138, 0.15)',
            chipText: '#fef08a',
            showcaseBg: 'linear-gradient(135deg, #1b1b22 0%, #101014 100%)',
            showcaseBorder: 'rgba(255, 255, 255, 0.12)',
            divider: 'rgba(255, 255, 255, 0.08)',
            footerBg: '#0b0b0e',
            footerBorder: 'rgba(255, 255, 255, 0.08)',
            ctaBg: '#ffffff',
            ctaText: '#0a0a0d',
          }
        : {
            bodyBg: isMobile ? '#faf7f0' : '#f3f0e8',
            containerBg: '#faf7f0',
            heroBg: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
            heroBorder: 'transparent',
            heroTitle: '#ffffff',
            heroEm: '#fef08a',
            bodyCanvas: '#faf7f0',
            cardBg: '#ffffff',
            cardBorder: '#e7e3da',
            textPrimary: '#1c1917',
            textSecondary: '#44403c',
            textMuted: '#78716c',
            chipBg: '#fef3c7',
            chipText: '#92400e',
            showcaseBg: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
            showcaseBorder: '#e7e3da',
            divider: '#e7e3da',
            footerBg: '#f5f0e4',
            footerBorder: '#e7e3da',
            ctaBg: '#111114',
            ctaText: '#ffffff',
          }

      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background-color: ${palette.bodyBg};
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: ${palette.textPrimary};
      -webkit-font-smoothing: antialiased;
      transition: background-color 0.2s ease;
    }
    .email-container {
      width: 100%;
      max-width: ${isMobile ? '100%' : '600px'};
      margin: ${isMobile ? '0 auto' : '20px auto'};
      background-color: ${palette.containerBg};
      border-radius: ${isMobile ? '0' : '24px'};
      overflow: hidden;
      box-shadow: ${isMobile ? 'none' : '0 20px 40px -15px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)'};
      border: ${isMobile ? 'none' : `1px solid ${palette.cardBorder}`};
    }
    /* ── OBSIDIAN HERO HEADER ── */
    .hero-header {
      background: ${palette.heroBg};
      padding: ${isMobile ? '24px 18px 26px 18px' : '42px 36px 36px 36px'};
      text-align: center;
      color: #ffffff;
      position: relative;
      border-bottom: 1px solid ${palette.heroBorder};
    }
    .brand-mark {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: ${isMobile ? '10.5px' : '12px'};
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #ffffff;
      margin-bottom: ${isMobile ? '12px' : '20px'};
    }
    .brand-icon {
      width: ${isMobile ? '18px' : '22px'};
      height: ${isMobile ? '18px' : '22px'};
      background: #ffffff;
      color: #111114;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: ${isMobile ? '11px' : '12px'};
    }
    .hero-title {
      font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
      font-size: ${isMobile ? '22px' : '32px'};
      font-weight: 500;
      line-height: ${isMobile ? '1.2' : '1.18'};
      letter-spacing: -0.5px;
      color: ${palette.heroTitle};
      margin: 0 auto ${isMobile ? '12px' : '16px'} auto;
      max-width: 500px;
      text-wrap: balance;
    }
    .hero-title em {
      font-style: italic;
      font-weight: 400;
      color: ${palette.heroEm};
    }
    .hero-pill {
      display: inline-block;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 9999px;
      padding: ${isMobile ? '6px 12px' : '7px 18px'};
      font-size: ${isMobile ? '11px' : '12px'};
      color: rgba(255, 255, 255, 0.92);
      line-height: 1.4;
      max-width: 480px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }
    .hero-pill strong {
      color: #fef08a;
      font-weight: 700;
    }
    /* Downward Indicator Ring */
    .hero-arrow-ring {
      width: ${isMobile ? '26px' : '30px'};
      height: ${isMobile ? '26px' : '30px'};
      border-radius: 50%;
      background: #111114;
      border: 1px solid rgba(255, 255, 255, 0.22);
      color: #ffffff;
      font-size: ${isMobile ? '11px' : '12px'};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: ${isMobile ? '16px auto -38px auto' : '24px auto -50px auto'};
      position: relative;
      z-index: 10;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    }
    /* ── BODY CANVAS ── */
    .body-canvas {
      padding: ${isMobile ? '28px 16px 20px 16px' : '44px 36px 32px 36px'};
      background-color: ${palette.bodyCanvas};
      transition: background-color 0.2s ease;
    }
    .section-eyebrow {
      font-family: 'Newsreader', Georgia, serif;
      font-size: ${isMobile ? '18px' : '24px'};
      font-weight: 500;
      color: ${palette.textPrimary};
      text-align: center;
      margin: 0 0 ${isMobile ? '12px' : '18px'} 0;
      letter-spacing: -0.3px;
      text-wrap: balance;
    }
    /* Stat Ranking Card — 100% About the Developer */
    .stat-card {
      background: ${palette.cardBg};
      border: 1px solid ${palette.cardBorder};
      border-radius: 16px;
      padding: ${isMobile ? '16px 14px' : '22px 24px'};
      text-align: center;
      margin-bottom: ${isMobile ? '20px' : '28px'};
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
    }
    .stat-label {
      font-size: ${isMobile ? '9.5px' : '11px'};
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: ${palette.textMuted};
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: ${isMobile ? '21px' : '27px'};
      font-weight: 800;
      color: ${palette.textPrimary};
      letter-spacing: -0.5px;
      margin: 2px 0 6px 0;
    }
    .stat-desc {
      font-size: ${isMobile ? '12px' : '13px'};
      color: ${palette.textSecondary};
      line-height: 1.5;
      max-width: 460px;
      margin: 0 auto;
    }
    /* Editorial Feature Article */
    .editorial-block {
      margin-bottom: ${isMobile ? '20px' : '26px'};
    }
    .category-chip {
      display: inline-block;
      font-size: ${isMobile ? '9px' : '9.5px'};
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 8px;
      background-color: ${palette.chipBg};
      color: ${palette.chipText};
    }
    .editorial-heading {
      font-family: 'Newsreader', Georgia, serif;
      font-size: ${isMobile ? '17px' : '21px'};
      font-weight: 600;
      color: ${palette.textPrimary};
      line-height: 1.35;
      margin: 0 0 8px 0;
      letter-spacing: -0.3px;
    }
    .editorial-body {
      font-size: ${isMobile ? '12.5px' : '13.5px'};
      line-height: 1.6;
      color: ${palette.textSecondary};
      margin: 0 0 14px 0;
    }
    /* Developer Showcase Frame — 100% About Them */
    .showcase-banner {
      width: 100%;
      border-radius: 14px;
      overflow: hidden;
      margin: 14px 0;
      border: 1px solid ${palette.showcaseBorder};
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
    }
    .showcase-inner {
      background: ${palette.showcaseBg};
      padding: ${isMobile ? '16px 14px' : '22px'};
      color: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .showcase-badge {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #fef08a;
    }
    .showcase-title {
      font-family: 'Newsreader', Georgia, serif;
      font-size: ${isMobile ? '18px' : '22px'};
      font-weight: 500;
      color: #ffffff;
      margin-top: 4px;
    }
    .showcase-pillars {
      display: grid;
      grid-template-columns: ${isMobile ? '1fr' : 'repeat(3, 1fr)'};
      gap: ${isMobile ? '8px' : '12px'};
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }
    .pillar-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .pillar-item strong {
      font-size: 11.5px;
      color: #ffffff;
    }
    .pillar-item span {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.7);
    }
    .showcase-subprojects {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 10px;
      line-height: 1.4;
    }
    .divider {
      height: 1px;
      background-color: ${palette.divider};
      margin: ${isMobile ? '18px 0' : '24px 0'};
      border: none;
    }
    /* Call to Action */
    .cta-container {
      text-align: center;
      margin: ${isMobile ? '22px 0 10px 0' : '30px 0 14px 0'};
    }
    .cta-button {
      display: inline-block;
      background-color: ${palette.ctaBg};
      color: ${palette.ctaText} !important;
      font-size: ${isMobile ? '12.5px' : '13.5px'};
      font-weight: 700;
      text-decoration: none;
      padding: ${isMobile ? '12px 24px' : '14px 30px'};
      border-radius: 9999px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
      letter-spacing: -0.2px;
    }
    /* Footer */
    .footer-section {
      background-color: ${palette.footerBg};
      border-top: 1px solid ${palette.footerBorder};
      padding: ${isMobile ? '18px 16px' : '26px 36px'};
      font-size: ${isMobile ? '11px' : '11.5px'};
      color: ${palette.textMuted};
      line-height: 1.6;
    }
    .signature-title {
      font-weight: 700;
      color: ${palette.textPrimary};
      font-size: ${isMobile ? '11.5px' : '12.5px'};
    }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; border-radius: 0 !important; margin: 0 !important; }
      .hero-header { padding: 22px 14px 24px 14px !important; }
      .hero-title { font-size: 21px !important; }
      .body-canvas { padding: 24px 14px 18px 14px !important; }
      .section-eyebrow { font-size: 17px !important; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Obsidian Hero Header -->
    <div class="hero-header">
      <div class="brand-mark">
        <span class="brand-icon">P</span>
        <span>PropFyndr Flow</span>
      </div>
      <h1 class="hero-title">
        ${recipientLabel} <em>Portfolio Brief</em>
      </h1>
      <div class="hero-pill">
        <strong>Active Homebuyer Demand:</strong> Over 14,800+ home seekers actively evaluating ${recipientLabel} developments on PropFyndr.
      </div>
      <div class="hero-arrow-ring">↓</div>
    </div>

    <!-- Body Canvas -->
    <div class="body-canvas">
      <h2 class="section-eyebrow">Executive Developer Brief</h2>

      <!-- Stat Ranking Card — 100% About Them -->
      <div class="stat-card">
        <div class="stat-label">${recipientLabel.toUpperCase()} DEMAND INDEX · ${cityLabel.toUpperCase()}</div>
        <div class="stat-value">Top 0.1% Buyer Interest</div>
        <div class="stat-desc">
          Verified home seekers ranked developments by <strong>${recipientLabel}</strong> in the top tier for sanctioned layout integrity, RERA adherence, and spatial delivery.
        </div>
      </div>

      <!-- Feature 1: Direct In-House Buyer Routing -->
      <div class="editorial-block">
        <span class="category-chip">Zero Brokerage Dilution</span>
        <h3 class="editorial-heading">
          Direct Buyer Inquiries to ${recipientLabel} Sales Desk
        </h3>
        <p class="editorial-body">
          Unlike legacy real estate portals that auction your leads to multiple competing outside brokers, PropFyndr routes high-intent home seekers directly to your in-house sales gallery. When a verified buyer calculates a payment milestone or schedules a private site visit for <strong>${projectLabel}</strong>, the inquiry routes exclusively to you.
        </p>

        <!-- Developer Showcase Box -->
        <div class="showcase-banner">
          <div class="showcase-inner">
            <span class="showcase-badge">${recipientLabel} DEVELOPER SHOWCASE</span>
            <div class="showcase-title">${projectLabel}</div>
            <div class="showcase-pillars">
              <div class="pillar-item">
                <strong>Direct Sales Desk</strong>
                <span>100% in-house buyer inquiries</span>
              </div>
              <div class="pillar-item">
                <strong>Sanctioned Specs</strong>
                <span>Approved carpet & layout</span>
              </div>
              <div class="pillar-item">
                <strong>Site Visits</strong>
                <span>Verified buyer bookings</span>
              </div>
            </div>
            ${
              otherProjects.length > 0
                ? `<div class="showcase-subprojects">Also highlighting: ${otherProjects.slice(0, 3).join(' · ')}</div>`
                : ''
            }
          </div>
        </div>
      </div>

      <hr class="divider" />

      <!-- Feature 2: Official Developer Verification & Console -->
      <div class="editorial-block">
        <span class="category-chip">Executive Control</span>
        <h3 class="editorial-heading">
          Claim &amp; Manage ${recipientLabel}'s Verified Presence
        </h3>
        <p class="editorial-body">
          Access real-time buyer demand analytics, manage verified tower inventory, and showcase sanctioned floor plans with complete authenticity.
        </p>
      </div>

      <!-- Call to Action -->
      <div class="cta-container">
        <a href="${generatedInviteLink}" class="cta-button">
          Claim Official ${recipientLabel} Desk &rarr;
        </a>
      </div>
    </div>

    <!-- Editorial Footer -->
    <div class="footer-section">
      <div class="signature-title">${senderName}</div>
      <div style="margin: 2px 0 10px 0;">${senderTitle} · PropFyndr Technologies</div>
      <div>Direct Line: ${senderPhone} · partnerships@propfyndr.in</div>
      <div style="margin-top: 6px; font-size: 10.5px; opacity: 0.8;">
        This executive brief was prepared exclusively for the leadership and sales team of ${recipientLabel}.
      </div>
    </div>
  </div>
</body>
</html>`
    }

    // Team Invite HTML Template with Dark Mode support
    const isDarkBg = isDark ? '#0b0b0e' : '#f8fafc'
    const isDarkCard = isDark ? '#141418' : '#ffffff'
    const isDarkText = isDark ? '#f4f4f5' : '#0f172a'
    const isDarkSub = isDark ? '#a1a1aa' : '#64748b'
    const isDarkBorder = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: ${isDarkBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: ${isDarkText}; }
    .box { max-width: ${isMobile ? '100%' : '520px'}; margin: ${isMobile ? '0' : '30px auto'}; background: ${isDarkCard}; border-radius: ${isMobile ? '0' : '20px'}; padding: 32px 24px; border: ${isMobile ? 'none' : `1px solid ${isDarkBorder}`}; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    .badge { display: inline-block; padding: 4px 10px; background: rgba(59, 130, 246, 0.12); color: #3b82f6; font-size: 11px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: ${isDarkText}; letter-spacing: -0.5px; }
    p { font-size: 13.5px; line-height: 1.6; color: ${isDarkSub}; margin: 0 0 20px 0; }
    .btn { display: block; text-align: center; background: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 12px; font-weight: 700; font-size: 13.5px; text-decoration: none; margin-bottom: 24px; }
    .footer { font-size: 11px; color: ${isDarkSub}; border-top: 1px solid ${isDarkBorder}; padding-top: 16px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="box">
    <span class="badge">Security Credentials</span>
    <h1>Join PropFyndr Admin</h1>
    <p>You have been assigned access credentials as <strong>${defaultRole}</strong> on the PropFyndr real estate intelligence console.</p>
    <a href="${generatedInviteLink}" class="btn">Accept Invitation &rarr;</a>
    <div class="footer">
      Direct Link: ${generatedInviteLink}
    </div>
  </div>
</body>
</html>`
  }

  // Copy responsive HTML to clipboard
  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(getHtml())
      setCopiedType('html')
      toast.success('Responsive HTML email copied to clipboard')
      setTimeout(() => setCopiedType(null), 2500)
    } catch {
      toast.error('Failed to copy HTML')
    }
  }

  // Copy Plaintext version to clipboard
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(getPlainText())
      setCopiedType('text')
      toast.success('Plaintext email copied to clipboard')
      setTimeout(() => setCopiedType(null), 2500)
    } catch {
      toast.error('Failed to copy plaintext')
    }
  }

  // Copy WhatsApp Pitch
  const copyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(getWhatsAppText())
      setCopiedType('wa')
      toast.success('WhatsApp outreach pitch copied to clipboard')
      setTimeout(() => setCopiedType(null), 2500)
    } catch {
      toast.error('Failed to copy WhatsApp pitch')
    }
  }

  // Open direct WhatsApp chat with recipient
  const openWhatsAppChat = () => {
    const rawNumber = recipientPhone.replace(/[^0-9]/g, '')
    const pitchText = encodeURIComponent(getWhatsAppText())
    if (rawNumber) {
      window.open(`https://wa.me/${rawNumber}?text=${pitchText}`, '_blank')
    } else {
      window.open(`https://wa.me/?text=${pitchText}`, '_blank')
    }
  }

  // Live Send via Resend API
  const handleSendViaResend = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      toast.error('Please specify a valid recipient email address.')
      return
    }

    setIsSending(true)
    setSentSuccessId(null)

    try {
      const res = await adminFetch('/admin/outreach/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          subject,
          html: getHtml(),
          text: getPlainText(),
          template,
          metadata: {
            recipientName,
            projectName,
            targetCity,
            role: defaultRole,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch email via Resend')
      }

      setSentSuccessId(data.messageId || 'sent')
      toast.success(`Executive email successfully dispatched to ${recipientEmail}!`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Resend dispatch failed'
      toast.error(msg)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Main Apple Modal Card Container */}
      <div className="relative w-full max-w-7xl h-[92vh] max-h-[920px] bg-white dark:bg-zinc-900 rounded-[28px] shadow-[0_25px_70px_rgba(0,0,0,0.45)] border border-zinc-200/90 dark:border-zinc-800 flex flex-col overflow-hidden z-10">
        {/* ── Modal Top Header Bar ────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
              <Mail size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Email Composer &amp; Executive Preview
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Resend Engine
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                Tailored executive outreach simulation across Gmail, Outlook 365, and iOS Apple Mail.
              </p>
            </div>
          </div>

          {/* Top Actions: Send via Resend + Close */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendViaResend}
              disabled={isSending}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-md transition-all cursor-pointer ${
                isSending
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98]'
              }`}
            >
              {isSending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : sentSuccessId ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-300" />
                  <span>Sent!</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Send via Resend</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Mobile View Toggle Tabs (Small Screens Only) ──────────────────── */}
        <div className="flex md:hidden border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => setMobileTab('edit')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mobileTab === 'edit'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500'
            }`}
          >
            Edit Template &amp; Fields
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mobileTab === 'preview'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500'
            }`}
          >
            Live Device Preview
          </button>
        </div>

        {/* ── Main Two-Column Layout ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Panel: Controls & Template Parameters */}
          <div
            className={`w-full md:w-[360px] lg:w-[410px] border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 overflow-y-auto shrink-0 flex flex-col justify-between gap-5 ${
              mobileTab === 'preview' ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="space-y-4">
              {/* Template Selector */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Email Template
                </label>
                <CustomSelect
                  value={template}
                  onChange={(val) => setTemplate(val as EmailTemplateType)}
                  options={[
                    { value: 'team_invite', label: 'Admin Team Role Invitation' },
                    { value: 'builder_pitch', label: 'Developer / Builder Onboarding Pitch' },
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>

              {/* Dynamic Field Inputs — 100% Adaptable */}
              {template === 'builder_pitch' ? (
                <div className="space-y-3.5">
                  {/* Recipient Firm */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                      <Building2 size={13} className="text-zinc-400" />
                      <span>Developer / Builder Firm Name *</span>
                    </label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Aadhaar Shri"
                      className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
                    />
                  </div>

                  {/* Recipient Email */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                      <Mail size={13} className="text-zinc-400" />
                      <span>Recipient Email *</span>
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="partnerships@aadhaar-shri.com"
                      className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
                    />
                  </div>

                  {/* Recipient WhatsApp / Phone */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                      <Phone size={13} className="text-zinc-400" />
                      <span>Recipient Mobile / WhatsApp Number</span>
                    </label>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 text-xs font-mono font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
                    />
                  </div>

                  {/* Flagship Project Mention + Interactive DB Project Pills */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                      <Layers size={13} className="text-zinc-400" />
                      <span>Flagship Project Mention</span>
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g. Everest"
                      className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
                    />

                    {/* Interactive Associated Projects from Database */}
                    {projectsList.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          Projects in Database for {recipientName || 'Builder'}:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {projectsList.map((p) => {
                            const isCurrent = projectName.toLowerCase() === p.toLowerCase()
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setProjectName(p)}
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                                  isCurrent
                                    ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-bold'
                                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                                }`}
                              >
                                {p}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Target Region */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                      <MapPin size={13} className="text-zinc-400" />
                      <span>Target Micro-Market / Region</span>
                    </label>
                    <input
                      type="text"
                      value={targetCity}
                      onChange={(e) => setTargetCity(e.target.value)}
                      placeholder="e.g. Greater Noida & Delhi-NCR"
                      className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
                    />
                  </div>

                  {/* Sender Credentials */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1">
                        Sender Name
                      </label>
                      <input
                        type="text"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1">
                        Sender Phone
                      </label>
                      <input
                        type="text"
                        value={senderPhone}
                        onChange={(e) => setSenderPhone(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Invited User Email *
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Assigned Role
                    </label>
                    <div className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold text-xs">
                      {defaultRole}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Security Token Link
                    </label>
                    <p className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 font-mono text-[11px] text-zinc-500 break-all leading-tight">
                      {generatedInviteLink}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Instant Actions & Outreach Section */}
            <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Instant Actions &amp; Outreach
              </span>

              {/* WhatsApp Row */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openWhatsAppChat}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
                  title="Open WhatsApp chat with prefilled message"
                >
                  <MessageCircle size={14} />
                  <span>
                    {recipientPhone
                      ? `Open in WhatsApp (${recipientPhone.slice(-10)})`
                      : 'Open in WhatsApp'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={copyWhatsApp}
                  className="flex items-center justify-center px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer active:scale-[0.98]"
                  title="Copy WhatsApp plaintext pitch"
                >
                  {copiedType === 'wa' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>

              {/* Copy Responsive HTML Button */}
              <button
                type="button"
                onClick={copyHtml}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
              >
                {copiedType === 'html' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedType === 'html' ? 'HTML Copied to Clipboard!' : 'Copy Responsive HTML'}</span>
              </button>

              {/* Copy Plaintext Button */}
              <button
                type="button"
                onClick={copyText}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
              >
                {copiedType === 'text' ? <Check size={14} /> : <Share2 size={14} />}
                <span>{copiedType === 'text' ? 'Plaintext Copied!' : 'Copy Plaintext'}</span>
              </button>
            </div>
          </div>

          {/* Right Panel: Executive Device Preview Canvas */}
          <div
            className={`flex-1 flex flex-col min-h-0 bg-zinc-100/70 dark:bg-zinc-950 overflow-hidden ${
              mobileTab === 'edit' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Canvas Sub-Header: Client & Frame Switcher + Dark Mode Toggle */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-medium hidden sm:inline">Preview Client:</span>
                <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700">
                  {/* Gmail Desktop */}
                  <button
                    type="button"
                    onClick={() => setClientMode('gmail')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      clientMode === 'gmail'
                        ? 'bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Laptop size={13} />
                    <span>Gmail (Web)</span>
                  </button>

                  {/* Outlook Desktop */}
                  <button
                    type="button"
                    onClick={() => setClientMode('outlook')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      clientMode === 'outlook'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Laptop size={13} />
                    <span>Outlook 365</span>
                  </button>

                  {/* iPhone iOS */}
                  <button
                    type="button"
                    onClick={() => setClientMode('mobile')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      clientMode === 'mobile'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Smartphone size={13} />
                    <span>Mobile (iOS)</span>
                  </button>
                </div>
              </div>

              {/* Dark Mode Dynamic Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDarkPreview(!isDarkPreview)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold text-[11px] shadow-2xs cursor-pointer transition-all active:scale-[0.98] ${
                    isDarkPreview
                      ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300 hover:bg-indigo-900/80'
                      : 'bg-zinc-100 border-zinc-200 hover:bg-zinc-200 text-zinc-700'
                  }`}
                  title="Toggle dark mode preview simulation"
                >
                  {isDarkPreview ? (
                    <Sun size={13} className="text-amber-400" />
                  ) : (
                    <Moon size={13} className="text-indigo-600" />
                  )}
                  <span>{isDarkPreview ? 'Dark Mode: ON' : 'Dark Mode: OFF'}</span>
                </button>
              </div>
            </div>

            {/* Canvas Screen: Laptop or Mobile Device Frame */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 flex items-center justify-center">
              {clientMode === 'mobile' ? (
                /* ── PHONE FRAME (iPhone 16 Pro Natural Titanium Mockup) ─── */
                <div className="relative flex flex-col items-center select-none py-2">
                  <div
                    className={`w-[365px] xs:w-[380px] max-w-[94vw] rounded-[52px] border-[5px] border-zinc-700/90 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.12)] ring-2 ring-zinc-500/30 transition-all overflow-hidden shrink-0 flex flex-col ${
                      isDarkPreview ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'
                    }`}
                  >
                    {/* Top Dynamic Island Bar */}
                    <div className="w-full flex items-center justify-between px-6 pt-2 pb-2 bg-black text-white shrink-0">
                      <span className="text-[11px] font-bold tracking-tight">9:41</span>
                      <div className="w-24 h-5 bg-black rounded-full flex items-center justify-between px-2.5 border border-zinc-800/80 shadow-xs">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-blue-950/80" />
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.9)]" />
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <Wifi size={11} />
                        <Battery size={13} className="text-zinc-200" />
                      </div>
                    </div>

                    {/* Native Mobile Email Header */}
                    <div
                      className={`px-4 py-2 border-b flex items-center justify-between text-xs shrink-0 transition-colors ${
                        isDarkPreview
                          ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-1 text-blue-500 font-semibold cursor-pointer">
                        <span>‹</span>
                        <span>Inbox</span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-400">
                        <Archive size={14} />
                        <Trash2 size={14} />
                        <Reply size={14} />
                      </div>
                    </div>

                    {/* Email Meta in Mobile Client */}
                    <div
                      className={`px-4 py-2.5 border-b text-xs shrink-0 transition-colors ${
                        isDarkPreview
                          ? 'bg-zinc-900/80 border-zinc-800'
                          : 'bg-white border-zinc-100'
                      }`}
                    >
                      <div
                        className={`font-bold text-xs line-clamp-1 mb-1 ${
                          isDarkPreview ? 'text-zinc-100' : 'text-zinc-900'
                        }`}
                      >
                        {subject}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {template === 'builder_pitch' ? 'P' : 'PF'}
                          </div>
                          <div>
                            <div
                              className={`font-semibold ${
                                isDarkPreview ? 'text-zinc-200' : 'text-zinc-800'
                              }`}
                            >
                              {senderName}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              to {recipientName || 'Developer'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-400">4:51 PM</span>
                      </div>
                    </div>

                    {/* Phone Screen Body Scrollable — dynamic dark mode adaptation */}
                    <div
                      className={`p-0 max-h-[560px] overflow-y-auto text-xs leading-relaxed select-text transition-colors duration-200 ${
                        isDarkPreview ? 'bg-[#0b0b0e]' : 'bg-[#faf7f0]'
                      }`}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: getHtml(true, isDarkPreview),
                        }}
                      />
                    </div>

                    {/* Bottom iOS Home Indicator */}
                    <div
                      className={`w-full flex justify-center py-2 shrink-0 border-t transition-colors duration-200 ${
                        isDarkPreview
                          ? 'bg-[#0b0b0e] border-zinc-800'
                          : 'bg-[#faf7f0] border-zinc-200/40'
                      }`}
                    >
                      <div className="w-28 h-1 bg-zinc-400 dark:bg-zinc-600 rounded-full" />
                    </div>
                  </div>
                </div>
              ) : (
                /* ── LAPTOP FRAME (MacBook Pro Space Gray Studio Mockup) ─── */
                <div className="w-full max-w-4xl flex flex-col items-center select-none">
                  {/* Laptop Screen Bezel */}
                  <div className="w-full bg-[#161619] rounded-t-[26px] p-2.5 sm:p-3.5 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.08)] border-[2px] border-zinc-700/80">
                    {/* Top Notch with Dual Sensor & Green Camera LED */}
                    <div className="w-full flex items-center justify-center pb-2">
                      <div className="w-24 h-4 bg-zinc-950 rounded-b-xl flex items-center justify-center gap-2 border-b border-x border-zinc-800 shadow-inner">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-700/80 flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-blue-950/80" />
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.9)] animate-pulse" />
                      </div>
                    </div>

                    {/* Laptop Screen Display Area */}
                    <div
                      className={`w-full rounded-xl overflow-hidden ring-1 ring-black/40 shadow-inner transition-colors ${
                        isDarkPreview ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'
                      }`}
                    >
                      {/* CLIENT 1: GMAIL WEB */}
                      {clientMode === 'gmail' && (
                        <div className="flex flex-col text-xs">
                          {/* Gmail Top Navbar */}
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 border-b select-none transition-colors ${
                              isDarkPreview
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                                : 'bg-[#f6f8fc] border-zinc-200 text-zinc-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Menu size={16} className="text-zinc-500" />
                              <div className="flex items-center gap-1.5 font-semibold text-sm">
                                <span className="text-red-500 font-black text-base">M</span>
                                <span
                                  className={`font-bold ${
                                    isDarkPreview ? 'text-zinc-200' : 'text-zinc-700'
                                  }`}
                                >
                                  Gmail
                                </span>
                              </div>
                            </div>

                            {/* Gmail Search Bar */}
                            <div
                              className={`hidden sm:flex items-center flex-1 max-w-md mx-6 px-3.5 py-1.5 rounded-full border shadow-2xs gap-2 ${
                                isDarkPreview
                                  ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                                  : 'bg-white border-zinc-200/80 text-zinc-700'
                              }`}
                            >
                              <Search size={14} className="text-zinc-400" />
                              <span className="text-xs text-zinc-400 flex-1">Search mail</span>
                              <Sliders size={13} className="text-zinc-400" />
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                                A
                              </div>
                            </div>
                          </div>

                          {/* Gmail Action Toolbar */}
                          <div
                            className={`flex items-center justify-between px-4 py-2 border-b select-none text-zinc-500 text-[11px] ${
                              isDarkPreview ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-100'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <CornerUpLeft size={14} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <Archive size={14} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <AlertCircle size={14} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <Trash2 size={14} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <Clock size={14} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <Tag size={14} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                            </div>

                            <div className="flex items-center gap-3">
                              <Printer size={14} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <ExternalLink size={14} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                            </div>
                          </div>

                          {/* Gmail Email Header */}
                          <div
                            className={`p-4 sm:p-6 border-b transition-colors ${
                              isDarkPreview
                                ? 'bg-zinc-950 border-zinc-800'
                                : 'bg-white border-zinc-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h2
                                  className={`text-base sm:text-lg font-bold ${
                                    isDarkPreview ? 'text-zinc-100' : 'text-zinc-900'
                                  }`}
                                >
                                  {subject}
                                </h2>
                                <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                                  Inbox
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-zinc-400 shrink-0">
                                <Star size={15} className="hover:text-amber-400 cursor-pointer" />
                                <Printer size={15} className="hover:text-zinc-700 cursor-pointer" />
                              </div>
                            </div>

                            {/* Sender Info Line */}
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                  {template === 'builder_pitch' ? 'P' : 'PF'}
                                </div>
                                <div>
                                  <div
                                    className={`font-bold flex items-center gap-1.5 ${
                                      isDarkPreview ? 'text-zinc-100' : 'text-zinc-900'
                                    }`}
                                  >
                                    <span>{senderName}</span>
                                    <span className="font-normal text-zinc-400">
                                      &lt;partnerships@propfyndr.in&gt;
                                    </span>
                                  </div>
                                  <div className="text-zinc-400 text-[11px] flex items-center gap-1">
                                    <span>
                                      to {recipientName} &lt;{recipientEmail}&gt;
                                    </span>
                                    <ChevronDown size={11} className="cursor-pointer" />
                                  </div>
                                </div>
                              </div>

                              <span className="text-[11px] text-zinc-400 tabular-nums">
                                4:51 PM (0 minutes ago)
                              </span>
                            </div>
                          </div>

                          {/* Email Body Canvas */}
                          <div
                            className={`p-4 sm:p-8 max-h-[460px] overflow-y-auto select-text transition-colors duration-200 ${
                              isDarkPreview ? 'bg-[#0b0b0e]' : 'bg-[#faf7f0]'
                            }`}
                          >
                            <div
                              dangerouslySetInnerHTML={{
                                __html: getHtml(false, isDarkPreview),
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* CLIENT 2: OUTLOOK 365 WEB */}
                      {clientMode === 'outlook' && (
                        <div className="flex flex-col text-xs">
                          {/* Outlook Blue Top Navbar */}
                          <div className="flex items-center justify-between px-4 py-2.5 bg-[#0078d4] text-white select-none">
                            <div className="flex items-center gap-3">
                              <Grid size={15} className="opacity-90" />
                              <span className="font-bold text-sm tracking-tight">Outlook</span>
                            </div>

                            {/* Outlook Search */}
                            <div className="hidden sm:flex items-center flex-1 max-w-md mx-6 px-3 py-1 rounded bg-white/20 text-white placeholder-white/70 text-xs gap-2">
                              <Search size={13} className="opacity-80" />
                              <span className="text-white/80 text-[11px]">Search</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-white text-[#0078d4] font-bold text-xs flex items-center justify-center">
                                PF
                              </div>
                            </div>
                          </div>

                          {/* Outlook Ribbon Toolbar */}
                          <div
                            className={`flex items-center gap-4 px-4 py-1.5 border-b select-none text-[11px] font-medium text-zinc-600 dark:text-zinc-400 ${
                              isDarkPreview ? 'bg-zinc-900 border-zinc-800' : 'bg-[#f3f2f1] border-zinc-200'
                            }`}
                          >
                            <span className="font-bold text-[#0078d4] border-b-2 border-[#0078d4] pb-1">
                              Home
                            </span>
                            <span className="pb-1 hover:text-zinc-900 cursor-pointer">View</span>
                            <span className="pb-1 hover:text-zinc-900 cursor-pointer">Help</span>
                          </div>

                          {/* Outlook Email Header */}
                          <div
                            className={`p-4 sm:p-6 border-b transition-colors ${
                              isDarkPreview
                                ? 'bg-zinc-950 border-zinc-800'
                                : 'bg-white border-zinc-100'
                            }`}
                          >
                            <h2
                              className={`text-base sm:text-lg font-bold mb-3 ${
                                isDarkPreview ? 'text-zinc-100' : 'text-zinc-900'
                              }`}
                            >
                              {subject}
                            </h2>

                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#0078d4] text-white font-bold text-xs flex items-center justify-center shrink-0">
                                  {template === 'builder_pitch' ? 'P' : 'PF'}
                                </div>
                                <div>
                                  <div
                                    className={`font-bold ${
                                      isDarkPreview ? 'text-zinc-100' : 'text-zinc-900'
                                    }`}
                                  >
                                    {senderName} &lt;partnerships@propfyndr.in&gt;
                                  </div>
                                  <div className="text-zinc-400 text-[11px]">
                                    To: {recipientName} &lt;{recipientEmail}&gt;
                                  </div>
                                </div>
                              </div>
                              <span className="text-[11px] text-zinc-400">Fri 4:51 PM</span>
                            </div>
                          </div>

                          {/* Email Body Canvas */}
                          <div
                            className={`p-4 sm:p-8 max-h-[460px] overflow-y-auto select-text transition-colors duration-200 ${
                              isDarkPreview ? 'bg-[#0b0b0e]' : 'bg-[#faf7f0]'
                            }`}
                          >
                            <div
                              dangerouslySetInnerHTML={{
                                __html: getHtml(false, isDarkPreview),
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Laptop Precision-Milled Aluminum Base & Lip */}
                  <div className="relative w-[103%] -mt-[1px] flex flex-col items-center">
                    <div className="w-full h-[5px] bg-gradient-to-r from-zinc-600 via-zinc-400 to-zinc-600 rounded-t-sm shadow-[0_1px_2px_rgba(0,0,0,0.35)]" />
                    <div className="relative w-full h-3.5 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-950 rounded-b-[14px] shadow-[0_14px_30px_rgba(0,0,0,0.5)] border-t border-zinc-600/50 flex justify-center items-start">
                      <div className="w-24 h-1.5 bg-gradient-to-b from-zinc-950 to-zinc-700 rounded-b-md shadow-inner flex items-center justify-center">
                        <div className="w-16 h-[1px] bg-zinc-500/50 rounded-full" />
                      </div>
                    </div>
                    <div className="w-[96%] h-2.5 bg-black/40 blur-md rounded-full -mt-1 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Status Bar */}
            <div className="px-5 sm:px-6 py-2.5 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Ready to Send or Copy
                </span>
                <span className="text-zinc-400 hidden lg:inline">
                  · Tested against Gmail, Outlook 365, Apple Mail, and iOS Safari Mail
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition-all cursor-pointer active:scale-95"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
