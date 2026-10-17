'use client'

import React, { useState, useEffect } from 'react'
import { WarningCircle, Check } from '@phosphor-icons/react'

interface JsonEditorProps {
  value: any
  onChange: (val: any) => void
  label: string
  description?: string
  placeholder?: string
}

export default function JsonEditor({ value, onChange, label, description, placeholder }: JsonEditorProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setText(value ? JSON.stringify(value, null, 2) : '')
    setError(null)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)
    if (!val.trim()) {
      setError(null)
      onChange(null)
      return
    }
    try {
      const parsed = JSON.parse(val)
      setError(null)
      onChange(parsed)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-[13px] font-bold text-gray-900">{label}</label>
      {description && <p className="text-[12px] text-gray-500 leading-snug">{description}</p>}
      
      <div className="relative">
        <textarea
          value={text}
          onChange={handleChange}
          placeholder={placeholder || '{\n  "key": "value"\n}'}
          className={`w-full h-64 font-mono text-[12px] p-4 rounded-xl border ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'} bg-slate-50 focus:bg-white transition-all outline-none resize-y`}
          spellCheck={false}
        />
        {error ? (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 shadow-sm">
            <WarningCircle size={14} />
            Invalid JSON
          </div>
        ) : text.trim() ? (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
            <Check size={14} />
            Valid JSON
          </div>
        ) : null}
      </div>
    </div>
  )
}
