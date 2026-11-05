'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts'
import { TrendingUp, Calculator } from 'lucide-react'

interface Props {
  priceHistory?: { year: number; price_psf: number }[]
  unitPriceCr?: number
  otherCharges?: { label: string; amount: number; frequency: string; per: string }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appreciationData?: any
}

export default function PricingCharts({ priceHistory, unitPriceCr, otherCharges, appreciationData }: Props) {
  // 1. Price History Chart Data
  const historyData = useMemo(() => {
    return priceHistory || []
  }, [priceHistory])

  // 2. Appreciation Projection Data
  const appreciationChartData = useMemo(() => {
    if (!appreciationData) return []
    const parsePct = (str?: string) => {
      if (!str) return 0
      const match = str.match(/\d+(\.\d+)?/g)
      if (!match) return 0
      // If it's a range like "12-15%", take the average
      const nums = match.map(Number)
      if (nums.length === 2) return (nums[0] + nums[1]) / 2
      return nums[0]
    }
    const y1 = parsePct(appreciationData.appreciation_1yr)
    const y3 = parsePct(appreciationData.appreciation_3yr)
    const y5 = parsePct(appreciationData.appreciation_5yr)
    
    if (y1 === 0 && y3 === 0 && y5 === 0) return []
    
    return [
      { year: 'Now', growth: 0 },
      { year: '1 Yr', growth: y1 },
      { year: '3 Yrs', growth: y3 },
      { year: '5 Yrs', growth: y5 }
    ]
  }, [appreciationData])

  // 3. EMI Sensitivity (Bar)
  const emiData = useMemo(() => {
    if (!unitPriceCr) return []
    const principal = unitPriceCr * 10000000 * 0.8 // 80% loan
    const rates = [8.0, 8.5, 9.0, 9.5]
    const years = 20
    const n = years * 12
    
    return rates.map(r => {
      const rMon = r / 12 / 100
      const emi = (principal * rMon * Math.pow(1 + rMon, n)) / (Math.pow(1 + rMon, n) - 1)
      return {
        rate: `${r}%`,
        emi: Math.round(emi),
        emiLakhs: (emi / 100000).toFixed(2)
      }
    })
  }, [unitPriceCr])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      
      {/* Price History */}
      {historyData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <TrendingUp className="text-blue-600 dark:text-blue-400" size={18} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">Historical Price Trend</h3>
              <p className="text-[12px] text-gray-500">Average price per sq.ft over time</p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(val) => `₹${val}`} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Price PSF']}
                />
                <Line type="monotone" dataKey="price_psf" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}



      {/* Appreciation Projection Area Chart */}
      {appreciationChartData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <TrendingUp className="text-emerald-600 dark:text-emerald-400" size={18} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">Appreciation Projection</h3>
              <p className="text-[12px] text-gray-500">Projected growth over 1, 3, and 5 years</p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={appreciationChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(val) => `${val}%`} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`+${value}%`, 'Projected Growth']}
                />
                <Line type="monotone" dataKey="growth" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#10b981' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* EMI Sensitivity */}
      {emiData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <Calculator className="text-amber-600 dark:text-amber-400" size={18} />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">EMI Sensitivity Analysis</h3>
                <p className="text-[12px] text-gray-500">Based on 80% loan for 20 years across interest rates</p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-[20px] font-black text-gray-900 dark:text-white block">{unitPriceCr ? `₹${unitPriceCr.toFixed(2)} Cr` : 'Price on request'}</span>
              <span className="text-[11px] text-gray-400 font-bold uppercase">Reference Price</span>
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emiData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} maxBarSize={60}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                <XAxis dataKey="rate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 'bold' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} />
                <RechartsTooltip 
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Monthly EMI']}
                />
                <Bar dataKey="emi" radius={[6, 6, 0, 0]}>
                  {emiData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 1 ? '#3b82f6' : '#93c5fd'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  )
}
