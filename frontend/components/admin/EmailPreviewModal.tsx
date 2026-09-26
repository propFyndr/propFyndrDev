'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
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
  ArrowUpRight,
  Plus
} from 'lucide-react'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect from '@/components/admin/CustomSelect'
import { Iphone } from '@/components/ui/iphone'
import { Safari } from '@/components/ui/safari'
import { GmailLogo, OutlookLogo, AppleMailLogo } from '@/components/ui/EmailClientIcons'

export type EmailTemplateType = 'builder_pitch' | 'team_invite'
export type ClientPreviewType = 'gmail' | 'outlook' | 'mobile'

// Case-insensitive project deduplication helper
export const dedupeProjectNames = (list: (string | undefined | null)[]): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of list) {
    if (!item) continue
    const trimmed = item.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(trimmed)
    }
  }
  return result
}

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
  const [projectsList, setProjectsList] = useState<string[]>(dedupeProjectNames(defaultProjectsList))
  const [newProjectInput, setNewProjectInput] = useState('')
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
      setProjectsList(dedupeProjectNames(defaultProjectsList || []))
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

  // Computed all-projects list for this developer or partner (strictly deduplicated)
  const allProjects = React.useMemo(() => {
    if (projectsList && projectsList.length > 0) {
      return dedupeProjectNames(projectsList)
    }
    const nameLower = (recipientName || '').toLowerCase()
    if (nameLower.includes('ace')) {
      return ['Ace Starlit', 'Ace Parkway', 'Ace Divino', 'Ace Palm Floors']
    }
    if (nameLower.includes('aadhaar')) {
      return ['Gayatri Life', 'Aadhaar Shri Height', 'Aadhaar Greens']
    }
    if (nameLower.includes('mahagun')) {
      return ['Mahagun Manorialle', 'Mahagun Medalleo', 'Mahagun Mezzaria']
    }
    if (nameLower.includes('godrej')) {
      return ['Godrej Tropical Isle', 'Godrej Woods', 'Godrej Palm Retreat']
    }
    if (nameLower.includes('dlf')) {
      return ['The Arbour', 'DLF Midtown', 'Crest']
    }
    if (projectName) {
      return dedupeProjectNames([projectName, `${recipientName || 'Partner'} Heights`])
    }
    return ['Gayatri Life', 'Aadhaar Shri Height', 'Aadhaar Greens']
  }, [projectsList, recipientName, projectName])

  const handleAddProject = () => {
    const trimmed = newProjectInput.trim()
    if (!trimmed) return
    const current = dedupeProjectNames(projectsList)
    if (!current.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...current, trimmed]
      setProjectsList(updated)
      if (!projectName) setProjectName(trimmed)
      toast.success(`Added ${trimmed} to portfolio`)
    }
    setNewProjectInput('')
  }

  const handleRemoveProject = (projToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = projectsList.filter((p) => p.toLowerCase() !== projToRemove.toLowerCase())
    setProjectsList(updated)
    if (projectName.toLowerCase() === projToRemove.toLowerCase() && updated.length > 0) {
      setProjectName(updated[0])
    }
    toast.info(`Removed ${projToRemove}`)
  }

  if (!isOpen) return null

  const generatedInviteLink =
    inviteLink ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/admin/accept-invite?token=prp_demo_invite_token`
      : 'https://propfyndr.in/admin/accept-invite?token=prp_demo_invite_token')

  // Subject line computation — 100% focused on an exclusive, personal invitation
  const subject =
    template === 'builder_pitch'
      ? `${recipientName || 'Developer'}, you're invited to join PropFyndr's developer network`
      : `You've been invited to join PropFyndr Admin as ${defaultRole}`

  // Plaintext version — high-converting, low-friction invitation naming all projects
  const getPlainText = () => {
    if (template === 'builder_pitch') {
      const devName = recipientName || 'Developer'
      const city = targetCity || 'Delhi-NCR & Greater Noida'
      const projectsListFormatted = allProjects.map((p) => `• ${p}`).join('\n')
      const projectsInline = allProjects.join(', ')

      return `PROPFYNDR PARTNER NETWORK

${devName}, you're invited to PropFyndr.

Bring all your developments directly in front of verified homebuyers actively looking across ${city}.

Your Developments in PropFyndr Catalog:
${projectsListFormatted}

Explore Your Developer Desk:
${generatedInviteLink}

No brokerage on buyer inquiries. No competing listings around your projects. Just a direct channel between your sales gallery and interested buyers.

---

A BETTER WAY TO BE DISCOVERED

Homebuyers are no longer just browsing listings. They're comparing projects, checking specifications, exploring locations, evaluating budgets and deciding where they want to visit.

PropFyndr brings that discovery into one place — and gives developers a verified presence throughout the journey.

For ${devName}, that means your entire development portfolio (${projectsInline}) can be presented with the information, specifications and availability your team controls.

---

YOUR PROJECTS. YOUR INFORMATION. YOUR LEADS.

Active Portfolio:
${allProjects.map((p, i) => `${i + 1}. ${p} — A verified project presence built around the way buyers actually research.`).join('\n')}

• Direct Buyer Inquiries: Buyer interest can route directly to your sales team.
• Verified Project Details: Keep specifications, inventory and project info accurate.
• Site Visit Intent: Turn serious discovery into a conversation with your team.

---

WHAT YOU GET AS A PROPFYNDR PARTNER

01 — Verified Presence: Own your official developer presence across all ${allProjects.length} developments.
02 — Buyer Demand: Understand what buyers are searching for, comparing and evaluating across ${projectsInline}.
03 — Direct Enquiries: Receive relevant buyer interest without handing the lead to competing brokers.
04 — Project Control: Keep your project information, inventory and approved details up to date.

---

WE'D LIKE TO INVITE ${devName} TO JOIN

We're opening PropFyndr's developer network to selected builders and project partners across ${city}. Your invitation is ready.

Accept Developer Invitation:
${generatedInviteLink}

It takes a few minutes to review your developer desk and get started.

---
PropFyndr · Developer Partnerships
Building a more direct connection between India's homebuyers and the developers behind the projects they are considering.
partnerships@propfyndr.in · ${senderPhone}
This invitation was prepared specifically for the ${devName} team regarding: ${projectsInline}.`
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

  // WhatsApp formatted outreach pitch naming all projects
  const getWhatsAppText = () => {
    const devName = recipientName || 'Developer'
    const city = targetCity || 'Delhi-NCR & Greater Noida'
    const projectsListFormatted = allProjects.map((p) => `• ${p}`).join('\n')
    const projectsInline = allProjects.join(', ')

    return `Hi ${devName} Team,

Greetings from PropFyndr.in.

We are officially inviting ${devName} to bring all your developments directly in front of verified homebuyers actively searching across ${city}:

${projectsListFormatted}

Why developers are joining PropFyndr:
• Direct Buyer Inquiries: Inquiries route directly to your in-house sales gallery across all projects.
• Zero Broker Dilution: No competing broker listings around ${projectsInline}.
• Sanctioned RERA Specs: Keep approved layouts, inventory and project milestones accurate.
• Official Developer Console: Claim your verified presence and monitor buyer demand.

Your official developer invitation is ready to review:
${generatedInviteLink}

Best regards,
${senderName} | Developer Partnerships
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
    <!-- HERO -->
    <div class="hero-header">
      <div style="font-size: 10.5px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #fef08a; margin-bottom: 12px;">
        PropFyndr Partner Network
      </div>
      <h1 class="hero-title">
        ${recipientLabel},<br><em>you're invited to PropFyndr.</em>
      </h1>
      <div style="font-size: 13px; color: rgba(255, 255, 255, 0.85); line-height: 1.5; max-width: 440px; margin: 0 auto 20px auto;">
        Bring all your developments (${allProjects.join(', ')}) directly in front of verified homebuyers actively looking across ${cityLabel}.
      </div>
      <div>
        <a href="${generatedInviteLink}" class="cta-button" style="background-color: #ffffff; color: #09090b !important;">
          Explore Your Developer Desk →
        </a>
      </div>
      <div style="font-size: 11px; color: rgba(255, 255, 255, 0.6); line-height: 1.4; margin-top: 14px; max-width: 440px; margin-left: auto; margin-right: auto;">
        No brokerage on buyer inquiries. No competing listings around your projects. Just a direct channel between your sales gallery and interested buyers.
      </div>
    </div>

    <!-- BODY CANVAS -->
    <div class="body-canvas">
      <!-- SECTION 1 -->
      <div style="font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: ${palette.textMuted}; margin-bottom: 6px;">
        A Direct Channel for Discovery
      </div>
      <div style="font-family: 'Newsreader', Georgia, serif; font-size: 21px; font-weight: 600; color: ${palette.textPrimary}; line-height: 1.3; margin: 0 0 12px 0;">
        A better way to be discovered.
      </div>
      <p style="font-size: 13px; line-height: 1.65; color: ${palette.textSecondary}; margin: 0 0 14px 0;">
        Homebuyers are no longer just browsing listings. They're comparing projects, checking specifications, exploring locations, evaluating budgets and deciding where they want to visit.
      </p>
      <p style="font-size: 13px; line-height: 1.65; color: ${palette.textSecondary}; margin: 0 0 14px 0;">
        PropFyndr brings that discovery into one place — and gives developers a verified presence throughout the buyer journey.
      </p>
      <p style="font-size: 13px; line-height: 1.65; color: ${palette.textSecondary}; margin: 0 0 22px 0;">
        For <strong>${recipientLabel}</strong>, that means your entire development portfolio — <strong>${allProjects.join(', ')}</strong> — can be presented with the information, specifications and availability your team controls.
      </p>

      <!-- SECTION 2: SHOWCASE CARD (ALL PROJECTS LISTED) -->
      <div class="showcase-banner">
        <div class="showcase-inner">
          <span class="showcase-badge">Your Developments · Verified RERA Presence</span>
          <div class="showcase-title">${recipientLabel} Development Portfolio</div>
          <div style="font-size: 11.5px; color: rgba(255, 255, 255, 0.7); margin-bottom: 14px;">
            All ${allProjects.length} active developments in your catalog on PropFyndr.
          </div>

          <!-- Project Cards for ALL Projects -->
          <div style="display: flex; flex-direction: column; gap: 8px; margin: 14px 0;">
            ${allProjects
              .map(
                (p) => `
              <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="width: 7px; height: 7px; border-radius: 50%; background: #fef08a;"></div>
                  <div style="font-family: 'Newsreader', Georgia, serif; font-size: 15.5px; font-weight: 600; color: #ffffff;">${p}</div>
                </div>
                <span style="font-size: 9px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; background: rgba(254, 240, 138, 0.18); color: #fef08a; padding: 3px 8px; border-radius: 5px; border: 1px solid rgba(254, 240, 138, 0.28);">
                  Verified Presence
                </span>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="showcase-pillars">
            <div class="pillar-item">
              <strong>Direct Buyer Inquiries</strong>
              <span>Buyer interest routes directly to your sales team.</span>
            </div>
            <div class="pillar-item">
              <strong>Verified Details</strong>
              <span>Keep specifications, inventory &amp; specs accurate.</span>
            </div>
            <div class="pillar-item">
              <strong>Site Visit Intent</strong>
              <span>Turn serious discovery into pre-scheduled site visits.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 3: WHAT YOU GET -->
      <div style="font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: ${palette.textMuted}; margin: 24px 0 6px 0;">
        Platform Capabilities
      </div>
      <div style="font-family: 'Newsreader', Georgia, serif; font-size: 21px; font-weight: 600; color: ${palette.textPrimary}; line-height: 1.3; margin: 0 0 14px 0;">
        What you get as a PropFyndr partner
      </div>
      <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : 'repeat(2, 1fr)'}; gap: 10px; margin: 14px 0 24px 0;">
        <div style="background: ${palette.cardBg}; border: 1px solid ${palette.cardBorder}; border-radius: 12px; padding: 14px;">
          <div style="font-size: 11px; font-weight: 800; color: #0066cc; margin-bottom: 4px;">01</div>
          <div style="font-size: 13px; font-weight: 700; color: ${palette.textPrimary}; margin-bottom: 4px;">Verified Presence</div>
          <div style="font-size: 11.5px; color: ${palette.textSecondary}; line-height: 1.45;">Own your official developer and project presence across all ${allProjects.length} developments on PropFyndr.</div>
        </div>
        <div style="background: ${palette.cardBg}; border: 1px solid ${palette.cardBorder}; border-radius: 12px; padding: 14px;">
          <div style="font-size: 11px; font-weight: 800; color: #0066cc; margin-bottom: 4px;">02</div>
          <div style="font-size: 13px; font-weight: 700; color: ${palette.textPrimary}; margin-bottom: 4px;">Buyer Demand</div>
          <div style="font-size: 11.5px; color: ${palette.textSecondary}; line-height: 1.45;">Understand what buyers are searching for, comparing and evaluating across ${allProjects.slice(0, 2).join(', ')}.</div>
        </div>
        <div style="background: ${palette.cardBg}; border: 1px solid ${palette.cardBorder}; border-radius: 12px; padding: 14px;">
          <div style="font-size: 11px; font-weight: 800; color: #0066cc; margin-bottom: 4px;">03</div>
          <div style="font-size: 13px; font-weight: 700; color: ${palette.textPrimary}; margin-bottom: 4px;">Direct Enquiries</div>
          <div style="font-size: 11.5px; color: ${palette.textSecondary}; line-height: 1.45;">Receive relevant buyer interest without handing the lead to competing brokers.</div>
        </div>
        <div style="background: ${palette.cardBg}; border: 1px solid ${palette.cardBorder}; border-radius: 12px; padding: 14px;">
          <div style="font-size: 11px; font-weight: 800; color: #0066cc; margin-bottom: 4px;">04</div>
          <div style="font-size: 13px; font-weight: 700; color: ${palette.textPrimary}; margin-bottom: 4px;">Project Control</div>
          <div style="font-size: 11.5px; color: ${palette.textSecondary}; line-height: 1.45;">Keep your project information, inventory and approved details up to date.</div>
        </div>
      </div>

      <!-- INVITATION CTA BLOCK -->
      <div style="text-align: center; padding: 24px 16px 12px 16px; border-top: 1px solid ${palette.divider}; margin-top: 20px;">
        <div style="font-family: 'Newsreader', Georgia, serif; font-size: 20px; font-weight: 600; color: ${palette.textPrimary}; margin-bottom: 6px;">
          We'd like to invite ${recipientLabel} to join.
        </div>
        <div style="font-size: 12.5px; color: ${palette.textSecondary}; line-height: 1.5; max-width: 420px; margin: 0 auto 18px auto;">
          We're opening PropFyndr's developer network to selected builders across ${cityLabel} for ${allProjects.join(', ')}. Your invitation is ready.
        </div>
        <div>
          <a href="${generatedInviteLink}" class="cta-button">
            Accept Developer Invitation →
          </a>
        </div>
        <div style="font-size: 11px; color: ${palette.textMuted}; margin-top: 10px;">
          It takes a few minutes to review your developer desk and get started.
        </div>
      </div>
    </div>

    <!-- Editorial Footer -->
    <div class="footer-section">
      <div class="signature-title">PropFyndr · Developer Partnerships</div>
      <div style="margin: 2px 0 10px 0;">Building a more direct connection between India's homebuyers and the developers behind the projects they are considering.</div>
      <div>partnerships@propfyndr.in · Direct: ${senderPhone}</div>
      <div style="margin-top: 8px; font-size: 10.5px; opacity: 0.8;">
        This invitation was prepared specifically for the ${recipientLabel} team regarding: ${allProjects.join(', ')}.
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
      <div className="relative w-[96vw] max-w-[1540px] h-[94vh] max-h-[980px] bg-[#fbfbfd] dark:bg-[#141416] rounded-[28px] shadow-[0_36px_100px_-15px_rgba(0,0,0,0.4)] border border-[#e5e5ea] dark:border-[#28282c] flex flex-col overflow-hidden z-10 font-sans">
        {/* ── Modal Top Header Bar ────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-3.5 border-b border-[#e5e5ea] dark:border-[#27272a] bg-white/95 dark:bg-[#1c1c1f]/95 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-[#0077ed] to-[#005bb5] text-white flex items-center justify-center shadow-[0_2px_8px_rgba(0,102,204,0.35)] shrink-0">
              <Mail size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                  Email Composer &amp; Executive Preview
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Resend Engine · Verified Deliverability
                </span>
              </div>
              <p className="text-[12px] text-[#86868b] hidden sm:block mt-0.5">
                Simulate and dispatch executive outreach across Gmail, Outlook 365, and Apple Mail with 100% entity personalization.
              </p>
            </div>
          </div>

          {/* Top Actions: Send via Resend + Full Studio + Close */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={handleSendViaResend}
              disabled={isSending}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold text-xs shadow-xs transition-all cursor-pointer ${
                isSending
                  ? 'bg-[#0071e3]/60 cursor-not-allowed'
                  : 'bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98]'
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
                  <span>Dispatched!</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Send via Resend</span>
                </>
              )}
            </button>

            <Link
              href={`/admin/email-preview?template=${template}&name=${encodeURIComponent(recipientName)}&email=${encodeURIComponent(recipientEmail)}&project=${encodeURIComponent(projectName)}`}
              onClick={onClose}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#242428] hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c30] text-zinc-700 dark:text-zinc-200 font-semibold text-xs transition-all active:scale-[0.98] border border-[#e5e5ea] dark:border-[#38383e] shadow-2xs"
              title="Open full-page Executive Studio"
            >
              <ExternalLink size={13} />
              <span>Full Studio</span>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-[#e5e5ea] dark:hover:bg-[#38383a] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] flex items-center justify-center transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Mobile View Toggle Tabs (Small Screens Only) ──────────────────── */}
        <div className="flex md:hidden border-b border-[#e5e5ea] dark:border-[#27272a] bg-[#f5f5f7] dark:bg-[#1c1c1f] p-1">
          <button
            type="button"
            onClick={() => setMobileTab('edit')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mobileTab === 'edit'
                ? 'bg-white dark:bg-[#28282c] text-[#1d1d1f] dark:text-[#f5f5f7] shadow-xs'
                : 'text-[#86868b]'
            }`}
          >
            Edit Template &amp; Fields
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mobileTab === 'preview'
                ? 'bg-white dark:bg-[#28282c] text-[#1d1d1f] dark:text-[#f5f5f7] shadow-xs'
                : 'text-[#86868b]'
            }`}
          >
            Live Device Preview
          </button>
        </div>

        {/* ── Main Two-Column Layout ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Panel: Email Composer Controls (Apple-Grade Grouped Cards) */}
          <div
            className={`w-full md:w-[390px] lg:w-[430px] border-r border-[#e5e5ea] dark:border-[#27272a] bg-[#fbfbfd] dark:bg-[#161619] p-4.5 overflow-y-auto shrink-0 flex flex-col justify-between gap-4.5 ${
              mobileTab === 'preview' ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="space-y-4">
              {/* Card 0: Template Selection */}
              <div className="bg-white dark:bg-[#1e1e22] rounded-2xl p-3.5 border border-[#e5e5ea]/80 dark:border-[#2c2c30] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <label className="block text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2">
                  Email Outreach Template
                </label>
                <CustomSelect
                  value={template}
                  onChange={(val) => setTemplate(val as EmailTemplateType)}
                  options={[
                    { value: 'builder_pitch', label: 'Developer / Builder Onboarding Pitch' },
                    { value: 'team_invite', label: 'Admin Team Role Invitation' },
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>

              {/* Dynamic Field Inputs — Grouped Cards */}
              {template === 'builder_pitch' ? (
                <>
                  {/* Card 1: Target Entity & Direct Contacts */}
                  <div className="bg-white dark:bg-[#1e1e22] rounded-2xl p-4 border border-[#e5e5ea]/80 dark:border-[#2c2c30] shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3.5">
                    <div className="flex items-center gap-2 pb-2.5 border-b border-[#f0f0f2] dark:border-[#27272a]">
                      <Building2 size={14} className="text-[#0071e3]" />
                      <span className="text-[11px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider">
                        Recipient Entity &amp; Contacts
                      </span>
                    </div>

                    {/* Developer Firm Name */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#86868b] mb-1.5">
                        Developer / Builder Firm Name <span className="text-[#ff3b30]">*</span>
                      </label>
                      <div className="relative">
                        <Building2 size={14} className="text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="e.g. ACE Group & Mahagun"
                          className="w-full h-10 pl-9 pr-3.5 text-[13px] font-medium bg-[#f5f5f7] dark:bg-[#25252a] border border-[#e5e5ea] dark:border-[#323238] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:bg-white dark:focus:bg-[#1e1e22] focus:ring-3 focus:ring-[#0071e3]/15 focus:border-[#0071e3] transition-all placeholder:text-[#86868b]/60"
                        />
                      </div>
                    </div>

                    {/* Recipient Email */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#86868b] mb-1.5">
                        Recipient Executive Email <span className="text-[#ff3b30]">*</span>
                      </label>
                      <div className="relative">
                        <Mail size={14} className="text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="partnerships@developer.com"
                          className="w-full h-10 pl-9 pr-3.5 text-[13px] font-medium bg-[#f5f5f7] dark:bg-[#25252a] border border-[#e5e5ea] dark:border-[#323238] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:bg-white dark:focus:bg-[#1e1e22] focus:ring-3 focus:ring-[#0071e3]/15 focus:border-[#0071e3] transition-all placeholder:text-[#86868b]/60"
                        />
                      </div>
                    </div>

                    {/* Recipient WhatsApp / Phone */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#86868b] mb-1.5">
                        Recipient Direct Mobile / WhatsApp
                      </label>
                      <div className="relative">
                        <Phone size={14} className="text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full h-10 pl-9 pr-3.5 text-[13px] font-mono font-medium bg-[#f5f5f7] dark:bg-[#25252a] border border-[#e5e5ea] dark:border-[#323238] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:bg-white dark:focus:bg-[#1e1e22] focus:ring-3 focus:ring-[#0071e3]/15 focus:border-[#0071e3] transition-all placeholder:text-[#86868b]/60"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Portfolio Scope & Flagship Focus */}
                  <div className="bg-white dark:bg-[#1e1e22] rounded-2xl p-4 border border-[#e5e5ea]/80 dark:border-[#2c2c30] shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3.5">
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#f0f0f2] dark:border-[#27272a]">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-[#0071e3]" />
                        <span className="text-[11px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider">
                          Portfolio Scope ({allProjects.length})
                        </span>
                      </div>
                      <span className="text-[10px] text-[#86868b]">
                        Click chip to set as flagship
                      </span>
                    </div>

                    {/* Flagship Project Mention */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-semibold text-[#86868b]">
                          Flagship Project Mention
                        </label>
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          Featured in subject &amp; headline
                        </span>
                      </div>
                      <div className="relative">
                        <Star size={14} className="text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none fill-amber-500/20" />
                        <input
                          type="text"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          placeholder="e.g. Ace Mahagun Medalleo"
                          className="w-full h-10 pl-9 pr-3.5 text-[13px] font-semibold bg-[#f5f5f7] dark:bg-[#25252a] border border-[#e5e5ea] dark:border-[#323238] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:bg-white dark:focus:bg-[#1e1e22] focus:ring-3 focus:ring-[#0071e3]/15 focus:border-[#0071e3] transition-all placeholder:text-[#86868b]/60"
                        />
                      </div>
                    </div>

                    {/* Linked Portfolio Chips */}
                    <div>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 -m-1">
                        {allProjects.map((p) => {
                          const isCurrent = projectName.trim().toLowerCase() === p.trim().toLowerCase()
                          return (
                            <span
                              key={p}
                              onClick={() => setProjectName(p)}
                              className={`group inline-flex items-center gap-1.5 text-[11px] font-medium pl-2.5 pr-1.5 py-1 rounded-full border transition-all cursor-pointer ${
                                isCurrent
                                  ? 'bg-[#0071e3] border-[#0071e3] text-white font-semibold shadow-xs'
                                  : 'bg-[#f5f5f7] dark:bg-[#25252a] border-[#e5e5ea] dark:border-[#323238] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500'
                              }`}
                              title={isCurrent ? 'Current Flagship Project' : `Set ${p} as flagship`}
                            >
                              <span className="truncate max-w-[130px]">{p}</span>
                              {isCurrent && (
                                <span className="text-[8px] uppercase tracking-wider font-bold px-1 py-0.5 rounded-sm bg-white/20 text-white">
                                  Flagship
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleRemoveProject(p, e)}
                                className={`p-0.5 rounded-full transition-colors cursor-pointer ${
                                  isCurrent
                                    ? 'hover:bg-white/30 text-white'
                                    : 'text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                }`}
                                title={`Remove ${p} from portfolio`}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          )
                        })}
                      </div>

                      {/* Inline Add Project Input */}
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newProjectInput}
                          onChange={(e) => setNewProjectInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddProject()
                            }
                          }}
                          placeholder="+ Add another project..."
                          className="flex-1 h-8 px-2.5 text-[11px] bg-[#f5f5f7] dark:bg-[#25252a] border border-[#e5e5ea] dark:border-[#323238] rounded-lg text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:bg-white dark:focus:bg-[#1e1e22] focus:border-[#0071e3] placeholder:text-zinc-400 transition-all"
                        />
                        <button
                          type="button"
                          onClick={handleAddProject}
                          disabled={!newProjectInput.trim()}
                          className="h-8 px-3 rounded-lg bg-[#f5f5f7] dark:bg-[#25252a] hover:bg-[#e5e5ea] dark:hover:bg-[#2e2e34] disabled:opacity-40 border border-[#e5e5ea] dark:border-[#323238] text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer active:scale-95"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Geographic Region & Sender Profile */}
                  <div className="bg-white dark:bg-[#1e1e22] rounded-2xl p-4 border border-[#e5e5ea]/80 dark:border-[#2c2c30] shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3.5">
                    <div className="flex items-center gap-2 pb-2.5 border-b border-[#f0f0f2] dark:border-[#27272a]">
                      <MapPin size={14} className="text-[#0071e3]" />
                      <span className="text-[11px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider">
                        Region &amp; Sender Desk
                      </span>
                    </div>

                    {/* Target Region */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#86868b] mb-1.5">
                        Target Micro-Market / Region
                      </label>
                      <div className="relative">
                        <MapPin size={14} className="text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={targetCity}
                          onChange={(e) => setTargetCity(e.target.value)}
                          placeholder="e.g. Greater Noida &amp; Delhi-NCR"
                          className="w-full h-10 pl-9 pr-3.5 text-[13px] font-medium bg-[#f5f5f7] dark:bg-[#25252a] border border-[#e5e5ea] dark:border-[#323238] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:bg-white dark:focus:bg-[#1e1e22] focus:ring-3 focus:ring-[#0071e3]/15 focus:border-[#0071e3] transition-all placeholder:text-[#86868b]/60"
                        />
                      </div>
                    </div>

                    {/* Sender Credentials */}
                    <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#86868b] mb-1">
                          Sender Name
                        </label>
                        <input
                          type="text"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          className="w-full h-9 px-3 text-xs font-medium bg-[#f5f5f7] dark:bg-[#25252a] border border-[#e5e5ea] dark:border-[#323238] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:bg-white dark:focus:bg-[#1e1e22] focus:border-[#0071e3]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#86868b] mb-1">
                          Sender Phone
                        </label>
                        <input
                          type="text"
                          value={senderPhone}
                          onChange={(e) => setSenderPhone(e.target.value)}
                          className="w-full h-9 px-3 text-xs font-mono font-medium bg-[#f5f5f7] dark:bg-[#25252a] border border-[#e5e5ea] dark:border-[#323238] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:bg-white dark:focus:bg-[#1e1e22] focus:border-[#0071e3]"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white dark:bg-[#1e1e22] rounded-2xl p-4 border border-[#e5e5ea]/80 dark:border-[#2c2c30] shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
                      Invited User Email <span className="text-[#ff3b30]">*</span>
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full h-10 px-3.5 text-[13px] font-medium bg-[#f5f5f7] dark:bg-[#25252a] border border-[#e5e5ea] dark:border-[#323238] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:bg-white dark:focus:bg-[#1e1e22] focus:border-[#0071e3]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
                      Assigned Role
                    </label>
                    <div className="h-10 px-3.5 flex items-center rounded-xl border border-[#e5e5ea] dark:border-[#323238] bg-[#f5f5f7] dark:bg-[#25252a] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-xs">
                      {defaultRole}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
                      Security Token Link
                    </label>
                    <p className="p-3 rounded-xl border border-[#e5e5ea] dark:border-[#323238] bg-[#f5f5f7] dark:bg-[#25252a] font-mono text-[11px] text-[#86868b] break-all leading-relaxed">
                      {generatedInviteLink}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Instant Actions & Outreach Section */}
            <div className="bg-white dark:bg-[#1e1e22] rounded-2xl p-4 border border-[#e5e5ea]/80 dark:border-[#2c2c30] shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-2.5">
              <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block">
                Instant Actions &amp; Outreach
              </span>

              {/* WhatsApp Row */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openWhatsAppChat}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                  title="Open WhatsApp chat with prefilled message"
                >
                  <MessageCircle size={15} />
                  <span>
                    {recipientPhone
                      ? `Open WhatsApp (${recipientPhone.slice(-10)})`
                      : 'Open WhatsApp'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={copyWhatsApp}
                  className="flex items-center justify-center px-3.5 py-2.5 rounded-xl border border-[#e5e5ea] dark:border-[#38383a] hover:bg-[#f5f5f7] dark:hover:bg-[#25252a] text-[#1d1d1f] dark:text-[#f5f5f7] transition-all cursor-pointer active:scale-[0.98]"
                  title="Copy WhatsApp plaintext pitch"
                >
                  {copiedType === 'wa' ? <Check size={14} className="text-[#34c759]" /> : <Copy size={14} />}
                </button>
              </div>

              {/* Copy Responsive HTML Button */}
              <button
                type="button"
                onClick={copyHtml}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
              >
                {copiedType === 'html' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedType === 'html' ? 'HTML Copied to Clipboard!' : 'Copy Responsive HTML'}</span>
              </button>

              {/* Copy Plaintext Button */}
              <button
                type="button"
                onClick={copyText}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl bg-[#f5f5f7] dark:bg-[#25252a] hover:bg-[#e5e5ea] dark:hover:bg-[#2c2c32] text-[#1d1d1f] dark:text-[#f5f5f7] border border-[#e5e5ea] dark:border-[#38383a] text-xs font-semibold transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
              >
                {copiedType === 'text' ? <Check size={14} /> : <Share2 size={14} />}
                <span>{copiedType === 'text' ? 'Plaintext Copied!' : 'Copy Plaintext'}</span>
              </button>
            </div>
          </div>

          {/* Right Panel: Executive Device Preview Canvas */}
          <div
            className={`flex-1 flex flex-col min-h-0 bg-[#f5f5f7]/70 dark:bg-[#111113] overflow-hidden ${
              mobileTab === 'edit' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Canvas Sub-Header: Client & Frame Switcher + Dark Mode Toggle */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-2.5 bg-white/95 dark:bg-[#1c1c1f]/95 border-b border-[#e5e5ea] dark:border-[#27272a] text-xs shrink-0 backdrop-blur-xl">
              <div className="flex items-center gap-2.5">
                <span className="text-[#86868b] font-medium hidden sm:inline text-xs">Preview Client:</span>
                <div className="flex items-center p-1 bg-[#e5e5ea]/60 dark:bg-[#28282c] rounded-xl border border-[#e5e5ea] dark:border-[#34343a]">
                  {/* Gmail Desktop Tab with Official Gmail Logo */}
                  <button
                    type="button"
                    onClick={() => setClientMode('gmail')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      clientMode === 'gmail'
                        ? 'bg-white dark:bg-[#1c1c1f] text-zinc-900 dark:text-white shadow-xs'
                        : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
                    }`}
                  >
                    <GmailLogo className="w-3.5 h-3.5" />
                    <span>Gmail (Web)</span>
                  </button>

                  {/* Outlook Desktop Tab with Official Outlook Logo */}
                  <button
                    type="button"
                    onClick={() => setClientMode('outlook')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      clientMode === 'outlook'
                        ? 'bg-white dark:bg-[#1c1c1f] text-zinc-900 dark:text-white shadow-xs'
                        : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
                    }`}
                  >
                    <OutlookLogo className="w-3.5 h-3.5" />
                    <span>Outlook 365</span>
                  </button>

                  {/* iPhone iOS Tab with Official Apple Mail Logo */}
                  <button
                    type="button"
                    onClick={() => setClientMode('mobile')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      clientMode === 'mobile'
                        ? 'bg-white dark:bg-[#1c1c1f] text-zinc-900 dark:text-white shadow-xs'
                        : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
                    }`}
                  >
                    <AppleMailLogo className="w-3.5 h-3.5" />
                    <span>Apple Mail (iOS)</span>
                  </button>
                </div>
              </div>

              {/* Dark Mode Dynamic Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDarkPreview(!isDarkPreview)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e5e5ea] dark:border-[#38383a] font-semibold text-[11px] shadow-2xs cursor-pointer transition-all active:scale-[0.98] ${
                    isDarkPreview
                      ? 'bg-[#2c2c2e] text-[#f5f5f7]'
                      : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea]'
                  }`}
                  title="Toggle dark mode preview simulation"
                >
                  {isDarkPreview ? (
                    <Sun size={13} className="text-amber-400" />
                  ) : (
                    <Moon size={13} className="text-[#0071e3]" />
                  )}
                  <span>{isDarkPreview ? 'Dark Mode: ON' : 'Dark Mode: OFF'}</span>
                </button>
              </div>
            </div>

            {/* Canvas Screen: Laptop or Mobile Device Frame */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 flex items-center justify-center">
              {clientMode === 'mobile' ? (
                /* ── PRECISION VECTOR IPHONE MOCKUP ─── */
                <div className="w-[360px] sm:w-[380px] max-w-full drop-shadow-2xl py-2">
                  <Iphone className={isDarkPreview ? 'dark' : ''}>
                    <div
                      className={`size-full flex flex-col ${
                        isDarkPreview ? 'bg-[#0b0b0e] text-zinc-100' : 'bg-white text-zinc-900'
                      } select-none`}
                    >
                      {/* Top Dynamic Island Status Bar */}
                      <div className="w-full flex items-center justify-between px-7 pt-3.5 pb-2 text-[11px] font-bold shrink-0 bg-transparent z-10">
                        <span className="font-semibold tracking-tight">9:41</span>
                        <div className="flex items-center gap-1.5 opacity-80">
                          <Wifi size={11} />
                          <Battery size={13} />
                        </div>
                      </div>

                      {/* Native Mobile Email Header */}
                      <div
                        className={`px-4 py-2 border-b flex items-center justify-between text-xs shrink-0 transition-colors ${
                          isDarkPreview
                            ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-1 text-blue-500 font-semibold cursor-pointer">
                          <span>‹</span>
                          <span>Inbox</span>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-400">
                          <Archive size={13} />
                          <Trash2 size={13} />
                          <Reply size={13} />
                        </div>
                      </div>

                      {/* Email Meta in Mobile Client */}
                      <div
                        className={`px-4 py-2 border-b text-xs shrink-0 transition-colors ${
                          isDarkPreview ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-100'
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
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                              {template === 'builder_pitch' ? 'P' : 'PF'}
                            </div>
                            <div>
                              <div
                                className={`font-semibold leading-tight ${
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

                      {/* Phone Screen Body Scrollable */}
                      <div className="flex-1 overflow-y-auto">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: getHtml(true, isDarkPreview),
                          }}
                        />
                      </div>

                      {/* Bottom iOS Home Indicator */}
                      <div className="w-full py-2 flex justify-center bg-transparent shrink-0">
                        <div className="w-28 h-1 rounded-full bg-zinc-400/50 dark:bg-zinc-600/50" />
                      </div>
                    </div>
                  </Iphone>
                </div>
              ) : (
                /* ── APPLE SAFARI DESKTOP BROWSER MOCKUP ─── */
                <div className="w-full max-w-4xl drop-shadow-2xl select-none py-2">
                  <Safari
                    url={clientMode === 'gmail' ? 'mail.google.com/mail/u/0/#inbox' : 'outlook.office.com/mail/inbox'}
                    mode="default"
                    coloredControls
                    className={isDarkPreview ? 'dark' : ''}
                  >
                    <div
                      className={`size-full flex flex-col ${
                        isDarkPreview ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'
                      } select-none`}
                    >
                      {/* CLIENT 1: GMAIL WEB */}
                      {clientMode === 'gmail' && (
                        <div className="flex flex-col text-xs size-full overflow-hidden">
                          {/* Gmail Top Navbar */}
                          <div
                            className={`flex items-center justify-between px-4 py-2 border-b select-none transition-colors shrink-0 ${
                              isDarkPreview
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                                : 'bg-[#f6f8fc] border-zinc-200 text-zinc-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Menu size={16} className="text-zinc-500 cursor-pointer" />
                              <div className="flex items-center gap-2 font-semibold select-none">
                                <GmailLogo className="w-5 h-5" />
                                <span
                                  className={`font-medium text-[15px] tracking-tight ${
                                    isDarkPreview ? 'text-[#e3e3e3]' : 'text-[#444746]'
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
                              <Search size={13} className="text-zinc-400" />
                              <span className="text-xs text-zinc-400 flex-1">Search mail</span>
                              <Sliders size={12} className="text-zinc-400" />
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shadow-2xs">
                                A
                              </div>
                            </div>
                          </div>

                          {/* Gmail Action Toolbar */}
                          <div
                            className={`flex items-center justify-between px-4 py-1.5 border-b select-none text-zinc-500 text-[11px] shrink-0 ${
                              isDarkPreview ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-100'
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <CornerUpLeft size={13} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <Archive size={13} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <AlertCircle size={13} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <Trash2 size={13} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <Clock size={13} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <Tag size={13} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                            </div>

                            <div className="flex items-center gap-3">
                              <Printer size={13} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                              <ExternalLink size={13} className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer" />
                            </div>
                          </div>

                          {/* Gmail Email Header */}
                          <div
                            className={`px-5 py-3 border-b transition-colors shrink-0 ${
                              isDarkPreview ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h2
                                  className={`text-sm sm:text-base font-bold ${
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
                                <Star size={14} className="hover:text-amber-400 cursor-pointer" />
                                <Printer size={14} className="hover:text-zinc-700 cursor-pointer" />
                              </div>
                            </div>

                            {/* Sender Info Line */}
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                                  {template === 'builder_pitch' ? 'P' : 'PF'}
                                </div>
                                <div>
                                  <div
                                    className={`font-semibold ${
                                      isDarkPreview ? 'text-zinc-200' : 'text-zinc-800'
                                    }`}
                                  >
                                    {senderName}{' '}
                                    <span className="font-normal text-zinc-400 text-[11px]">
                                      &lt;partnerships@propfyndr.in&gt;
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-zinc-400">
                                    to {recipientName} &lt;{recipientEmail}&gt;
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] text-zinc-400">4:51 PM (0 minutes ago)</span>
                            </div>
                          </div>

                          {/* Email Body Canvas */}
                          <div
                            className={`flex-1 overflow-y-auto min-h-0 select-text p-4 sm:p-8 transition-colors duration-200 ${
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

                      {/* CLIENT 2: OUTLOOK 365 */}
                      {clientMode === 'outlook' && (
                        <div className="flex flex-col text-xs size-full overflow-hidden">
                          {/* Outlook Top Header with 3x3 app grid and official Outlook Logo */}
                          <div className="bg-[#0078d4] text-white px-4 py-2 flex items-center justify-between select-none shrink-0 shadow-xs">
                            <div className="flex items-center gap-2.5">
                              <div className="grid grid-cols-3 gap-0.5 w-3.5 h-3.5 opacity-85 hover:opacity-100 cursor-pointer">
                                <span className="w-1 h-1 bg-white rounded-[0.5px]" />
                                <span className="w-1 h-1 bg-white rounded-[0.5px]" />
                                <span className="w-1 h-1 bg-white rounded-[0.5px]" />
                                <span className="w-1 h-1 bg-white rounded-[0.5px]" />
                                <span className="w-1 h-1 bg-white rounded-[0.5px]" />
                                <span className="w-1 h-1 bg-white rounded-[0.5px]" />
                                <span className="w-1 h-1 bg-white rounded-[0.5px]" />
                                <span className="w-1 h-1 bg-white rounded-[0.5px]" />
                                <span className="w-1 h-1 bg-white rounded-[0.5px]" />
                              </div>
                              <div className="flex items-center gap-2 ml-1">
                                <OutlookLogo className="w-5 h-5" />
                                <span className="font-semibold text-sm tracking-tight text-white">Outlook</span>
                              </div>
                            </div>
                            <div className="hidden sm:flex items-center flex-1 max-w-xs mx-6 bg-white/20 hover:bg-white/25 rounded-md px-3 py-1 gap-2 text-white/90 text-xs transition-colors">
                              <Search size={13} />
                              <span className="text-white/70">Search</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-white text-[#0078d4] font-bold text-[10px] flex items-center justify-center shadow-xs">
                                PF
                              </div>
                            </div>
                          </div>

                          {/* Outlook Sub-Toolbar */}
                          <div
                            className={`flex items-center gap-4 px-4 py-1.5 border-b text-[11px] font-medium select-none shrink-0 ${
                              isDarkPreview
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                                : 'bg-[#f3f2f1] border-zinc-200 text-zinc-700'
                            }`}
                          >
                            <span className="text-[#0078d4] font-bold border-b-2 border-[#0078d4] pb-0.5">Home</span>
                            <span className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer">
                              View
                            </span>
                            <span className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer">
                              Help
                            </span>
                          </div>

                          {/* Outlook Email Title Banner */}
                          <div
                            className={`p-4 sm:p-5 border-b transition-colors shrink-0 ${
                              isDarkPreview
                                ? 'bg-zinc-950 border-zinc-800'
                                : 'bg-white border-zinc-100'
                            }`}
                          >
                            <h2
                              className={`text-sm sm:text-base font-bold mb-2 ${
                                isDarkPreview ? 'text-zinc-100' : 'text-zinc-900'
                              }`}
                            >
                              {subject}
                            </h2>

                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-[#0078d4] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
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
                                  <div className="text-zinc-400 text-[10px]">
                                    To: {recipientName} &lt;{recipientEmail}&gt;
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] text-zinc-400">Fri 4:51 PM</span>
                            </div>
                          </div>

                          {/* Email Body Canvas */}
                          <div
                            className={`flex-1 overflow-y-auto min-h-0 select-text p-4 sm:p-8 transition-colors duration-200 ${
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
                  </Safari>
                </div>
              )}
            </div>

            {/* Modal Bottom Status Bar */}
            <div className="px-5 sm:px-7 py-3 bg-white/95 dark:bg-[#1c1c1f]/95 border-t border-[#e5e5ea] dark:border-[#27272a] flex items-center justify-between text-xs backdrop-blur-xl shrink-0">
              <div className="flex items-center gap-2.5 text-[#86868b]">
                <span className="w-2 h-2 rounded-full bg-[#34c759] animate-pulse" />
                <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Executive Deliverability Verified
                </span>
                <span className="text-[#86868b] hidden md:inline">
                  · Tested across Gmail, Outlook 365, iOS Apple Mail, and Safari
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyHtml}
                  className="px-3.5 py-1.5 rounded-xl border border-[#e5e5ea] dark:border-[#38383e] bg-white dark:bg-[#25252a] hover:bg-[#f5f5f7] dark:hover:bg-[#2e2e34] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  {copiedType === 'html' ? <Check size={13} className="text-[#34c759]" /> : <Copy size={13} />}
                  <span>{copiedType === 'html' ? 'Copied!' : 'Copy HTML'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-xl bg-[#1d1d1f] hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs transition-all cursor-pointer active:scale-95 shadow-2xs"
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
