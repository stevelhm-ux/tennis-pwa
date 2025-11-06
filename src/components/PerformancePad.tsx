// src/components/PerformancePad.tsx
import React, { useMemo, useState } from 'react'
import { useMatchStore } from '@/store/useMatchStore'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ServeMode = 'serve' | 'return'
type ServeDetail =
  | 'first_in'
  | 'second_in'
  | 'double_fault'
  | 'return_ok'
  | 'return_nok'
  | 'opp_double_fault'

type EndWin =
  | 'fh_winner'
  | 'bh_winner'
  | 'net_won'
  | 'rally_won'
  | 'opp_error'

type EndLose = 'fh_error' | 'bh_error' | 'opp_winner' | 'net_error'

const WELL = ['Attack', 'Defence', 'Serve', 'Footwork', 'Approach', 'Creativity', 'Position'] as const
const TODO = WELL

function Chip({
  label,
  active,
  onClick,
  tone = 'slate', // 'green'|'red'|'blue'|'amber'|'slate'
}: {
  label: string
  active?: boolean
  onClick?: () => void
  tone?: 'green' | 'red' | 'blue' | 'amber' | 'slate' | 'violet'
}) {
  const base =
    'px-3 py-2 rounded-xl border text-sm font-medium transition-colors select-none'
  const tones: Record<string, string> = {
    green: active
      ? 'bg-green-600 text-white border-green-700'
      : 'bg-white text-green-700 border-green-300 hover:bg-green-50',
    red: active
      ? 'bg-red-600 text-white border-red-700'
      : 'bg-white text-red-700 border-red-300 hover:bg-red-50',
    blue: active
      ? 'bg-blue-600 text-white border-blue-700'
      : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50',
    amber: active
      ? 'bg-amber-500 text-white border-amber-600'
      : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50',
    violet: active
      ? 'bg-violet-600 text-white border-violet-700'
      : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-50',
    slate: active
      ? 'bg-slate-800 text-white border-slate-900'
      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50',
  }
  return (
    <button className={`${base} ${tones[tone]}`} onClick={onClick} type="button">
      {label}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-sm font-semibold text-slate-800 mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{children}</div>
    </div>
  )
}

export default function PerformancePad() {
  const matchId = useMatchStore((s) => s.matchId)
  const addPoint = useMatchStore((s) => s.addPoint)
  const undo = useMatchStore((s) => s.undo)

  const disabled = !matchId || !UUID_RE.test(matchId)

  // A) Serve/Return + detail
  const [mode, setMode] = useState<ServeMode>('serve')
  const [serveDetail, setServeDetail] = useState<ServeDetail | null>(null)

  // B) How point ended
  const [endWin, setEndWin] = useState<EndWin | null>(null)
  const [endLose, setEndLose] = useState<EndLose | null>(null)

  // C) Areas Done Well (multi)
  const [doneWell, setDoneWell] = useState<Set<string>>(new Set())
  // D) Areas to Improve (multi)
  const [toImprove, setToImprove] = useState<Set<string>>(new Set())

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function resetSelections() {
    setServeDetail(null)
    setEndWin(null)
    setEndLose(null)
    setDoneWell(new Set())
    setToImprove(new Set())
  }

  function buildPointInput(pointWon: boolean) {
    // server: A = my player serves; B = opponent serves
    const server = mode === 'serve' ? 'A' : 'B'

    // serve flags
    let first_serve_in: boolean | null = null
    let second_serve_in: boolean | null = null
    let finish_type: 'Winner' | 'UE' | 'Forced' | 'Ace' | 'DF' | null = null

    if (mode === 'serve') {
      if (serveDetail === 'first_in') first_serve_in = true
      if (serveDetail === 'second_in') {
        first_serve_in = false
        second_serve_in = true
      }
      if (serveDetail === 'double_fault') {
        first_serve_in = false
        second_serve_in = false
        finish_type = 'DF'
      }
    } else {
      // return mode
      if (serveDetail === 'return_ok') {
        // no explicit flag, just informational; could map to tags
      }
      if (serveDetail === 'return_nok') {
        // also informational
      }
      if (serveDetail === 'opp_double_fault') {
        finish_type = 'DF'
      }
    }

    // finishing shot / outcome type from Section B
    let finishing_shot: 'FH' | 'BH' | 'Volley' | 'Overhead' | null = null

    if (endWin) {
      if (endWin === 'fh_winner') {
        finishing_shot = 'FH'
        finish_type = finish_type ?? 'Winner'
      } else if (endWin === 'bh_winner') {
        finishing_shot = 'BH'
        finish_type = finish_type ?? 'Winner'
      } else if (endWin === 'net_won') {
        finishing_shot = 'Volley'
        finish_type = finish_type ?? 'Winner'
      } else if (endWin === 'rally_won') {
        finish_type = finish_type ?? 'Forced' // or 'Winner', your choice
      } else if (endWin === 'opp_error') {
        finish_type = 'UE'
      }
    }

    if (endLose) {
      if (endLose === 'fh_error') {
        finishing_shot = 'FH'
        finish_type = 'UE'
      } else if (endLose === 'bh_error') {
        finishing_shot = 'BH'
        finish_type = 'UE'
      } else if (endLose === 'opp_winner') {
        finish_type = 'Winner'
      } else if (endLose === 'net_error') {
        finishing_shot = 'Volley'
        finish_type = 'UE'
      }
    }

    // tags from C & D
    const tags: string[] = [
      ...Array.from(doneWell).map((x) => `good:${x}`),
      ...Array.from(toImprove).map((x) => `todo:${x}`),
    ]

    return {
      server, // 'A' | 'B'
      first_serve_in,
      second_serve_in,
      rally_len: null,
      finishing_shot,
      outcome: pointWon ? 'A' : 'B',
      finish_type,
      tags,
    } as const
  }

  function ensureReady(): boolean {
    if (disabled) {
      alert('Match isn’t ready yet. Please go back and open it from the list.')
      return false
    }
    // Optional: you can enforce some minimal selection; currently free-form
    return true
  }

  function onPoint(pointWon: boolean) {
    if (!ensureReady()) return
    const payload = buildPointInput(pointWon)
    addPoint(payload)
    resetSelections()
  }

  const serveButtons = useMemo(() => {
    if (mode === 'serve') {
      return (
        <>
          <Chip
            label="First Serve In"
            active={serveDetail === 'first_in'}
            onClick={() => setServeDetail('first_in')}
            tone="blue"
          />
          <Chip
            label="Second Serve In"
            active={serveDetail === 'second_in'}
            onClick={() => setServeDetail('second_in')}
            tone="blue"
          />
          <Chip
            label="Double Fault"
            active={serveDetail === 'double_fault'}
            onClick={() => setServeDetail('double_fault')}
            tone="red"
          />
        </>
      )
    }
    return (
      <>
        <Chip
          label="Return OK"
          active={serveDetail === 'return_ok'}
          onClick={() => setServeDetail('return_ok')}
          tone="green"
        />
        <Chip
          label="Return NOK"
          active={serveDetail === 'return_nok'}
          onClick={() => setServeDetail('return_nok')}
          tone="amber"
        />
        <Chip
          label="Opp Double Fault"
          active={serveDetail === 'opp_double_fault'}
          onClick={() => setServeDetail('opp_double_fault')}
          tone="violet"
        />
      </>
    )
  }, [mode, serveDetail])

  return (
    <div className="rounded-2xl border p-3 bg-white shadow-sm">
      {/* Section A */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-800">Point context</div>
        <div className="flex gap-2">
          <Chip
            label="Serve Game"
            active={mode === 'serve'}
            onClick={() => setMode('serve')}
            tone="slate"
          />
          <Chip
            label="Return Game"
            active={mode === 'return'}
            onClick={() => setMode('return')}
            tone="slate"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">{serveButtons}</div>

      {/* Section B: How the point ended */}
      <Section title="How the point ended (Win)">
        <Chip
          label="FH Winner"
          active={endWin === 'fh_winner'}
          onClick={() => {
            setEndWin('fh_winner')
            setEndLose(null)
          }}
          tone="green"
        />
        <Chip
          label="BH Winner"
          active={endWin === 'bh_winner'}
          onClick={() => {
            setEndWin('bh_winner')
            setEndLose(null)
          }}
          tone="green"
        />
        <Chip
          label="Net Won"
          active={endWin === 'net_won'}
          onClick={() => {
            setEndWin('net_won')
            setEndLose(null)
          }}
          tone="green"
        />
        <Chip
          label="Rally Won"
          active={endWin === 'rally_won'}
          onClick={() => {
            setEndWin('rally_won')
            setEndLose(null)
          }}
          tone="green"
        />
        <Chip
          label="Opp Error"
          active={endWin === 'opp_error'}
          onClick={() => {
            setEndWin('opp_error')
            setEndLose(null)
          }}
          tone="green"
        />
      </Section>

      <Section title="How the point ended (Lose)">
        <Chip
          label="FH error"
          active={endLose === 'fh_error'}
          onClick={() => {
            setEndLose('fh_error')
            setEndWin(null)
          }}
          tone="red"
        />
        <Chip
          label="BH error"
          active={endLose === 'bh_error'}
          onClick={() => {
            setEndLose('bh_error')
            setEndWin(null)
          }}
          tone="red"
        />
        <Chip
          label="Opp Winner"
          active={endLose === 'opp_winner'}
          onClick={() => {
            setEndLose('opp_winner')
            setEndWin(null)
          }}
          tone="red"
        />
        <Chip
          label="Net error"
          active={endLose === 'net_error'}
          onClick={() => {
            setEndLose('net_error')
            setEndWin(null)
          }}
          tone="red"
        />
      </Section>

      {/* Section C */}
      <Section title="Areas Done Well">
        {WELL.map((w) => (
          <Chip
            key={w}
            label={w}
            active={doneWell.has(w)}
            onClick={() => toggle(setDoneWell, w)}
            tone="blue"
          />
        ))}
      </Section>

      {/* Section D */}
      <Section title="Areas to Improve">
        {TODO.map((t) => (
          <Chip
            key={t}
            label={t}
            active={toImprove.has(t)}
            onClick={() => toggle(setToImprove, t)}
            tone="amber"
          />
        ))}
      </Section>

      {/* Bottom actions */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          className="px-3 py-4 rounded-xl border text-lg font-semibold bg-green-600 text-white hover:opacity-90 disabled:opacity-50"
          onClick={() => onPoint(true)}
          disabled={disabled}
        >
          Point Won
        </button>
        <button
          className="px-3 py-4 rounded-xl border text-lg font-semibold bg-red-600 text-white hover:opacity-90 disabled:opacity-50"
          onClick={() => onPoint(false)}
          disabled={disabled}
        >
          Point Lost
        </button>
      </div>
      <div className="mt-2">
        <button
          className="px-3 py-2 rounded-lg border text-sm hover:bg-slate-50"
          onClick={() => undo()}
        >
          Undo
        </button>
      </div>

      {disabled && (
        <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          This match isn’t ready. Open it from the Matches list again.
        </div>
      )}
    </div>
  )
}
