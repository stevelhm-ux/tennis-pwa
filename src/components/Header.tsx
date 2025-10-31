
import React from 'react'

export function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      {onBack && (
        <button onClick={onBack} className="px-3 py-2 rounded-lg bg-slate-100 active:scale-95">← Back</button>
      )}
      <h1 className="text-xl font-bold">{title}</h1>
    </div>
  )
}
