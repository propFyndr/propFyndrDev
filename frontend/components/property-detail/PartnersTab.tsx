'use client'

import { Phone, Mail, ShieldCheck, Award, ExternalLink, MessageSquare } from 'lucide-react'

export interface ChannelPartner {
  name: string
  slug?: string
  partner_type?: string // 'agency' | 'broker' | 'channel_partner'
  rera_registration?: string
  phone?: string
  email?: string
  commission_structure?: string
  specialization?: string
  rating?: number
}

interface PartnersTabProps {
  partners?: ChannelPartner[]
  projectName?: string
}

export default function PartnersTab({ partners = [], projectName = 'this project' }: PartnersTabProps) {
  if (!partners || partners.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-3xl space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
          <ShieldCheck size={24} />
        </div>
        <h3 className="text-base font-black text-gray-900 dark:text-white">Authorized Channel Partners</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          Authorized sales partners and channel brokers for {projectName} will appear here. Contact support to get connected with verified agents.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 pt-4 px-4 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-3xl p-6 shadow-md">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Verified Network</span>
          <h2 className="text-xl font-black tracking-tight mt-1">Authorized Channel Partners</h2>
          <p className="text-xs text-blue-200 mt-1">
            Connect directly with verified RERA-registered sales partners for {projectName}
          </p>
        </div>
        <div className="self-start sm:self-center px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-xs font-bold text-white flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-emerald-400" />
          {partners.length} RERA Verified Partners
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {partners.map((partner, i) => {
          const partnerType = partner.partner_type ? partner.partner_type.replace('_', ' ').toUpperCase() : 'AUTHORIZED PARTNER'
          const waMessage = encodeURIComponent(`Hi, I'm interested in ${projectName} and found your details on RealtyAsk. Can you share details?`)
          const waUrl = partner.phone ? `https://wa.me/${partner.phone.replace(/[^0-9]/g, '')}?text=${waMessage}` : null

          return (
            <div
              key={i}
              className="bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                      {partnerType}
                    </span>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight mt-2">
                      {partner.name}
                    </h3>
                  </div>
                  {partner.rera_registration && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200/50 dark:border-emerald-800/40 flex-shrink-0">
                      <ShieldCheck size={13} />
                      <span>RERA Verified</span>
                    </div>
                  )}
                </div>

                {partner.specialization && (
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                    <Award size={14} className="text-amber-500 flex-shrink-0" />
                    <span>{partner.specialization}</span>
                  </p>
                )}

                {partner.rera_registration && (
                  <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 p-2 rounded-xl border border-gray-100 dark:border-white/5">
                    RERA Reg: <span className="font-bold text-gray-800 dark:text-gray-200">{partner.rera_registration}</span>
                  </div>
                )}

                {partner.commission_structure && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-bold text-gray-800 dark:text-gray-200">Commission / Deal Note: </span>
                    {partner.commission_structure}
                  </div>
                )}
              </div>

              {/* Direct Contact Buttons */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {partner.phone && (
                  <a
                    href={`tel:${partner.phone}`}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gray-900 dark:bg-white hover:bg-black dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-xs font-extrabold transition-all"
                  >
                    <Phone size={14} />
                    Call
                  </a>
                )}

                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all"
                  >
                    <MessageSquare size={14} />
                    WhatsApp
                  </a>
                )}

                {partner.email && (
                  <a
                    href={`mailto:${partner.email}?subject=Inquiry regarding ${projectName}`}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-extrabold transition-all col-span-2 sm:col-span-1"
                  >
                    <Mail size={14} />
                    Email
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
