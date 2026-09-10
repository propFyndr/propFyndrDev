'use client'

import React, { useState } from 'react'
import {
  X,
  Mail,
  Smartphone,
  Monitor,
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
} from 'lucide-react'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect, { SelectOption } from '@/components/admin/CustomSelect'

export type EmailTemplateType = 'builder_pitch' | 'team_invite'

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
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
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
    .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.05); }
    .header { padding: 32px 32px 24px 32px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #f1f5f9; }
    .logo-badge { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: 16px; letter-spacing: -0.5px; color: #0284c7; }
    .logo-box { width: 28px; height: 28px; background: #0284c7; border-radius: 7px; display: inline-block; vertical-align: middle; text-align: center; line-height: 28px; color: #ffffff; font-weight: 900; }
    .content { padding: 32px; line-height: 1.65; font-size: 14.5px; color: #334155; }
    .headline { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 18px; }
    .feature-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .feature-title { font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .feature-item { margin-bottom: 8px; display: flex; align-items: flex-start; gap: 8px; font-size: 13.5px; }
    .feature-bullet { color: #0284c7; font-weight: bold; }
    .highlight-banner { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 13.5px; color: #1e40af; font-weight: 500; }
    .cta-button { display: inline-block; background: #0284c7; color: #ffffff !important; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0; }
    .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; }
    .signature { margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; }
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
      
      <p style="margin-top: 24px;">
        <a href="https://propfyndr.in/contact" class="cta-button">Schedule a 10-Min Walkthrough &rarr;</a>
      </p>

      <div class="signature">
        <strong>${senderName}</strong><br/>
        <span style="color: #64748b; font-size: 13px;">${senderTitle}</span><br/>
        <span style="color: #64748b; font-size: 13px;">Contact: ${senderPhone} · partnerships@propfyndr.in</span><br/>
        <a href="https://propfyndr.in" style="color: #0284c7; text-decoration: none; font-size: 13px;">propfyndr.in</a>
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
    .container { max-width: 540px; margin: 24px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.05); }
    .header { padding: 32px 32px 20px 32px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #f1f5f9; text-align: center; }
    .logo-box { width: 36px; height: 36px; background: #0284c7; border-radius: 10px; display: inline-block; vertical-align: middle; text-align: center; line-height: 36px; color: #ffffff; font-weight: 900; font-size: 18px; }
    .title { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 16px; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #64748b; margin: 0; }
    .content { padding: 32px; line-height: 1.6; font-size: 14.5px; color: #334155; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; background: #e0f2fe; color: #0369a1; text-transform: uppercase; margin-bottom: 16px; }
    .cta-button { display: block; text-align: center; background: #0284c7; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 14px 24px; border-radius: 10px; text-decoration: none; margin: 24px 0 16px 0; }
    .security-note { font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; }
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
      
      <div style="text-align: center; margin: 16px 0;">
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

      const data = await res.json()

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}: Failed to send email`)
      }

      setSentSuccessId(data.id || 'sent')
      toast.success(`Email successfully dispatched to ${recipientEmail} via Resend!`)
    } catch (err: any) {
      console.error('[Resend:Send:Error]', err)
      toast.error(err.message || 'Error sending email via Resend')
    } finally {
      setIsSending(false)
    }
  }

  const templateOptions: SelectOption[] = [
    { value: 'builder_pitch', label: 'Developer Outreach Pitch (GoBro Style)', dotColor: 'bg-blue-500' },
    { value: 'team_invite', label: 'Admin Team Role Invitation', dotColor: 'bg-emerald-500' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[94vh] max-h-[900px] flex flex-col rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-2xl overflow-hidden font-sans">
        
        {/* Top App Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Mail size={16} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Email Composer & Live Preview</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80">
                  <CheckCircle2 size={10} /> Resend Powered
                </span>
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden xs:block">
                Apple Mail & iOS viewport simulation with live dispatch
              </p>
            </div>
          </div>

          {/* Controls & Close Button */}
          <div className="flex items-center gap-2">
            {/* Mobile Tab Switcher (Edit vs Preview) visible only on small screens */}
            <div className="flex md:hidden items-center p-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setMobileTab('edit')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  mobileTab === 'edit'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500'
                }`}
              >
                <Sliders size={12} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('preview')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  mobileTab === 'preview'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500'
                }`}
              >
                <Eye size={12} />
                <span>Preview</span>
              </button>
            </div>

            {/* Direct Send via Resend Button */}
            <button
              type="button"
              onClick={handleSendViaResend}
              disabled={isSending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer"
            >
              {isSending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
              <span className="hidden xs:inline">Send via Resend</span>
              <span className="xs:hidden">Send</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          
          {/* Left Panel: Configuration Parameters (hidden on mobile when preview tab active) */}
          <div
            className={`w-full md:w-[360px] lg:w-[400px] border-b md:border-b-0 md:border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto p-4 sm:p-5 space-y-4 shrink-0 ${
              mobileTab === 'preview' ? 'hidden md:block' : 'block'
            }`}
          >
            {/* Template Selector using CustomSelect */}
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Email Template Type
              </label>
              <CustomSelect
                value={template}
                onChange={(val) => setTemplate(val as EmailTemplateType)}
                options={templateOptions}
                size="sm"
              />
            </div>

            {/* Live Delivery Status Notice if sent */}
            {sentSuccessId && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Delivered via Resend</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 break-all font-mono">
                    ID: {sentSuccessId}
                  </p>
                </div>
              </div>
            )}

            {/* Template-Specific Form Inputs */}
            {template === 'builder_pitch' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Developer Company Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. ATS Infrastructure / Ace Group"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Recipient Email Address *
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="partnerships@developer.com"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Flagship Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. ATS Knightsbridge in Sector 124"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Operational Markets
                  </label>
                  <input
                    type="text"
                    value={targetCity}
                    onChange={(e) => setTargetCity(e.target.value)}
                    placeholder="Delhi-NCR, Mumbai, Bangalore"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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

            {/* Copy / Export Action Buttons */}
            <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Instant Copy / Share
              </span>
              
              <button
                type="button"
                onClick={copyWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
              >
                {copiedType === 'wa' ? <Check size={14} /> : <MessageCircle size={14} />}
                <span>{copiedType === 'wa' ? 'WhatsApp Text Copied!' : 'Copy WhatsApp Pitch'}</span>
              </button>

              <button
                type="button"
                onClick={copyHtml}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
              >
                {copiedType === 'html' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedType === 'html' ? 'HTML Copied to Clipboard!' : 'Copy Responsive HTML'}</span>
              </button>

              <button
                type="button"
                onClick={copyText}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
              >
                {copiedType === 'text' ? <Check size={14} /> : <Share2 size={14} />}
                <span>{copiedType === 'text' ? 'Plaintext Copied!' : 'Copy Plaintext'}</span>
              </button>
            </div>
          </div>

          {/* Right Panel: Interactive Preview Canvas */}
          <div
            className={`flex-1 flex flex-col min-h-0 bg-zinc-100 dark:bg-zinc-950 overflow-hidden ${
              mobileTab === 'edit' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Canvas Header (Desktop vs Mobile Frame, Light vs Dark Client) */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-medium hidden sm:inline">Device View:</span>
                <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setViewMode('desktop')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      viewMode === 'desktop'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Monitor size={13} />
                    <span>Apple Mail</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('mobile')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      viewMode === 'mobile'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Smartphone size={13} />
                    <span>iPhone iOS</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDarkPreview(!isDarkPreview)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium text-[11px] shadow-2xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {isDarkPreview ? (
                    <Sun size={13} className="text-amber-500" />
                  ) : (
                    <Moon size={13} className="text-indigo-500" />
                  )}
                  <span>{isDarkPreview ? 'Light' : 'Dark'}</span>
                </button>
              </div>
            </div>

            {/* Scrollable Preview Canvas */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 flex items-center justify-center">
              {viewMode === 'desktop' ? (
                /* Desktop Apple Mail Window */
                <div
                  className={`w-full max-w-2xl rounded-2xl border shadow-xl transition-all overflow-hidden ${
                    isDarkPreview
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
                      : 'bg-white border-zinc-200/90 text-zinc-900'
                  }`}
                >
                  {/* macOS Titlebar */}
                  <div
                    className={`flex items-center justify-between px-4 py-2.5 border-b select-none ${
                      isDarkPreview ? 'bg-zinc-800/80 border-zinc-700/60' : 'bg-zinc-100/90 border-zinc-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-rose-500/90" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/90" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/90" />
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Apple Mail · Preview
                    </span>
                    <div className="w-10" />
                  </div>

                  {/* Mail Message Header */}
                  <div
                    className={`p-4 sm:p-5 border-b ${
                      isDarkPreview ? 'border-zinc-800/80 bg-zinc-900/50' : 'border-zinc-100 bg-zinc-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h2 className="text-sm sm:text-base font-bold tracking-tight">{subject}</h2>
                      <div className="flex items-center gap-2 text-zinc-400 shrink-0">
                        <Star size={15} className="hover:text-amber-400 cursor-pointer" />
                        <CornerUpLeft size={15} className="hover:text-blue-500 cursor-pointer" />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                          {template === 'builder_pitch' ? 'P' : 'PF'}
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{senderName}</span>
                            <span className="font-normal text-zinc-400 hidden xs:inline">&lt;partnerships@propfyndr.in&gt;</span>
                          </div>
                          <div className="text-zinc-400 text-[11px]">
                            To: <span className="font-medium text-zinc-600 dark:text-zinc-300">{recipientName}</span> &lt;{recipientEmail}&gt;
                          </div>
                        </div>
                      </div>

                      <span className="text-[11px] text-zinc-400 tabular-nums">Today at 4:51 PM</span>
                    </div>

                    {template === 'builder_pitch' && (
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
                        <Paperclip size={13} className="text-zinc-400" />
                        <span className="font-medium">2 attachments</span>
                        <span className="text-zinc-400 hidden sm:inline">(PropFyndr_Builder_Deck.pdf, RERA_Integration_Guide.pdf)</span>
                      </div>
                    )}
                  </div>

                  {/* Mail Body */}
                  <div
                    className="p-5 sm:p-8 overflow-x-auto text-[14px] leading-relaxed select-text"
                    dangerouslySetInnerHTML={{ __html: getHtml() }}
                  />
                </div>
              ) : (
                /* Mobile iPhone Device View */
                <div
                  className={`w-[320px] xs:w-[350px] sm:w-[360px] rounded-[42px] border-4 p-2 shadow-2xl transition-all overflow-hidden shrink-0 ${
                    isDarkPreview ? 'bg-black border-zinc-800' : 'bg-black border-zinc-700'
                  }`}
                >
                  {/* Dynamic Island Notch */}
                  <div className="w-full flex justify-center pt-2 pb-3">
                    <div className="w-24 h-5 bg-zinc-950 rounded-full flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 mr-2" />
                    </div>
                  </div>

                  {/* Phone Screen */}
                  <div
                    className={`rounded-[32px] p-3 sm:p-4 min-h-[520px] max-h-[600px] overflow-y-auto text-xs leading-normal select-text ${
                      isDarkPreview ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-3 mb-3">
                      <span className="font-bold text-xs truncate max-w-[180px]">
                        {template === 'builder_pitch' ? `${recipientName} × PropFyndr` : 'PropFyndr Team Invite'}
                      </span>
                      <span className="text-[10px] text-zinc-400">4:51 PM</span>
                    </div>

                    <div className="mb-3">
                      <div className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">{senderName}</div>
                      <div className="text-[11px] text-blue-500 font-semibold cursor-pointer">Details &gt;</div>
                    </div>

                    <div
                      className="text-xs leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: getHtml() }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Bar */}
            <div className="px-4 sm:px-6 py-2.5 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Ready to Send or Copy</span>
                <span className="text-zinc-400 hidden lg:inline">
                  · Tested against Apple Mail, iOS Mail, Superhuman & Gmail
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition-all cursor-pointer"
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
