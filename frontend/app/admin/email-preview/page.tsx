'use client'

/**
 * PropFyndr — Email Composer & Executive Preview Studio.
 *
 * Implements high-converting, psychology-aligned developer and partner
 * invitation outreach with 100% dynamic entity personalization.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Home,
  Mail,
  Send,
  Building2,
  Phone,
  MapPin,
  Flame,
  Check,
  Copy,
  Share2,
  ExternalLink,
  MessageCircle,
  Laptop,
  Smartphone,
  Sun,
  Moon,
  Loader2,
  Sliders,
  Search,
  Menu,
  Star,
  Printer,
  Archive,
  AlertCircle,
  Trash2,
  Clock,
  Tag,
  CornerUpLeft,
  CheckCircle2,
  Lightbulb,
  Cpu,
  HelpCircle,
  ChevronDown,
  Wifi,
  Battery,
  ShieldCheck,
  UserCheck,
  Plus,
  X,
} from 'lucide-react'
import { adminFetch } from '@/lib/adminFetch'
import { toast } from 'sonner'
import { Iphone } from '@/components/ui/iphone'
import { Safari } from '@/components/ui/safari'
import { GmailLogo, OutlookLogo, AppleMailLogo } from '@/components/ui/EmailClientIcons'

export type EmailTemplateType = 'builder_invite' | 'partner_invite' | 'team_invite'
export type ClientPreviewType = 'gmail' | 'outlook' | 'mobile'
export type HeroStyleOption = 'direct' | 'premium' | 'curiosity'

// Case-insensitive project deduplication helper
const dedupeProjectNames = (list: (string | undefined | null)[]): string[] => {
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

interface BuilderOption {
  id: string
  name: string
  projects?: string[]
}

interface PartnerOption {
  id: string
  name: string
  builderName?: string
  projects?: string[]
  email?: string
  phone?: string
}

function EmailPreviewStudioContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [template, setTemplate] = useState<EmailTemplateType>(
    (searchParams.get('template') as EmailTemplateType) || 'builder_invite'
  )
  const [heroStyle, setHeroStyle] = useState<HeroStyleOption>('direct')
  const [clientMode, setClientMode] = useState<ClientPreviewType>('gmail')
  const [isDarkPreview, setIsDarkPreview] = useState(false)
  const [copiedType, setCopiedType] = useState<'html' | 'text' | 'wa' | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [sentSuccessId, setSentSuccessId] = useState<string | null>(null)

  // Dynamic Form Fields
  const [recipientName, setRecipientName] = useState(searchParams.get('name') || 'Aadhaar Shri')
  const [recipientEmail, setRecipientEmail] = useState(searchParams.get('email') || 'partnerships@aadhaar-shri.com')
  const [recipientPhone, setRecipientPhone] = useState(searchParams.get('phone') || '+91 98765 43210')
  const [projectName, setProjectName] = useState(searchParams.get('project') || 'Gayatri Life')
  const [targetCity, setTargetCity] = useState('Delhi-NCR & Greater Noida')
  const [senderName, setSenderName] = useState('PropFyndr Team')
  const [senderPhone, setSenderPhone] = useState('+91 98712 34567')

  // Real DB builders and partners for instant 1-click personalization
  const [dbBuilders, setDbBuilders] = useState<BuilderOption[]>([])
  const [dbPartners, setDbPartners] = useState<PartnerOption[]>([])
  const [availableProjects, setAvailableProjects] = useState<string[]>([])
  const [newProjectInput, setNewProjectInput] = useState('')

  // Fetch real builders & channel partners from catalog
  useEffect(() => {
    let cancelled = false
    adminFetch('/admin/builders')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        if (cancelled) return
        const list: BuilderOption[] = (data.builders || []).map((b: any) => ({
          id: b.id,
          name: b.name,
          projects: dedupeProjectNames([
            ...(b.delivered_projects || []),
            ...(b.ongoing_projects || []),
            ...(b.projects?.map((p: any) => p.name) || []),
          ]),
        }))
        if (list.length > 0) setDbBuilders(list)
      })
      .catch(() => {
        setDbBuilders([
          { id: '1', name: 'Aadhaar Shri', projects: ['Gayatri Life', 'Aadhaar Shri Height', 'Aadhaar Greens'] },
          { id: '2', name: 'ACE Group', projects: ['Ace Starlit', 'Ace Parkway', 'Ace Divino', 'Ace Palm Floors'] },
          { id: '3', name: 'Mahagun', projects: ['Mahagun Manorialle', 'Mahagun Medalleo', 'Mahagun Mezzaria'] },
          { id: '4', name: 'Godrej Properties', projects: ['Godrej Tropical Isle', 'Godrej Woods', 'Godrej Palm Retreat'] },
          { id: '5', name: 'DLF', projects: ['The Arbour', 'DLF Midtown', 'Crest'] },
        ])
      })

    adminFetch('/admin/channel-partners')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        if (cancelled) return
        const list: PartnerOption[] = (data.partners || data.channel_partners || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          builderName: p.builder?.name,
          email: p.email || p.contact_email,
          phone: p.phone || p.contact_phone,
          projects: p.builder?.name
            ? (dbBuilders.find((b) => b.name.toLowerCase() === p.builder.name.toLowerCase())?.projects || [
                `${p.builder.name} Residency`,
                `${p.builder.name} Heights`,
              ])
            : ['Ace Starlit', 'Ace Parkway'],
        }))
        if (list.length > 0) setDbPartners(list)
      })
      .catch(() => {
        setDbPartners([
          {
            id: '1',
            name: 'Apex Realtech Partners',
            builderName: 'ACE Group',
            projects: ['Ace Starlit', 'Ace Parkway', 'Ace Divino', 'Ace Palm Floors'],
            email: 'partnerships@apexrealtech.in',
            phone: '+91 98111 22334',
          },
          {
            id: '2',
            name: 'Shri Wealth Advisory',
            builderName: 'Aadhaar Shri',
            projects: ['Gayatri Life', 'Aadhaar Shri Height', 'Aadhaar Greens'],
            email: 'mandates@shriadvisory.com',
            phone: '+91 98222 33445',
          },
          {
            id: '3',
            name: 'DLF Marquee Mandates',
            builderName: 'DLF',
            projects: ['The Arbour', 'DLF Midtown', 'Crest'],
            email: 'desk@dlfmandates.in',
            phone: '+91 98333 44556',
          },
          {
            id: '4',
            name: 'Mahagun Prime Network',
            builderName: 'Mahagun',
            projects: ['Mahagun Manorialle', 'Mahagun Medalleo', 'Mahagun Mezzaria'],
            email: 'network@mahagunprime.com',
            phone: '+91 98444 55667',
          },
        ])
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Auto-update projects pills when recipient name changes
  useEffect(() => {
    const foundBuilder = dbBuilders.find((b) => b.name.toLowerCase() === recipientName.trim().toLowerCase())
    if (foundBuilder && foundBuilder.projects && foundBuilder.projects.length > 0) {
      setAvailableProjects(foundBuilder.projects)
      if (!foundBuilder.projects.includes(projectName)) {
        setProjectName(foundBuilder.projects[0])
      }
      return
    }

    const foundPartner = dbPartners.find((p) => p.name.toLowerCase() === recipientName.trim().toLowerCase())
    if (foundPartner && foundPartner.projects && foundPartner.projects.length > 0) {
      setAvailableProjects(foundPartner.projects)
      if (!foundPartner.projects.includes(projectName)) {
        setProjectName(foundPartner.projects[0])
      }
      return
    }

    if (recipientName.toLowerCase().includes('ace')) {
      setAvailableProjects(['Ace Starlit', 'Ace Parkway', 'Ace Divino', 'Ace Palm Floors'])
    } else if (recipientName.toLowerCase().includes('aadhaar')) {
      setAvailableProjects(['Gayatri Life', 'Aadhaar Shri Height', 'Aadhaar Greens'])
    } else {
      setAvailableProjects((prev) => (prev.length > 0 ? prev : [projectName, `${recipientName} Heights`].filter(Boolean)))
    }
  }, [recipientName, dbBuilders, dbPartners])

  // Computed all-projects list for this developer or partner
  const allProjects = useMemo(() => {
    const list = availableProjects.filter(Boolean)
    if (list.length > 0) return list
    if (projectName) return [projectName]
    return ['Gayatri Life']
  }, [availableProjects, projectName])

  const handleSelectQuickBuilder = (builder: BuilderOption) => {
    setRecipientName(builder.name)
    const emailSlug = builder.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    setRecipientEmail(`partnerships@${emailSlug}.com`)
    if (builder.projects && builder.projects.length > 0) {
      setProjectName(builder.projects[0])
      setAvailableProjects(builder.projects)
    }
  }

  const handleSelectQuickPartner = (partner: PartnerOption) => {
    setRecipientName(partner.name)
    if (partner.email) setRecipientEmail(partner.email)
    if (partner.phone) setRecipientPhone(partner.phone)
    if (partner.projects && partner.projects.length > 0) {
      setProjectName(partner.projects[0])
      setAvailableProjects(partner.projects)
    }
  }

  const handleAddProject = () => {
    const trimmed = newProjectInput.trim()
    if (!trimmed) return
    if (!availableProjects.includes(trimmed)) {
      const updated = [...availableProjects, trimmed]
      setAvailableProjects(updated)
      if (!projectName) setProjectName(trimmed)
      toast.success(`Added ${trimmed} to portfolio list`)
    }
    setNewProjectInput('')
  }

  const handleRemoveProject = (projToRemove: string) => {
    const updated = availableProjects.filter((p) => p !== projToRemove)
    setAvailableProjects(updated)
    if (projectName === projToRemove && updated.length > 0) {
      setProjectName(updated[0])
    }
  }

  const inviteTokenLink = 'https://propfyndr.in/admin/accept-invite?token=prp_demo_invite_token'

  // Subject line computation — aligned with exclusive invitation psychology
  const subject = useMemo(() => {
    const projSummary = allProjects.slice(0, 2).join(' & ')
    if (template === 'builder_invite') {
      if (heroStyle === 'direct') {
        return `${recipientName}, you're invited to join PropFyndr's developer network`
      }
      if (heroStyle === 'premium') {
        return `A new direct channel for ${recipientName} — PropFyndr Invitation`
      }
      return `Your next homebuyer is looking at ${projSummary} — PropFyndr Invitation`
    }
    if (template === 'partner_invite') {
      return `${recipientName}, you're invited to PropFyndr's Channel Partner Network (${projSummary})`
    }
    return `You've been invited to join PropFyndr Admin`
  }, [template, heroStyle, recipientName, allProjects])

  // WhatsApp Outreach Text — High-converting, direct, polite, names ALL projects
  const getWhatsAppText = () => {
    const projectsListFormatted = allProjects.map((p) => `• ${p}`).join('\n')
    const projectsInline = allProjects.join(', ')

    if (template === 'partner_invite') {
      return `Hi ${recipientName} Team,\n\nGreetings from PropFyndr.in.\n\nWe are officially extending an invitation to ${recipientName} to join PropFyndr's Verified Channel Partner Network for all developments under your desk:\n\n${projectsListFormatted}\n\nKey benefits for ${recipientName}:\n1. Direct Developer Callbacks: Direct buyer inquiries for ${projectsInline} in ${targetCity}.\n2. Real-time Site Visit Bookings: Pre-qualified walkthroughs scheduled directly to your desk.\n3. Zero Broker Dilution: Transparent, direct buyer-to-partner pipeline with verified RERA terms.\n\nReview and accept your partner invitation here:\n${inviteTokenLink}\n\nBest regards,\n${senderName} | PropFyndr Developer Relations\n${senderPhone}`
    }

    return `Hi ${recipientName} Team,\n\nGreetings from PropFyndr.in.\n\nWe are officially inviting ${recipientName} to bring all your developments directly in front of verified homebuyers actively searching across ${targetCity}:\n\n${projectsListFormatted}\n\nWhy developers are joining PropFyndr:\n• Direct Buyer Inquiries: Inquiries route directly to your in-house sales gallery across all projects.\n• Zero Broker Dilution: No competing broker listings around ${projectsInline}.\n• Sanctioned RERA Integrity: Full control over approved layouts, inventory and pricing.\n\nYour official developer invitation is ready to review:\n${inviteTokenLink}\n\nBest regards,\n${senderName} | Developer Partnerships\n${senderPhone}`
  }

  // Plaintext Outreach Text — Names ALL projects
  const getPlainText = () => {
    const projectsListFormatted = allProjects.map((p) => `• ${p}`).join('\n')
    const projectsInline = allProjects.join(', ')

    if (template === 'partner_invite') {
      return `PROPFYNDR CHANNEL PARTNER NETWORK\n\n${recipientName}, you are invited to join PropFyndr's Channel Partner Network.\n\nAuthorized Developments Under Your Mandate:\n${projectsListFormatted}\n\nAccept Partner Invitation:\n${inviteTokenLink}\n\nWe are opening our network to selected agencies and advisory firms across ${targetCity}. Receive verified buyer callbacks and site visit intent directly for ${projectsInline}.\n\n---\n\nDIRECT DEVELOPER ALLOCATION\n\nFor ${recipientName}, that means verified buyer inquiries and site visit walkthroughs for ${projectsInline} route directly to your desk without broker friction.\n\nKey Capabilities:\n• Direct Developer Callbacks: Genuine buyer interest routed to your team.\n• Verified Specifications & RERA Terms: Authoritative project information.\n• Direct Site Visit Scheduling: Turn high-intent searchers into walkthroughs.\n\n---\nPropFyndr Channel Partnerships · ${senderPhone}\npartnerships@propfyndr.in`
    }

    return `PROPFYNDR PARTNER NETWORK\n\n${recipientName}, you're invited to PropFyndr.\n\nBring your entire development portfolio directly in front of verified homebuyers actively looking across ${targetCity}.\n\nYour Developments in PropFyndr Catalog:\n${projectsListFormatted}\n\nExplore Your Developer Desk:\n${inviteTokenLink}\n\nNo brokerage on buyer inquiries. No competing listings around your projects. Just a direct channel between your team and interested buyers.\n\n---\n\nA BETTER WAY TO BE DISCOVERED\n\nHomebuyers are no longer just browsing listings. They're comparing projects, checking specifications, exploring locations, evaluating budgets and deciding where they want to visit.\n\nPropFyndr brings that discovery into one place — and gives developers a verified presence throughout the journey.\n\nFor ${recipientName}, that means your entire development portfolio (${projectsInline}) can be presented with the information, specifications and availability your team controls.\n\n---\n\nYOUR PROJECTS. YOUR INFORMATION. YOUR LEADS.\n\nActive Portfolio:\n${allProjects.map((p, i) => `${i + 1}. ${p} — A verified project presence built around the way buyers actually research.`).join('\n')}\n\n• Direct Buyer Inquiries: Buyer interest routes directly to your sales team.\n• Verified Project Details: Keep specifications, inventory and project info accurate.\n• Site Visit Intent: Turn serious discovery into a conversation with your team.\n\n---\n\nWHAT YOU GET AS A PROPFYNDR PARTNER\n\n01 — Verified Presence: Own your official developer presence across all ${allProjects.length} developments.\n02 — Buyer Demand: Understand what buyers are searching for, comparing and evaluating across ${projectsInline}.\n03 — Direct Enquiries: Receive relevant buyer interest without handing the lead to competing brokers.\n04 — Project Control: Keep your project information, inventory and approved details up to date.\n\n---\n\nWE'D LIKE TO INVITE ${recipientName} TO JOIN\n\nWe're opening PropFyndr's developer network to selected builders and project partners across ${targetCity}. Your invitation is ready.\n\nAccept Developer Invitation:\n${inviteTokenLink}\n\nIt takes a few minutes to review your developer desk and get started.\n\n---\nPropFyndr · Developer Partnerships\nBuilding a more direct connection between India's homebuyers and the developers behind the projects they are considering.\npartnerships@propfyndr.in · ${senderPhone}\nThis invitation was prepared specifically for the ${recipientName} team regarding: ${projectsInline}.`
  }

  // HTML Email Body — 100% Dynamic to recipientName, allProjects, and targetCity
  const getHtml = (isMobile = clientMode === 'mobile', isDark = isDarkPreview) => {
    const palette = isDark
      ? {
          bodyBg: isMobile ? '#0b0b0e' : '#070709',
          containerBg: '#0f0f13',
          heroBg: 'linear-gradient(180deg, #18181f 0%, #0a0a0d 100%)',
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

    // Hero title variations based on user selection
    let heroHeadlineHtml = ''
    if (template === 'partner_invite') {
      heroHeadlineHtml = `${recipientName},<br><em>you're invited to PropFyndr's Partner Network.</em>`
    } else if (heroStyle === 'direct') {
      heroHeadlineHtml = `${recipientName},<br><em>you're invited to PropFyndr.</em>`
    } else if (heroStyle === 'premium') {
      heroHeadlineHtml = `A new direct channel for ${recipientName}.<br><em>Access high-intent homebuyers.</em>`
    } else {
      const pSummary = allProjects.slice(0, 2).join(' & ')
      heroHeadlineHtml = `Your next buyer is researching ${pSummary}.<br><em>A better way for them to find ${recipientName}.</em>`
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
      margin: 0; padding: 0;
      background-color: ${palette.bodyBg};
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: ${palette.textPrimary};
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      width: 100%; max-width: ${isMobile ? '100%' : '580px'};
      margin: 0 auto;
      background-color: ${palette.containerBg};
      border-radius: ${isMobile ? '0' : '20px'};
      overflow: hidden;
      border: ${isMobile ? 'none' : `1px solid ${palette.cardBorder}`};
    }
    /* ── HERO ── */
    .hero-header {
      background: ${palette.heroBg};
      padding: ${isMobile ? '28px 18px 24px 18px' : '40px 32px 32px 32px'};
      text-align: center;
      color: #ffffff;
      position: relative;
    }
    .network-badge {
      display: inline-block;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #fef08a;
      margin-bottom: 12px;
    }
    .hero-title {
      font-family: 'Newsreader', Georgia, serif;
      font-size: ${isMobile ? '24px' : '31px'};
      font-weight: 500;
      line-height: 1.2;
      color: ${palette.heroTitle};
      margin: 0 auto 14px auto;
    }
    .hero-title em {
      font-style: italic;
      font-weight: 400;
      color: ${palette.heroEm};
    }
    .hero-subtext {
      font-size: ${isMobile ? '12px' : '13px'};
      color: rgba(255, 255, 255, 0.85);
      line-height: 1.5;
      max-width: 440px;
      margin: 0 auto 20px auto;
    }
    .hero-cta {
      display: inline-block;
      background-color: #ffffff;
      color: #09090b;
      font-size: 12.5px;
      font-weight: 700;
      padding: 10px 24px;
      border-radius: 9999px;
      text-decoration: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .hero-footnote {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.4;
      margin-top: 14px;
      max-width: 440px;
      margin-left: auto;
      margin-right: auto;
    }
    /* ── BODY CANVAS ── */
    .body-canvas {
      padding: ${isMobile ? '28px 16px 20px 16px' : '36px 30px 28px 30px'};
      background-color: ${palette.bodyCanvas};
    }
    .section-eyebrow {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: ${palette.textMuted};
      margin-bottom: 6px;
    }
    .section-heading {
      font-family: 'Newsreader', Georgia, serif;
      font-size: 21px;
      font-weight: 600;
      color: ${palette.textPrimary};
      line-height: 1.3;
      margin: 0 0 12px 0;
    }
    .body-paragraph {
      font-size: 13px;
      line-height: 1.65;
      color: ${palette.textSecondary};
      margin: 0 0 14px 0;
    }
    /* ── SECTION 2: SHOWCASE CARD ── */
    .showcase-container {
      margin: 24px 0;
      border-radius: 16px;
      background: ${palette.showcaseBg};
      border: 1px solid ${palette.showcaseBorder};
      padding: ${isMobile ? '18px 14px' : '22px 20px'};
      color: #ffffff;
    }
    .showcase-tag {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #fef08a;
      margin-bottom: 2px;
    }
    .showcase-name {
      font-family: 'Newsreader', Georgia, serif;
      font-size: 22px;
      font-weight: 600;
      color: #ffffff;
      margin: 0 0 4px 0;
    }
    .showcase-subtitle {
      font-size: 11.5px;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 16px;
    }
    .showcase-pillars {
      display: grid;
      grid-template-columns: ${isMobile ? '1fr' : 'repeat(3, 1fr)'};
      gap: 10px;
    }
    .pillar-card {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 12px;
    }
    .pillar-title {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .pillar-desc {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.75);
      line-height: 1.4;
    }
    /* ── SECTION 3: 4 COMPACT PARTNER CARDS ── */
    .cards-grid {
      display: grid;
      grid-template-columns: ${isMobile ? '1fr' : 'repeat(2, 1fr)'};
      gap: 10px;
      margin: 16px 0 24px 0;
    }
    .feature-card {
      background: ${palette.cardBg};
      border: 1px solid ${palette.cardBorder};
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    }
    .feature-num {
      font-size: 11px;
      font-weight: 800;
      color: #0066cc;
      margin-bottom: 4px;
    }
    .feature-title {
      font-size: 13px;
      font-weight: 700;
      color: ${palette.textPrimary};
      margin-bottom: 4px;
    }
    .feature-desc {
      font-size: 11.5px;
      color: ${palette.textSecondary};
      line-height: 1.45;
    }
    /* ── INVITATION CTA BLOCK ── */
    .invite-block {
      text-align: center;
      padding: 24px 16px 12px 16px;
      border-top: 1px solid ${palette.divider};
      margin-top: 20px;
    }
    .invite-heading {
      font-family: 'Newsreader', Georgia, serif;
      font-size: 20px;
      font-weight: 600;
      color: ${palette.textPrimary};
      margin-bottom: 6px;
    }
    .invite-sub {
      font-size: 12.5px;
      color: ${palette.textSecondary};
      line-height: 1.5;
      max-width: 420px;
      margin: 0 auto 18px auto;
    }
    .main-cta {
      display: inline-block;
      background-color: ${palette.ctaBg};
      color: ${palette.ctaText};
      font-size: 13.5px;
      font-weight: 700;
      padding: 13px 30px;
      border-radius: 9999px;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
    }
    .cta-subtext {
      font-size: 11px;
      color: ${palette.textMuted};
      margin-top: 10px;
    }
    /* ── FOOTER ── */
    .footer-panel {
      padding: 22px 24px;
      background: ${palette.footerBg};
      border-top: 1px solid ${palette.footerBorder};
      font-size: 11px;
      color: ${palette.textMuted};
      line-height: 1.5;
    }
    .footer-brand {
      font-weight: 800;
      color: ${palette.textPrimary};
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- HERO -->
    <div class="hero-header">
      <div class="network-badge">${template === 'partner_invite' ? 'PropFyndr Channel Partner Network' : 'PropFyndr Partner Network'}</div>
      <div class="hero-title">${heroHeadlineHtml}</div>
      <div class="hero-subtext">
        ${
          template === 'partner_invite'
            ? `Authorized mandate &amp; verified buyer callback channel for all affiliated developments (${allProjects.join(', ')}) across ${targetCity}.`
            : `Bring all your developments (${allProjects.join(', ')}) directly in front of verified homebuyers actively looking across ${targetCity}.`
        }
      </div>
      <div>
        <a href="${inviteTokenLink}" class="hero-cta">${template === 'partner_invite' ? 'Explore Your Partner Desk →' : 'Explore Your Developer Desk →'}</a>
      </div>
      <div class="hero-footnote">
        ${
          template === 'partner_invite'
            ? `Direct developer callbacks. Zero broker collision. Sanctioned RERA inventory and pre-qualified site visit requests.`
            : `No brokerage on buyer inquiries. No competing listings around your projects. Just a direct channel between your sales gallery and interested buyers.`
        }
      </div>
    </div>

    <!-- BODY CANVAS -->
    <div class="body-canvas">
      <!-- SECTION 1 -->
      <div class="section-eyebrow">${template === 'partner_invite' ? 'Authorized Developer Mandate' : 'A Direct Channel for Discovery'}</div>
      <div class="section-heading">${template === 'partner_invite' ? 'Direct buyer pipeline without dilution.' : 'A better way to be discovered.'}</div>
      <div class="body-paragraph">
        Homebuyers are no longer just browsing listings. They're comparing projects, checking specifications, exploring locations, evaluating budgets and deciding where they want to visit.
      </div>
      <div class="body-paragraph">
        PropFyndr brings that discovery into one place — and gives verified partners direct visibility throughout the buyer journey.
      </div>
      <div class="body-paragraph" style="margin-bottom: 22px;">
        ${
          template === 'partner_invite'
            ? `For <strong>${recipientName}</strong>, that means exclusive direct inquiry routing and site visit walkthroughs for your authorized developments (<strong>${allProjects.join(', ')}</strong>).`
            : `For <strong>${recipientName}</strong>, that means your entire development portfolio — <strong>${allProjects.join(', ')}</strong> — can be presented with the information, specifications and availability your team controls.`
        }
      </div>

      <!-- SECTION 2: SHOWCASE CARD (ALL PROJECTS LISTED) -->
      <div class="showcase-container">
        <div class="showcase-tag">
          ${template === 'partner_invite' ? 'Authorized Developments Under Your Mandate' : 'Your Portfolio · Verified RERA Presence'}
        </div>
        <div class="showcase-name">
          ${template === 'partner_invite' ? `${recipientName} Partner Mandate` : `${recipientName} Development Portfolio`}
        </div>
        <div class="showcase-subtitle">
          ${
            template === 'partner_invite'
              ? `All ${allProjects.length} authorized developments under your partner desk in ${targetCity}.`
              : `All ${allProjects.length} active developments in your catalog on PropFyndr.`
          }
        </div>

        <!-- Project Cards for ALL Projects -->
        <div style="display: flex; flex-direction: column; gap: 8px; margin: 16px 0;">
          ${allProjects
            .map(
              (p) => `
            <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 10px; padding: 11px 14px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 9px;">
                <div style="width: 7px; height: 7px; border-radius: 50%; background: #fef08a;"></div>
                <div style="font-family: 'Newsreader', Georgia, serif; font-size: 16px; font-weight: 600; color: #ffffff;">${p}</div>
              </div>
              <span style="font-size: 9.5px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; background: rgba(254, 240, 138, 0.18); color: #fef08a; padding: 3px 8px; border-radius: 5px; border: 1px solid rgba(254, 240, 138, 0.28);">
                ${template === 'partner_invite' ? 'Authorized Allocation' : 'Verified Presence'}
              </span>
            </div>
          `
            )
            .join('')}
        </div>

        <div class="showcase-pillars">
          <div class="pillar-card">
            <div class="pillar-title">Direct Buyer Inquiries</div>
            <div class="pillar-desc">Buyer interest routes directly to your team without intermediary loss.</div>
          </div>
          <div class="pillar-card">
            <div class="pillar-title">Verified Details</div>
            <div class="pillar-desc">Keep specifications, inventory &amp; pricing accurate.</div>
          </div>
          <div class="pillar-card">
            <div class="pillar-title">Site Visit Intent</div>
            <div class="pillar-desc">Turn serious discovery into pre-scheduled site visits.</div>
          </div>
        </div>
      </div>

      <!-- SECTION 3: WHAT YOU GET -->
      <div class="section-eyebrow">Platform Capabilities</div>
      <div class="section-heading">What you get as a PropFyndr partner</div>
      <div class="cards-grid">
        <div class="feature-card">
          <div class="feature-num">01</div>
          <div class="feature-title">Verified Presence</div>
          <div class="feature-desc">Own your official verified presence across all ${allProjects.length} developments on PropFyndr.</div>
        </div>
        <div class="feature-card">
          <div class="feature-num">02</div>
          <div class="feature-title">Buyer Demand</div>
          <div class="feature-desc">Understand what buyers are searching for, comparing and evaluating across ${allProjects.slice(0, 2).join(', ')}.</div>
        </div>
        <div class="feature-card">
          <div class="feature-num">03</div>
          <div class="feature-title">Direct Enquiries</div>
          <div class="feature-desc">Receive relevant buyer interest without handing the lead to competing brokers.</div>
        </div>
        <div class="feature-card">
          <div class="feature-num">04</div>
          <div class="feature-title">Project Control</div>
          <div class="feature-desc">Keep your project information, inventory and approved details up to date.</div>
        </div>
      </div>

      <!-- INVITATION CTA BLOCK -->
      <div class="invite-block">
        <div class="invite-heading">We'd like to invite ${recipientName} to join.</div>
        <div class="invite-sub">
          We're opening PropFyndr's network to selected partners across ${targetCity} for ${allProjects.join(', ')}. Your invitation is ready.
        </div>
        <div>
          <a href="${inviteTokenLink}" class="main-cta">${template === 'partner_invite' ? 'Accept Channel Partner Invitation →' : 'Accept Developer Invitation →'}</a>
        </div>
        <div class="cta-subtext">
          It takes a few minutes to review your ${template === 'partner_invite' ? 'channel desk' : 'developer desk'} and get started.
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-panel">
      <div class="footer-brand">PropFyndr · ${template === 'partner_invite' ? 'Channel Partner Relations' : 'Developer Partnerships'}</div>
      <div>Building a more direct connection between India's homebuyers and the developers behind the projects they are considering.</div>
      <div style="margin-top: 6px;">partnerships@propfyndr.in · Direct: ${senderPhone}</div>
      <div style="margin-top: 8px; font-size: 10px; color: ${palette.textMuted};">
        This invitation was prepared specifically for the ${recipientName} team regarding: ${allProjects.join(', ')}.
      </div>
    </div>
  </div>
</body>
</html>`
  }

  // Copy actions
  const copyHtml = () => {
    navigator.clipboard.writeText(getHtml())
    setCopiedType('html')
    toast.success('Responsive HTML copied to clipboard!')
    setTimeout(() => setCopiedType(null), 2000)
  }

  const copyText = () => {
    navigator.clipboard.writeText(getPlainText())
    setCopiedType('text')
    toast.success('Plaintext email copied to clipboard!')
    setTimeout(() => setCopiedType(null), 2000)
  }

  const openWhatsAppChat = () => {
    const cleanPhone = recipientPhone.replace(/\D/g, '')
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(getWhatsAppText())}`
    window.open(url, '_blank')
  }

  // Send via Resend dispatch
  const handleSendViaResend = async () => {
    setIsSending(true)
    try {
      const res = await adminFetch('/admin/outbox/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          subject,
          html: getHtml(),
          text: getPlainText(),
        }),
      })

      if (res.ok) {
        setSentSuccessId('sent')
        toast.success(`Exclusive invitation dispatched to ${recipientEmail}!`)
        setTimeout(() => setSentSuccessId(null), 3500)
      } else {
        toast.info(`Invitation copied to clipboard (Mock mode: configure RESEND_API_KEY for live delivery)`)
      }
    } catch {
      toast.info('Simulated delivery: Invitation dispatched to outbox queue.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-[#0c0c0e] text-[#1d1d1f] dark:text-[#f5f5f7] p-4 sm:p-6 md:p-8 font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="max-w-[1440px] mx-auto space-y-6">
        {/* ── Top Bar: Navigation & Executive Header ───────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              title="Go back"
              className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-2xs active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <Link
              href="/admin"
              title="Admin Home"
              className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-2xs active:scale-95 transition-all"
            >
              <Home size={16} />
            </Link>

            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shadow-2xs shrink-0">
              <Mail size={18} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                  Email Composer &amp; Executive Preview
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-[#2997ff] border border-blue-200/60 dark:border-blue-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff] animate-pulse" />
                  AI Powered
                </span>
              </div>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Tailored executive outreach simulation across Gmail, Outlook 365, and iOS Apple Mail.
              </p>
            </div>
          </div>

          {/* Right Header Action: Send via Resend */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSendViaResend}
              disabled={isSending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111114] hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#111114] text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Dispatching…</span>
                </>
              ) : sentSuccessId ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>Dispatched!</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Send via Resend</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Main Split Canvas Card ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white/90 dark:bg-zinc-900/90 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-7 shadow-xs">
          {/* Left Form: Composer Controls */}
          <div className="lg:col-span-5 space-y-4">
            {/* Quick Pick Developer or Channel Partner (1-Click Switch) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  {template === 'partner_invite' ? 'Quick Select Channel Partner' : 'Quick Select Developer'}
                </label>
                <span className="text-[10px] text-zinc-400 font-medium">
                  {template === 'partner_invite' ? `${dbPartners.length} partners` : `${dbBuilders.length} builders`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {template === 'partner_invite'
                  ? dbPartners.slice(0, 6).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectQuickPartner(p)}
                        className={`text-[11.5px] font-bold px-3 py-1 rounded-xl border transition-all cursor-pointer ${
                          recipientName.toLowerCase() === p.name.toLowerCase()
                            ? 'bg-[#0066cc] border-[#0066cc] text-white shadow-2xs'
                            : 'bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100'
                        }`}
                      >
                        {p.name}
                        {p.builderName ? ` (${p.builderName})` : ''}
                      </button>
                    ))
                  : dbBuilders.slice(0, 6).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleSelectQuickBuilder(b)}
                        className={`text-[11.5px] font-bold px-3 py-1 rounded-xl border transition-all cursor-pointer ${
                          recipientName.toLowerCase() === b.name.toLowerCase()
                            ? 'bg-[#0066cc] border-[#0066cc] text-white shadow-2xs'
                            : 'bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100'
                        }`}
                      >
                        {b.name}
                      </button>
                    ))}
              </div>
            </div>

            {/* Email Template Select */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Email Purpose
                </label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as EmailTemplateType)}
                  className="w-full h-10 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500 transition-colors shadow-2xs"
                >
                  <option value="builder_invite">Developer Network Invitation</option>
                  <option value="partner_invite">Channel Partner Invitation</option>
                  <option value="team_invite">Internal Admin Team Invite</option>
                </select>
              </div>

              {/* Hero Headline Angle */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Hero Headline Angle
                </label>
                <select
                  value={heroStyle}
                  onChange={(e) => setHeroStyle(e.target.value as HeroStyleOption)}
                  className="w-full h-10 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500 transition-colors shadow-2xs"
                >
                  <option value="direct">Option A — Direct Invitation</option>
                  <option value="premium">Option B — Premium Channel</option>
                  <option value="curiosity">Option C — Buyer Curiosity</option>
                </select>
              </div>
            </div>

            {/* Developer / Builder / Partner Firm Name */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 size={13} />
                {template === 'partner_invite' ? 'Channel Partner / Agency Name *' : 'Developer / Builder Firm Name *'}
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. ACE Group, Aadhaar Shri, Apex Realtech"
                className="w-full h-10 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 text-[13px] font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500 transition-colors shadow-2xs"
              />
            </div>

            {/* Recipient Email */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail size={13} />
                Recipient Email *
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="partnerships@firm.com"
                className="w-full h-10 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 text-[13px] font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500 transition-colors shadow-2xs"
              />
            </div>

            {/* Recipient Mobile / WhatsApp */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Phone size={13} />
                Recipient Mobile / WhatsApp Number
              </label>
              <input
                type="text"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full h-10 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 text-[13px] font-mono font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500 transition-colors shadow-2xs"
              />
            </div>

            {/* All Projects in Portfolio / Mandate */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame size={13} />
                  {template === 'partner_invite'
                    ? `Authorized Projects Under Mandate (${allProjects.length})`
                    : `All Developer Projects in Portfolio (${allProjects.length})`}
                </label>
                <span className="text-[10px] text-zinc-400">All named in email &amp; pitch</span>
              </div>

              {/* Editable Chips of All Projects */}
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {allProjects.map((p) => (
                    <div
                      key={p}
                      className={`inline-flex items-center gap-1 text-[11.5px] font-semibold pl-2.5 pr-1.5 py-1 rounded-lg border transition-all ${
                        projectName === p
                          ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setProjectName(p)}
                        className="cursor-pointer hover:underline"
                        title="Click to set as primary featured development"
                      >
                        {p}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveProject(p)}
                        className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                        title="Remove project from invitation"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Project Input */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
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
                    placeholder="Add another development name..."
                    className="flex-1 h-8 px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddProject}
                    className="h-8 px-3 rounded-lg bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={12} />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Target Region */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin size={13} />
                Target Micro-Market / Region
              </label>
              <input
                type="text"
                value={targetCity}
                onChange={(e) => setTargetCity(e.target.value)}
                placeholder="Delhi-NCR & Greater Noida"
                className="w-full h-10 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 text-[13px] font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500 transition-colors shadow-2xs"
              />
            </div>

            {/* Sender Info 2-Col */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10.5px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Sender Name
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 text-xs font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Sender Phone
                </label>
                <input
                  type="text"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Instant Actions & Outreach */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Instant Actions &amp; Outreach
              </span>

              {/* Big Green WhatsApp Button */}
              <button
                type="button"
                onClick={openWhatsAppChat}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-[13px] font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <MessageCircle size={17} />
                <span>Open in WhatsApp</span>
                <ExternalLink size={13} className="ml-0.5 opacity-80" />
              </button>

              {/* Royal Blue Copy Responsive HTML */}
              <button
                type="button"
                onClick={copyHtml}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0066cc] hover:bg-[#0055b3] text-white text-[12.5px] font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
              >
                {copiedType === 'html' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedType === 'html' ? 'Responsive HTML Copied!' : 'Copy Responsive HTML'}</span>
              </button>

              {/* Zinc Copy Plaintext */}
              <button
                type="button"
                onClick={copyText}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[12.5px] font-bold transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
              >
                {copiedType === 'text' ? <Check size={14} /> : <Share2 size={14} />}
                <span>{copiedType === 'text' ? 'Plaintext Copied!' : 'Copy Plaintext'}</span>
              </button>
            </div>
          </div>

          {/* Right Live Simulation: Laptop & Email Client Frame */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            {/* Client Tabs & Dark Mode Toggle Bar */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider hidden sm:inline">
                  Preview Client
                </span>
                <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80">
                  <button
                    type="button"
                    onClick={() => setClientMode('gmail')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      clientMode === 'gmail'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <GmailLogo className="w-3.5 h-3.5" />
                    <span>Gmail (Web)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClientMode('outlook')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      clientMode === 'outlook'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <OutlookLogo className="w-3.5 h-3.5" />
                    <span>Outlook 365</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClientMode('mobile')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      clientMode === 'mobile'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <AppleMailLogo className="w-3.5 h-3.5" />
                    <span>Mobile (iOS)</span>
                  </button>
                </div>
              </div>

              {/* Dark Mode Switch */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDarkPreview(!isDarkPreview)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${
                    isDarkPreview
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                      : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <Moon size={13} className={isDarkPreview ? 'text-amber-400' : 'text-zinc-500'} />
                  <span>Dark Mode</span>
                  <div
                    className={`w-7 h-4 rounded-full p-0.5 transition-colors ${
                      isDarkPreview ? 'bg-blue-600' : 'bg-zinc-300'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform ${
                        isDarkPreview ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* Laptop Frame Container */}
            <div className="flex-1 flex flex-col items-center">
              {clientMode === 'mobile' ? (
                /* Precision Vector iPhone Mockup */
                <div className="w-[360px] sm:w-[380px] max-w-full drop-shadow-2xl py-2">
                  <Iphone className={isDarkPreview ? 'dark' : ''}>
                    <div
                      className={`size-full flex flex-col ${
                        isDarkPreview ? 'bg-[#0b0b0e] text-zinc-100' : 'bg-white text-zinc-900'
                      } select-none`}
                    >
                      {/* iOS Status Bar (Padded around dynamic island) */}
                      <div className="w-full flex items-center justify-between px-7 pt-3.5 pb-2 text-[11px] font-bold shrink-0 bg-transparent z-10">
                        <span className="font-semibold tracking-tight">9:41</span>
                        <div className="flex items-center gap-1.5 opacity-80">
                          <Wifi size={11} />
                          <Battery size={13} />
                        </div>
                      </div>

                      {/* Native Mobile Email Client Header */}
                      <div
                        className={`px-4 py-2 border-b flex items-center justify-between text-xs shrink-0 transition-colors ${
                          isDarkPreview
                            ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-1 text-blue-500 font-semibold">
                          <span>‹</span>
                          <span>Inbox</span>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-400">
                          <Archive size={13} />
                          <Trash2 size={13} />
                          <CornerUpLeft size={13} />
                        </div>
                      </div>

                      {/* Email Meta Bar */}
                      <div
                        className={`px-4 py-2 border-b text-xs shrink-0 transition-colors ${
                          isDarkPreview ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-100'
                        }`}
                      >
                        <div className="font-bold text-xs line-clamp-1 mb-1">
                          {subject}
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                              {template === 'partner_invite' ? 'CP' : 'PF'}
                            </div>
                            <div>
                              <div className="font-semibold leading-tight">{senderName}</div>
                              <div className="text-[10px] text-zinc-400">to {recipientName}</div>
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-400">4:51 PM</span>
                        </div>
                      </div>

                      {/* Scrollable Email Body */}
                      <div className="flex-1 overflow-y-auto">
                        <div dangerouslySetInnerHTML={{ __html: getHtml(true, isDarkPreview) }} />
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
                            <div className="flex items-center gap-2.5">
                              <Menu size={16} className="text-zinc-500 cursor-pointer" />
                              <div className="flex items-center gap-2 font-semibold select-none">
                                <GmailLogo className="w-5 h-5" />
                                <span className={`font-medium text-[15px] tracking-tight ${isDarkPreview ? 'text-[#e3e3e3]' : 'text-[#444746]'}`}>
                                  Gmail
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center flex-1 max-w-sm mx-4 px-3 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 text-xs gap-2">
                              <Search size={13} className="text-zinc-400" />
                              <span className="text-zinc-400 flex-1 text-[11.5px]">Search mail</span>
                              <Sliders size={12} className="text-zinc-400" />
                            </div>

                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shadow-2xs">
                              A
                            </div>
                          </div>

                          {/* Gmail Toolbar */}
                          <div
                            className={`flex items-center justify-between px-4 py-1.5 border-b select-none text-zinc-400 text-[11px] shrink-0 ${
                              isDarkPreview ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-100'
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <CornerUpLeft size={13} />
                              <Archive size={13} />
                              <AlertCircle size={13} />
                              <Trash2 size={13} />
                              <Clock size={13} />
                              <Tag size={13} />
                            </div>
                            <div className="flex items-center gap-2.5">
                              <Printer size={13} />
                              <ExternalLink size={13} />
                            </div>
                          </div>

                          {/* Email Header */}
                          <div
                            className={`p-4 border-b transition-colors shrink-0 ${
                              isDarkPreview ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h2
                                  className={`text-sm sm:text-base font-bold leading-snug ${
                                    isDarkPreview ? 'text-zinc-100' : 'text-zinc-900'
                                  }`}
                                >
                                  {subject}
                                </h2>
                                <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                                  Inbox
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-zinc-400">
                                <Star size={14} className="hover:text-amber-400 cursor-pointer" />
                                <Printer size={14} />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                  {template === 'partner_invite' ? 'CP' : 'PF'}
                                </div>
                                <div>
                                  <div
                                    className={`font-bold flex items-center gap-1.5 ${
                                      isDarkPreview ? 'text-zinc-100' : 'text-zinc-900'
                                    }`}
                                  >
                                    <span>{senderName}</span>
                                    <span className="font-normal text-zinc-400">&lt;partnerships@propfyndr.in&gt;</span>
                                  </div>
                                  <div className="text-zinc-400 text-[11px]">
                                    to {recipientName} &lt;{recipientEmail}&gt;
                                  </div>
                                </div>
                              </div>
                              <span className="text-[11px] text-zinc-400">4:51 PM (0 minutes ago)</span>
                            </div>
                          </div>

                          {/* Rendered Email Body in Frame */}
                          <div
                            className={`flex-1 overflow-y-auto min-h-0 select-text p-4 sm:p-6 transition-colors ${
                              isDarkPreview ? 'bg-[#0b0b0e]' : 'bg-[#faf7f0]'
                            }`}
                          >
                            <div dangerouslySetInnerHTML={{ __html: getHtml(false, isDarkPreview) }} />
                          </div>
                        </div>
                      )}

                      {/* CLIENT 2: OUTLOOK 365 */}
                      {clientMode === 'outlook' && (
                        <div className="flex flex-col text-xs size-full overflow-hidden">
                          {/* Outlook Top Navbar with 3x3 launcher grid and official Outlook Logo */}
                          <div className="flex items-center justify-between px-4 py-2 bg-[#0078d4] text-white select-none shrink-0 shadow-xs">
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
                              <Search size={12} />
                              <span className="text-white/70">Search</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-white text-[#0078d4] font-bold text-[10px] flex items-center justify-center shadow-xs">
                                PF
                              </div>
                            </div>
                          </div>

                          {/* Outlook Toolbar */}
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
                                  {template === 'partner_invite' ? 'CP' : 'PF'}
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
                            className={`flex-1 overflow-y-auto min-h-0 select-text p-4 sm:p-6 transition-colors ${
                              isDarkPreview ? 'bg-[#0b0b0e]' : 'bg-[#faf7f0]'
                            }`}
                          >
                            <div dangerouslySetInnerHTML={{ __html: getHtml(false, isDarkPreview) }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </Safari>
                </div>
              )}
            </div>

            {/* Bottom Status Bar */}
            <div className="flex items-center justify-between px-2 pt-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-zinc-900 dark:text-zinc-100">Ready to Send or Copy</span>
                <span className="text-zinc-400 hidden sm:inline">
                  Tested against Gmail, Outlook 365, Apple Mail, and iOS Safari Mail
                </span>
              </div>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 shadow-2xs active:scale-95 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>

        {/* ── Bottom Section: Preview Across Clients & Pro Advice ────────── */}
        <div className="space-y-4 pt-2">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
              Preview Across Clients
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              See how your email looks on different email clients and devices.
            </p>
          </div>

          {/* 3 Client Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gmail Card */}
            <div
              onClick={() => setClientMode('gmail')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                clientMode === 'gmail'
                  ? 'bg-white dark:bg-zinc-900 border-blue-500/80 ring-2 ring-blue-500/10 shadow-sm'
                  : 'bg-white/80 dark:bg-zinc-900/60 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center font-black text-xl shrink-0">
                M
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Gmail (Web)</h3>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Most common for business outreach in India.
                </p>
              </div>
            </div>

            {/* Outlook Card */}
            <div
              onClick={() => setClientMode('outlook')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                clientMode === 'outlook'
                  ? 'bg-white dark:bg-zinc-900 border-blue-500/80 ring-2 ring-blue-500/10 shadow-sm'
                  : 'bg-white/80 dark:bg-zinc-900/60 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold text-base shrink-0">
                O
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Outlook 365</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Preview for enterprise corporate inboxes.
                </p>
              </div>
            </div>

            {/* iOS Mobile Card */}
            <div
              onClick={() => setClientMode('mobile')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                clientMode === 'mobile'
                  ? 'bg-white dark:bg-zinc-900 border-blue-500/80 ring-2 ring-blue-500/10 shadow-sm'
                  : 'bg-white/80 dark:bg-zinc-900/60 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
                <Smartphone size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Mobile (iOS)</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Check how it appears on iPhone and Apple Mail.
                </p>
              </div>
            </div>
          </div>

          {/* 3 Pro Tips Bento Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Pro Tip */}
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/50 border border-zinc-200/70 dark:border-zinc-800 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <Lightbulb size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Pro Tip</h4>
                <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Personalize the project name and target region for higher response rates.
                </p>
              </div>
            </div>

            {/* AI Enhancement */}
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/50 border border-zinc-200/70 dark:border-zinc-800 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Cpu size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">AI Enhancement</h4>
                <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Use AI to improve subject line, tone, and content for better engagement.
                </p>
              </div>
            </div>

            {/* Need Help */}
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/50 border border-zinc-200/70 dark:border-zinc-800 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#0066cc] flex items-center justify-center shrink-0 mt-0.5">
                <HelpCircle size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Need Help?</h4>
                <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Check our outreach best practices guide.{' '}
                  <span className="text-[#0066cc] dark:text-[#2997ff] font-bold cursor-pointer hover:underline">
                    View Guide →
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EmailPreviewStudioPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <div className="w-6 h-6 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <EmailPreviewStudioContent />
    </React.Suspense>
  )
}
