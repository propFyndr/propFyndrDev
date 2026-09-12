'use client'

import React, { useState } from 'react'
import {
  X,
  Mail,
  Smartphone,
  Laptop,
  Copy,
  Check,
  Share2,
  Send,
  MessageCircle,
  Paperclip,
  Star,
  CornerUpLeft,
  Moon,
  Sun,
  Loader2,
  Sliders,
  Eye,
  Building2,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Search,
  Archive,
  Trash2,
  Clock,
  MoreVertical,
  Reply,
  Forward,
  Printer,
  ExternalLink,
  ShieldCheck,
  Tag,
  Grid,
  Menu,
  ChevronDown,
  Sparkles,
  Wifi,
  Battery
} from 'lucide-react'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect, { SelectOption } from '@/components/admin/CustomSelect'

export type EmailTemplateType = 'builder_pitch' | 'team_invite'
export type ClientPreviewType = 'gmail' | 'outlook' | 'mobile'

interface EmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  initialTemplate?: EmailTemplateType
  defaultRecipientEmail?: string
  defaultRecipientName?: string
  defaultRole?: string
  inviteLink?: string
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  initialTemplate = 'team_invite',
  defaultRecipientEmail = 'developer@partner.com',
  defaultRecipientName = 'Elite Group',
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

  // Editable fields for live preview
  const [recipientName, setRecipientName] = useState(defaultRecipientName)
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail)
  const [projectName, setProjectName] = useState('Elite X in Greater Noida West')
  const [targetCity, setTargetCity] = useState('Delhi-NCR, Mumbai & Bangalore')
  const [senderName, setSenderName] = useState('PropFyndr Team')
  const [senderTitle, setSenderTitle] = useState('Founder & Growth Lead | PropFyndr.in')
  const [senderPhone, setSenderPhone] = useState('+91 98712 34567')

  if (!isOpen) return null

  const generatedInviteLink =
    inviteLink ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/admin/join?token=prp_demo_invite_token`
      : 'https://propfyndr.in/admin/join?token=prp_demo_invite_token')

  // Subject line computation
  const subject =
    template === 'builder_pitch'
      ? `${recipientName || 'Developer'} × PropFyndr — Showcasing your projects to high-intent home buyers & verified brokers`
      : `You've been invited to join PropFyndr Admin as ${defaultRole}`

  // Plaintext version
  const getPlainText = () => {
    if (template === 'builder_pitch') {
      return `Hi ${recipientName || 'there'},

Greetings from PropFyndr.in.

We came across ${recipientName} and ${projectName}, and would love to showcase your developments to our rapidly growing network of verified property buyers and brokers.

PropFyndr is a next-generation AI real estate intelligence platform, currently operational across ${targetCity}, with over 10,000+ active home seekers and hundreds of verified advisory partners using the platform daily.

For builders and developers, PropFyndr provides:
• AI-driven buyer matchmaking & high-intent lead routing
• Direct project page featuring verified RERA specs, 3D master plans & walkthroughs
• Real-time lead tracking dashboard with zero broker commission friction
• Seamless site-visit coordination

Project listing is currently 100% FREE for select premier developers, and our specialized real estate team handles the entire technical onboarding.

Could I request 10 minutes on a quick phone or video call this week to introduce PropFyndr and explore bringing ${recipientName}'s projects onto the platform?

Warm regards,
${senderName}
${senderTitle}
Phone: ${senderPhone}
PropFyndr Technologies · https://propfyndr.in

P.S : Direct Developer Onboarding Desk: +91 98712 34567 / partnerships@propfyndr.in`
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

  // HTML email version
  const getHtml = () => {
    if (template === 'builder_pitch') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; color: #1e293b; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.05); }
    .header { padding: 28px 32px 20px 32px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #f1f5f9; }
    .logo-badge { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: 16px; letter-spacing: -0.5px; color: #0284c7; }
    .logo-box { width: 28px; height: 28px; background: #0284c7; border-radius: 7px; display: inline-block; vertical-align: middle; text-align: center; line-height: 28px; color: #ffffff; font-weight: 900; }
    .content { padding: 28px 32px; line-height: 1.65; font-size: 14px; color: #334155; }
    .headline { font-size: 17px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
    .feature-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 18px 0; }
    .feature-title { font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
    .feature-item { margin-bottom: 8px; display: flex; align-items: flex-start; gap: 8px; font-size: 13px; }
    .feature-bullet { color: #0284c7; font-weight: bold; }
    .highlight-banner { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 14px; border-radius: 0 8px 8px 0; margin: 18px 0; font-size: 13px; color: #1e40af; font-weight: 500; }
    .cta-button { display: inline-block; background: #0284c7; color: #ffffff !important; font-weight: 600; font-size: 13.5px; padding: 11px 22px; border-radius: 8px; text-decoration: none; margin: 14px 0; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 11.5px; color: #64748b; }
    .signature { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">
        <span class="logo-box">P</span>
        <span>PropFyndr · Developer Intelligence</span>
      </div>
    </div>
    <div class="content">
      <h1 class="headline">Showcasing ${recipientName} on PropFyndr</h1>
      <p>Hi ${recipientName || 'Partner'},</p>
      <p>Greetings from PropFyndr.in.</p>
      <p>We came across <strong>${recipientName}</strong> and recent flagship developments like <strong>${projectName}</strong>, and would love to present your portfolio to our active network of high-intent property seekers and verified advisory partners.</p>
      
      <div class="feature-card">
        <div class="feature-title">What PropFyndr Delivers For Builders</div>
        <div class="feature-item"><span class="feature-bullet">✓</span> <span><strong>AI-Powered Lead Discovery:</strong> High-intent home seekers matched directly to your inventory.</span></div>
        <div class="feature-item"><span class="feature-bullet">✓</span> <span><strong>Verified Digital Showcase:</strong> High-resolution 3D walkthroughs, RERA audit scores & real-time floor plans.</span></div>
        <div class="feature-item"><span class="feature-bullet">✓</span> <span><strong>Direct Buyer Touchpoint:</strong> Zero brokerage friction, verified site visits, and transparent lead intelligence.</span></div>
      </div>

      <div class="highlight-banner">
        🎉 <strong>Complimentary Developer Onboarding:</strong> Project listing is 100% free for select premier developers, and our dedicated team handles complete data ingestion and 3D modeling.
      </div>

      <p>Could we schedule a brief 10-minute discovery call this week to introduce PropFyndr and get ${recipientName}'s developments listed?</p>
      
      <p style="margin-top: 20px;">
        <a href="https://propfyndr.in/contact" class="cta-button">Schedule a 10-Min Walkthrough &rarr;</a>
      </p>

      <div class="signature">
        <strong>${senderName}</strong><br/>
        <span style="color: #64748b; font-size: 12.5px;">${senderTitle}</span><br/>
        <span style="color: #64748b; font-size: 12.5px;">Contact: ${senderPhone} · partnerships@propfyndr.in</span><br/>
        <a href="https://propfyndr.in" style="color: #0284c7; text-decoration: none; font-size: 12.5px;">propfyndr.in</a>
      </div>
    </div>
    <div class="footer">
      PropFyndr Technologies Inc. · High-Intent Real Estate AI Discovery<br/>
      Operational across ${targetCity}.
    </div>
  </div>
</body>
</html>`
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; color: #1e293b; }
    .container { max-width: 520px; margin: 20px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.05); }
    .header { padding: 28px 32px 18px 32px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #f1f5f9; text-align: center; }
    .logo-box { width: 34px; height: 34px; background: #0284c7; border-radius: 10px; display: inline-block; vertical-align: middle; text-align: center; line-height: 34px; color: #ffffff; font-weight: 900; font-size: 16px; }
    .title { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 14px; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #64748b; margin: 0; }
    .content { padding: 28px 32px; line-height: 1.6; font-size: 14px; color: #334155; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 11.5px; background: #e0f2fe; color: #0369a1; text-transform: uppercase; margin-bottom: 14px; }
    .cta-button { display: block; text-align: center; background: #0284c7; color: #ffffff !important; font-weight: 700; font-size: 13.5px; padding: 12px 22px; border-radius: 10px; text-decoration: none; margin: 20px 0 14px 0; }
    .security-note { font-size: 11.5px; color: #94a3b8; text-align: center; line-height: 1.5; }
    .footer { padding: 18px 32px; background: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 11.5px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-box">PF</div>
      <h1 class="title">Join PropFyndr Admin</h1>
      <p class="subtitle">Platform Invitation & Security Access</p>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>You have been invited to join the <strong>PropFyndr Intelligence Suite</strong> with privileged administrative access:</p>
      
      <div style="text-align: center; margin: 14px 0;">
        <span class="badge">ROLE: ${defaultRole}</span>
      </div>

      <p>As a team member, you will have access to the real-time project management console, developer outreach desk, buyer lead tracking, and platform observability metrics.</p>

      <a href="${generatedInviteLink}" class="cta-button">Accept Invitation & Activate Account &rarr;</a>

      <p class="security-note">
        This link is cryptographically signed and will expire in 7 days.<br/>
        If you did not anticipate this invite, please notify security@propfyndr.in.
      </p>
    </div>
    <div class="footer">
      PropFyndr Technologies · PropFyndr Admin Portal · https://propfyndr.in
    </div>
  </div>
</body>
</html>`
  }

  // Copy helpers
  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(getHtml())
      setCopiedType('html')
      toast.success('Responsive email HTML copied to clipboard!')
      setTimeout(() => setCopiedType(null), 2500)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(getPlainText())
      setCopiedType('text')
      toast.success('Plaintext version copied!')
      setTimeout(() => setCopiedType(null), 2500)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const copyWhatsApp = async () => {
    const waText = getPlainText()
    try {
      await navigator.clipboard.writeText(waText)
      setCopiedType('wa')
      toast.success('WhatsApp text copied!')
      setTimeout(() => setCopiedType(null), 2500)
    } catch {
      toast.error('Failed to copy')
    }
  }

  // Direct send via Resend endpoint
  const handleSendViaResend = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      toast.error('Please provide a valid recipient email address.')
      return
    }

    setIsSending(true)
    setSentSuccessId(null)

    try {
      const res = await adminFetch('/admin/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          subject,
          html: getHtml(),
          text: getPlainText(),
        }),
      })

      const data = await res.json().catch(() => null)

      if (res.ok && data?.success) {
        setSentSuccessId(data.messageId || 'SENT')
        toast.success(`Email dispatched successfully to ${recipientEmail}!`)
      } else {
        toast.error(data?.error || 'Failed to dispatch email via Resend.')
      }
    } catch (err: any) {
      console.error('Send error:', err)
      toast.error(err?.message || 'Failed to communicate with mail dispatch worker.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-zinc-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden">
        {/* ── Modal Main Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 shrink-0 bg-zinc-50/70 dark:bg-zinc-900/70 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
              <Mail size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Email Composer & Executive Preview
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/70 dark:border-blue-800">
                  <Sparkles size={11} />
                  Resend Engine
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
                Multi-client HTML preview simulation across Gmail, Outlook 365, and iOS Mobile.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Resend Dispatch Button */}
            <button
              type="button"
              onClick={handleSendViaResend}
              disabled={isSending}
              className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer ${
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
            Edit Template & Fields
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
            className={`w-full md:w-[360px] lg:w-[400px] border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 overflow-y-auto shrink-0 flex flex-col justify-between gap-5 ${
              mobileTab === 'preview' ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="space-y-4">
              {/* Template Selector */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
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

              {/* Dynamic Field Inputs */}
              {template === 'builder_pitch' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Developer / Firm Name
                    </label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Godrej Properties"
                      className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Recipient Email *
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Flagship Project Mention
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Sender Name
                      </label>
                      <input
                        type="text"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Sender Phone
                      </label>
                      <input
                        type="text"
                        value={senderPhone}
                        onChange={(e) => setSenderPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                      className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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

            {/* Instant Copy / Share Section */}
            <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Instant Copy / Share
              </span>

              <button
                type="button"
                onClick={copyWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
              >
                {copiedType === 'wa' ? <Check size={14} /> : <MessageCircle size={14} />}
                <span>{copiedType === 'wa' ? 'WhatsApp Text Copied!' : 'Copy WhatsApp Pitch'}</span>
              </button>

              <button
                type="button"
                onClick={copyHtml}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
              >
                {copiedType === 'html' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedType === 'html' ? 'HTML Copied to Clipboard!' : 'Copy Responsive HTML'}</span>
              </button>

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
            {/* Canvas Sub-Header: Client & Frame Switcher */}
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

              {/* Theme toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDarkPreview(!isDarkPreview)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium text-[11px] shadow-2xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {isDarkPreview ? <Sun size={13} className="text-amber-500" /> : <Moon size={13} className="text-indigo-500" />}
                  <span>{isDarkPreview ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
              </div>
            </div>

            {/* Canvas Screen: Realistic Laptop / Mobile Frame */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 flex items-center justify-center">
              {clientMode === 'mobile' ? (
                /* ── PHONE FRAME (iPhone Mockup) ─────────────────────────── */
                <div className="relative flex flex-col items-center">
                  {/* Smartphone Chassis */}
                  <div
                    className={`w-[320px] xs:w-[360px] rounded-[48px] border-[6px] border-zinc-800 dark:border-zinc-700 p-2 shadow-2xl transition-all overflow-hidden shrink-0 ${
                      isDarkPreview ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'
                    }`}
                  >
                    {/* Top Notch / Dynamic Island */}
                    <div className="w-full flex items-center justify-between px-6 pt-1 pb-2">
                      <span className="text-[11px] font-bold tracking-tight">9:41</span>
                      <div className="w-20 h-4 bg-zinc-900 rounded-full flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-900/40" />
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <Wifi size={11} />
                        <Battery size={13} className="text-zinc-800 dark:text-zinc-200" />
                      </div>
                    </div>

                    {/* Native Mobile Email Header */}
                    <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-blue-600 font-semibold cursor-pointer">
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
                    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60 text-xs">
                      <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-2 mb-1.5">
                        {subject}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {template === 'builder_pitch' ? 'P' : 'PF'}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-800 dark:text-zinc-200">{senderName}</div>
                            <div className="text-[10px] text-zinc-400">to {recipientName}</div>
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-400">4:51 PM</span>
                      </div>
                    </div>

                    {/* Phone Screen Body Scrollable */}
                    <div className="p-3 max-h-[500px] overflow-y-auto text-xs leading-relaxed select-text">
                      <div dangerouslySetInnerHTML={{ __html: getHtml() }} />
                    </div>

                    {/* Bottom iOS Home Indicator */}
                    <div className="w-full flex justify-center py-2">
                      <div className="w-28 h-1 bg-zinc-400 dark:bg-zinc-600 rounded-full" />
                    </div>
                  </div>
                </div>
              ) : (
                /* ── LAPTOP FRAME (MacBook / Ultrabook Mockup) ─────────────── */
                <div className="w-full max-w-4xl flex flex-col items-center">
                  {/* Laptop Screen Bezel */}
                  <div className="w-full bg-zinc-900 rounded-t-2xl p-2.5 sm:p-3 shadow-2xl border border-zinc-800">
                    {/* Top Webcam Notch */}
                    <div className="w-full flex items-center justify-center pb-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center">
                        <div className="w-0.5 h-0.5 rounded-full bg-emerald-500/80" />
                      </div>
                    </div>

                    {/* Laptop Screen Display Area */}
                    <div
                      className={`w-full rounded-xl overflow-hidden shadow-inner ${
                        isDarkPreview ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'
                      }`}
                    >
                      {/* CLIENT 1: GMAIL WEB */}
                      {clientMode === 'gmail' && (
                        <div className="flex flex-col text-xs">
                          {/* Gmail Top Navbar */}
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 border-b select-none ${
                              isDarkPreview
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                                : 'bg-[#f6f8fc] border-zinc-200 text-zinc-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Menu size={16} className="text-zinc-500" />
                              <div className="flex items-center gap-1.5 font-semibold text-sm">
                                <span className="text-red-500 font-black text-base">M</span>
                                <span className="font-bold text-zinc-700 dark:text-zinc-200">Gmail</span>
                              </div>
                            </div>

                            {/* Gmail Search Bar */}
                            <div className="hidden sm:flex items-center flex-1 max-w-md mx-6 px-3.5 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 shadow-2xs gap-2">
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
                              <CornerUpLeft size={14} className="hover:text-zinc-800 cursor-pointer" />
                              <Archive size={14} className="hover:text-zinc-800 cursor-pointer" />
                              <AlertCircle size={14} className="hover:text-zinc-800 cursor-pointer" />
                              <Trash2 size={14} className="hover:text-zinc-800 cursor-pointer" />
                              <Clock size={14} className="hover:text-zinc-800 cursor-pointer" />
                              <Tag size={14} className="hover:text-zinc-800 cursor-pointer" />
                            </div>

                            <div className="flex items-center gap-3">
                              <Printer size={14} className="hover:text-zinc-800 cursor-pointer" />
                              <ExternalLink size={14} className="hover:text-zinc-800 cursor-pointer" />
                            </div>
                          </div>

                          {/* Gmail Email Header */}
                          <div className="p-4 sm:p-6 border-b border-zinc-100 dark:border-zinc-800/80">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
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
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                    <span>{senderName}</span>
                                    <span className="font-normal text-zinc-400">&lt;partnerships@propfyndr.in&gt;</span>
                                  </div>
                                  <div className="text-zinc-400 text-[11px] flex items-center gap-1">
                                    <span>to {recipientName} &lt;{recipientEmail}&gt;</span>
                                    <ChevronDown size={11} className="cursor-pointer" />
                                  </div>
                                </div>
                              </div>

                              <span className="text-[11px] text-zinc-400 tabular-nums">4:51 PM (0 minutes ago)</span>
                            </div>
                          </div>

                          {/* Email Body */}
                          <div className="p-4 sm:p-8 max-h-[460px] overflow-y-auto select-text">
                            <div dangerouslySetInnerHTML={{ __html: getHtml() }} />
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
                            <span className="font-bold text-[#0078d4] border-b-2 border-[#0078d4] pb-1">Home</span>
                            <span className="pb-1 hover:text-zinc-900 cursor-pointer">View</span>
                            <span className="pb-1 hover:text-zinc-900 cursor-pointer">Help</span>
                          </div>

                          {/* Outlook Email Header */}
                          <div className="p-4 sm:p-6 border-b border-zinc-100 dark:border-zinc-800/80">
                            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3">
                              {subject}
                            </h2>

                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#0078d4] text-white font-bold text-xs flex items-center justify-center shrink-0">
                                  {template === 'builder_pitch' ? 'P' : 'PF'}
                                </div>
                                <div>
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100">
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

                          {/* Email Body */}
                          <div className="p-4 sm:p-8 max-h-[460px] overflow-y-auto select-text">
                            <div dangerouslySetInnerHTML={{ __html: getHtml() }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Laptop Aluminum Base / Keyboard Hinge Mockup */}
                  <div className="w-[102%] h-4 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 rounded-b-xl shadow-lg flex justify-center items-center">
                    <div className="w-20 h-1 bg-zinc-600 rounded-full" />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Status Bar */}
            <div className="px-5 sm:px-6 py-2.5 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
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
                  className="px-4 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition-all cursor-pointer"
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
