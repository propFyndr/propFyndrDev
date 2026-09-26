'use client'

import { useState } from 'react'
import { Plus, X, Save, IndianRupee, Layers, ShieldCheck, Zap, Info, Calculator } from 'lucide-react'
import { API_BASE } from '@/lib/env'
import { toast } from 'sonner'
import { adminAuthHeaders } from '@/lib/authedFetch'

export default function CostSheetEditor({ projectId, initialData }: { projectId: string; initialData?: any }) {
  const [bsp, setBsp] = useState(initialData?.base_price_per_sqft ?? '')
  const [floorRise, setFloorRise] = useState(initialData?.floor_rise_per_floor ?? '')
  
  const [gstPct, setGstPct] = useState(initialData?.gst_rate_pct ?? '5')
  const [gstNote, setGstNote] = useState(initialData?.gst_note ?? '')
  const [stampDutyPct, setStampDutyPct] = useState(initialData?.stamp_duty_pct ?? '7')
  const [regPct, setRegPct] = useState(initialData?.registration_pct ?? '1')

  const [parkingCost, setParkingCost] = useState(initialData?.parking_cost ?? '350000')
  const [clubMembership, setClubMembership] = useState(initialData?.club_membership ?? '150000')
  const [ifms, setIfms] = useState(initialData?.ifms ?? '50')
  const [electricity, setElectricity] = useState(initialData?.electricity_connection ?? '35000')
  const [waterSewer, setWaterSewer] = useState(initialData?.water_sewer_connection ?? '25000')
  const [maintenancePsf, setMaintenancePsf] = useState(initialData?.maintenance_psf_monthly ?? '3.5')

  const [plcCharges, setPlcCharges] = useState<any[]>(initialData?.plc_charges || [])
  const [otherCharges, setOtherCharges] = useState<any[]>(initialData?.other_charges || [])
  const [assumptions, setAssumptions] = useState<string[]>(initialData?.assumptions || [])
  const [newAssumption, setNewAssumption] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Real-time live calculation for a typical 1350 sqft unit
  const benchmarkSqft = 1350
  const bspNum = parseFloat(bsp) || 0
  const parkingNum = parseFloat(parkingCost) || 0
  const clubNum = parseFloat(clubMembership) || 0
  const ifmsRate = parseFloat(ifms) || 0
  const ifmsTotal = ifmsRate > 1000 ? ifmsRate : (ifmsRate * benchmarkSqft)
  const elecNum = parseFloat(electricity) || 0
  const waterNum = parseFloat(waterSewer) || 0

  const baseUnitCost = bspNum * benchmarkSqft
  const fixedAmenitiesCost = parkingNum + clubNum + ifmsTotal + elecNum + waterNum
  const preTaxSubtotal = baseUnitCost + fixedAmenitiesCost

  const gstRateNum = (parseFloat(gstPct) || 0) / 100
  const stampRateNum = (parseFloat(stampDutyPct) || 0) / 100
  const regRateNum = (parseFloat(regPct) || 0) / 100
  const totalTaxAmount = preTaxSubtotal * (gstRateNum + stampRateNum + regRateNum)

  const liveAllInclusiveTotal = preTaxSubtotal + totalTaxAmount
  const liveAllInclusiveCr = (Math.round((liveAllInclusiveTotal / 10000000) * 100) / 100).toFixed(2)
  const liveAllInclusivePsf = benchmarkSqft > 0 ? Math.round(liveAllInclusiveTotal / benchmarkSqft) : 0

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/cost-sheet`, {
        method: 'PUT',
        headers: { ...adminAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_price_per_sqft: bsp ? parseFloat(bsp) : null,
          floor_rise_per_floor: floorRise ? parseFloat(floorRise) : null,
          gst_rate_pct: gstPct ? parseFloat(gstPct) : null,
          gst_note: gstNote || null,
          stamp_duty_pct: stampDutyPct ? parseFloat(stampDutyPct) : null,
          registration_pct: regPct ? parseFloat(regPct) : null,
          parking_cost: parkingCost ? parseFloat(parkingCost) : null,
          club_membership: clubMembership ? parseFloat(clubMembership) : null,
          ifms: ifms ? parseFloat(ifms) : null,
          electricity_connection: electricity ? parseFloat(electricity) : null,
          water_sewer_connection: waterSewer ? parseFloat(waterSewer) : null,
          maintenance_psf_monthly: maintenancePsf ? parseFloat(maintenancePsf) : null,
          all_inclusive_price_cr: parseFloat(liveAllInclusiveCr),
          all_inclusive_per_sqft: liveAllInclusivePsf,
          plc_charges: plcCharges,
          other_charges: otherCharges,
          assumptions: assumptions
        }),
      })
      if (!res.ok) throw new Error('Failed to save cost sheet')
      toast.success('Complete cost sheet & all-inclusive pricing saved')
    } catch (e: any) {
      toast.error(e.message || 'Error saving cost sheet')
    } finally {
      setIsSaving(false)
    }
  }

  const addAssumption = () => {
    if (!newAssumption.trim()) return
    setAssumptions([...assumptions, newAssumption.trim()])
    setNewAssumption('')
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xs border border-zinc-200/90 dark:border-zinc-800 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900/40">
            <IndianRupee size={17} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">All-Inclusive Cost Sheet Breakdown</h3>
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">Configure base price, floor rise, utility charges, PLC, monthly maintenance, and government taxes.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#0066cc] hover:bg-[#0055b3] text-white px-4 py-2 rounded-xl text-[13px] font-medium flex items-center gap-2 transition-colors shadow-2xs disabled:opacity-50"
        >
          <Save size={14} /> {isSaving ? 'Saving...' : 'Save Cost Sheet'}
        </button>
      </div>

      {/* Real-time Live All-Inclusive Calculation Preview Card */}
      <div className="bg-zinc-900 dark:bg-black rounded-2xl p-5 text-white shadow-2xs border border-zinc-800 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700/60 flex items-center justify-center">
              <Calculator size={17} />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Live All-Inclusive Calculator (1,350 sqft Benchmark)
              </span>
              <h4 className="text-[19px] font-semibold tracking-tight text-white font-mono mt-0.5">
                ₹{liveAllInclusiveCr} Cr Total
                <span className="text-[12.5px] font-normal text-zinc-400 ml-2">
                  (₹{liveAllInclusivePsf.toLocaleString('en-IN')}/sqft All-In)
                </span>
              </h4>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] bg-zinc-800 text-zinc-300 border border-zinc-700/80 px-3 py-1 rounded-full font-medium font-mono">
              Monthly Maint: ₹{maintenancePsf || '3.5'}/sqft
            </span>
          </div>
        </div>

        {/* Breakdown Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-[12px]">
          <div className="bg-zinc-800/60 border border-zinc-700/50 p-2.5 rounded-xl">
            <span className="text-zinc-400 block text-[10.5px] uppercase tracking-wide font-medium">Base Cost (1350 sqft)</span>
            <span className="font-semibold font-mono text-white mt-0.5 block">₹{(baseUnitCost / 100000).toFixed(2)} L</span>
          </div>
          <div className="bg-zinc-800/60 border border-zinc-700/50 p-2.5 rounded-xl">
            <span className="text-zinc-400 block text-[10.5px] uppercase tracking-wide font-medium">Parking + Club + IFMS</span>
            <span className="font-semibold font-mono text-white mt-0.5 block">₹{(fixedAmenitiesCost / 100000).toFixed(2)} L</span>
          </div>
          <div className="bg-zinc-800/60 border border-zinc-700/50 p-2.5 rounded-xl">
            <span className="text-zinc-400 block text-[10.5px] uppercase tracking-wide font-medium">Govt Taxes (GST+Reg)</span>
            <span className="font-semibold font-mono text-white mt-0.5 block">₹{(totalTaxAmount / 100000).toFixed(2)} L</span>
          </div>
          <div className="bg-zinc-800/60 border border-zinc-700/50 p-2.5 rounded-xl">
            <span className="text-zinc-400 block text-[10.5px] uppercase tracking-wide font-medium">Monthly RWA Maint.</span>
            <span className="font-semibold font-mono text-white mt-0.5 block">₹{Math.round((parseFloat(maintenancePsf) || 3.5) * benchmarkSqft).toLocaleString('en-IN')}/mo</span>
          </div>
        </div>
      </div>

      {/* 1. Base Pricing & Taxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Base Price / Sqft (₹) *</label>
          <input value={bsp} onChange={(e) => setBsp(e.target.value)} className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-[13px] font-semibold font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" type="number" placeholder="6800" />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Floor Rise / Floor (₹)</label>
          <input value={floorRise} onChange={(e) => setFloorRise(e.target.value)} className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" type="number" placeholder="25" />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">GST Rate %</label>
          <input value={gstPct} onChange={(e) => setGstPct(e.target.value)} className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" type="number" placeholder="5" />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Stamp Duty + Reg %</label>
          <div className="flex gap-1.5">
            <input value={stampDutyPct} onChange={(e) => setStampDutyPct(e.target.value)} className="w-1/2 bg-white dark:bg-zinc-900 rounded-xl px-2.5 py-2 text-[12px] font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" type="number" placeholder="7%" />
            <input value={regPct} onChange={(e) => setRegPct(e.target.value)} className="w-1/2 bg-white dark:bg-zinc-900 rounded-xl px-2.5 py-2 text-[12px] font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" type="number" placeholder="1%" />
          </div>
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">GST Application Note</label>
          <input value={gstNote} onChange={(e) => setGstNote(e.target.value)} className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-[12.5px] text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" placeholder="e.g. 0% GST applicable for ready-to-move projects with Occupancy Certificate." />
        </div>
      </div>

      {/* 2. Possession & Utility Charges */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2.5">Possession & Utility One-Time Charges (₹)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <span className="text-[12px] text-zinc-600 dark:text-zinc-400 font-medium block mb-1">Covered Parking (₹)</span>
            <input value={parkingCost} onChange={(e) => setParkingCost(e.target.value)} className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" type="number" placeholder="350000" />
          </div>
          <div>
            <span className="text-[12px] text-zinc-600 dark:text-zinc-400 font-medium block mb-1">Club Membership (₹)</span>
            <input value={clubMembership} onChange={(e) => setClubMembership(e.target.value)} className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" type="number" placeholder="150000" />
          </div>
          <div>
            <span className="text-[12px] text-zinc-600 dark:text-zinc-400 font-medium block mb-1">IFMS Deposit (₹/sqft or ₹ total)</span>
            <input value={ifms} onChange={(e) => setIfms(e.target.value)} className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" type="number" placeholder="50" />
          </div>
          <div>
            <span className="text-[12px] text-zinc-600 dark:text-zinc-400 font-medium block mb-1">Electricity Meter (₹)</span>
            <input value={electricity} onChange={(e) => setElectricity(e.target.value)} className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" type="number" placeholder="35000" />
          </div>
          <div>
            <span className="text-[12px] text-zinc-600 dark:text-zinc-400 font-medium block mb-1">Water & Sewer (₹)</span>
            <input value={waterSewer} onChange={(e) => setWaterSewer(e.target.value)} className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" type="number" placeholder="25000" />
          </div>
          <div>
            <span className="text-[12px] text-[#0066cc] dark:text-blue-400 font-medium block mb-1">Monthly Maint. (₹/sqft)</span>
            <input value={maintenancePsf} onChange={(e) => setMaintenancePsf(e.target.value)} className="w-full bg-blue-50/40 dark:bg-blue-950/20 rounded-xl px-3 py-2 text-[13px] font-semibold font-mono text-[#0066cc] dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 focus:border-[#0066cc] outline-none shadow-2xs" type="number" step="0.1" placeholder="3.5" />
          </div>
        </div>
      </div>

      {/* 3. PLC Charges */}
      <div>
        <div className="flex justify-between items-center mb-2.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">PLC Charges (₹ / Sq.ft)</label>
          <button onClick={() => setPlcCharges([...plcCharges, { label: '', amount_per_sqft: '' }])} className="text-[12.5px] font-medium text-[#0066cc] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
            <Plus size={13} /> Add PLC Tier
          </button>
        </div>
        <div className="space-y-2">
          {plcCharges.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input value={p.label} onChange={(e) => { const n = [...plcCharges]; n[i].label = e.target.value; setPlcCharges(n) }} placeholder="Park / Green Facing" className="flex-1 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-[13px] font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" />
              <input value={p.amount_per_sqft} onChange={(e) => { const n = [...plcCharges]; n[i].amount_per_sqft = e.target.value ? parseFloat(e.target.value) : ''; setPlcCharges(n) }} placeholder="150" type="number" className="w-32 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs" />
              <button onClick={() => setPlcCharges(plcCharges.filter((_, idx) => idx !== i))} className="p-2 text-zinc-400 hover:text-rose-500 cursor-pointer transition-colors"><X size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Cost Assumptions List */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2.5">Cost Sheet Assumptions & Guidelines</label>
        <div className="space-y-2 mb-2">
          {assumptions.map((a, i) => (
            <div key={i} className="flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-800/40 p-2.5 px-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-800 text-[12.5px] font-medium text-zinc-700 dark:text-zinc-300">
              <span>• {a}</span>
              <button onClick={() => setAssumptions(assumptions.filter((_, idx) => idx !== i))} className="text-zinc-400 hover:text-rose-500 p-1 cursor-pointer transition-colors"><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newAssumption}
            onChange={(e) => setNewAssumption(e.target.value)}
            className="flex-1 bg-white dark:bg-zinc-900 rounded-xl px-3.5 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none shadow-2xs"
            placeholder="Add new assumption guideline..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAssumption()
              }
            }}
          />
          <button onClick={addAssumption} className="bg-[#0066cc] hover:bg-[#0055b3] text-white px-4 py-2 rounded-xl text-[12.5px] font-medium transition-colors cursor-pointer shadow-2xs">Add</button>
        </div>
      </div>
    </div>
  )
}
