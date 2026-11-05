'use client'

import { useState } from 'react'
import { X, Calculator, Receipt, TrendingDown } from 'lucide-react'
import { calculateEmi, calculateStampDuty, calculateGst } from '@/lib/calculators'
import { formatInr } from '@/lib/format'
import CustomSelect from './admin/CustomSelect'


interface Props {
  onClose: () => void
  defaultPriceCr?: number
}

type Tab = 'emi' | 'stamp' | 'gst'

export default function CalculatorPanel({ onClose, defaultPriceCr = 1.5 }: Props) {
  const [tab, setTab] = useState<Tab>('emi')


  const [principal, setPrincipal]     = useState(String((defaultPriceCr * 0.8).toFixed(2)))
  const [rate, setRate]               = useState('8.5')
  const [tenure, setTenure]           = useState('20')
  const [stampPrice, setStampPrice]   = useState(String(defaultPriceCr))
  const [gender, setGender]           = useState<'male' | 'female'>('male')
  const [gstPrice, setGstPrice]       = useState(String(defaultPriceCr))
  const [gstStatus, setGstStatus]     = useState<'under_construction' | 'ready_to_move'>('under_construction')
  const [carpetSqm, setCarpetSqm]     = useState('')

  const emiResult = (() => {
    const p = parseFloat(principal), r = parseFloat(rate), t = parseFloat(tenure)
    if (!p || !r || !t || p <= 0 || r <= 0 || t <= 0) return null
    return calculateEmi(p, r, t)
  })()

  const stampResult = (() => {
    const p = parseFloat(stampPrice)
    if (!p || p <= 0) return null
    return calculateStampDuty(p, gender)
  })()

  const gstResult = (() => {
    const p = parseFloat(gstPrice)
    if (!p || p <= 0) return null
    return calculateGst(p, gstStatus, parseFloat(carpetSqm) || 0)
  })()

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'emi',   label: 'EMI',        icon: <Calculator size={13} /> },
    { id: 'stamp', label: 'Stamp Duty', icon: <Receipt size={13} /> },
    { id: 'gst',   label: 'GST',        icon: <TrendingDown size={13} /> },

  ]

  const inputCls = 'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors'
  const labelCls = 'block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider'
  const rowCls   = 'flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/60 last:border-0'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[460px] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Calculator size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">Property Calculator</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-5 pt-4 flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all ${
                tab === t.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* EMI */}
          {tab === 'emi' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Loan (Cr)</label>
                  <input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} step="0.1" min="0" className={inputCls} placeholder="1.20" />
                </div>
                <div>
                  <label className={labelCls}>Rate %</label>
                  <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} step="0.05" min="0" className={inputCls} placeholder="8.5" />
                </div>
                <div>
                  <label className={labelCls}>Years</label>
                  <input type="number" value={tenure} onChange={(e) => setTenure(e.target.value)} step="1" min="1" max="30" className={inputCls} placeholder="20" />
                </div>
              </div>

              {emiResult && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800/40">
                  <p className="text-[10px] text-blue-500 dark:text-blue-400 font-bold uppercase tracking-wider mb-2">Monthly EMI</p>
                  <p className="text-[30px] font-black text-blue-600 dark:text-blue-400 leading-none mb-3">
                    {formatInr(emiResult.emi_monthly)}<span className="text-[14px] font-semibold">/mo</span>
                  </p>
                  <div className={rowCls}>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">Principal</span>
                    <span className="text-[13px] font-bold text-gray-900 dark:text-white">{formatInr(emiResult.principal)}</span>
                  </div>
                  <div className={rowCls}>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">Total interest</span>
                    <span className="text-[13px] font-bold text-red-500">{formatInr(emiResult.total_interest)}</span>
                  </div>
                  <div className={rowCls}>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">Total payment</span>
                    <span className="text-[13px] font-bold text-gray-900 dark:text-white">{formatInr(emiResult.total_payment)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Stamp Duty */}
          {tab === 'stamp' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Property Price (Cr)</label>
                  <input type="number" value={stampPrice} onChange={(e) => setStampPrice(e.target.value)} step="0.1" min="0" className={inputCls} placeholder="2.00" />
                </div>
                <div>
                  <label className={labelCls}>Buyer</label>
                  <CustomSelect
                    value={gender}
                    onChange={(val) => setGender(val as 'male' | 'female')}
                    options={[
                      { value: 'male', label: 'Male (7%)' },
                      { value: 'female', label: 'Woman primary owner (6%)' },
                                    ]}
                    size="sm"
                    className="w-full"
                  />
                </div>
              </div>

              {stampResult && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-800/40">
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider mb-2">Total Govt Charges</p>
                  <p className="text-[30px] font-black text-amber-600 dark:text-amber-400 leading-none mb-3">
                    {formatInr(stampResult.total_charges)}
                  </p>
                  <div className={rowCls}>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">Stamp duty ({stampResult.stamp_duty_rate}%)</span>
                    <span className="text-[13px] font-bold text-gray-900 dark:text-white">{formatInr(stampResult.stamp_duty)}</span>
                  </div>
                  <div className={rowCls}>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">Registration (1%)</span>
                    <span className="text-[13px] font-bold text-gray-900 dark:text-white">{formatInr(stampResult.registration)}</span>
                  </div>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400/80 mt-2 leading-relaxed">{stampResult.note}</p>
                </div>
              )}
            </>
          )}


          {/* GST */}
          {tab === 'gst' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Price (Cr)</label>
                  <input type="number" value={gstPrice} onChange={(e) => setGstPrice(e.target.value)} step="0.1" min="0" className={inputCls} placeholder="1.50" />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <CustomSelect
                    value={gstStatus}
                    onChange={(val) => setGstStatus(val as 'under_construction' | 'ready_to_move')}
                    options={[
                      { value: 'under_construction', label: 'Under Construction' },
                      { value: 'ready_to_move', label: 'Ready to Move' },
                    ]}
                    size="sm"
                    className="w-full"
                  />
                </div>
              </div>
              {gstStatus === 'under_construction' && (
                <div>
                  <label className={labelCls}>Carpet Area (sqm) — for affordable check</label>
                  <input type="number" value={carpetSqm} onChange={(e) => setCarpetSqm(e.target.value)} step="1" min="0" className={inputCls} placeholder="85" />
                </div>
              )}

              {gstResult && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800/40">
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-2">GST Applicable</p>
                  <p className="text-[30px] font-black text-emerald-600 dark:text-emerald-400 leading-none mb-3">
                    {formatInr(gstResult.gst_amount)}
                    <span className="text-[14px] font-semibold ml-2">({gstResult.gst_rate}%)</span>
                  </p>
                  <div className={rowCls}>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">Category</span>
                    <span className="text-[13px] font-bold text-gray-900 dark:text-white capitalize">{gstResult.category.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400/80 mt-2 leading-relaxed">{gstResult.note}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
