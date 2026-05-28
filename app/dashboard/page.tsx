'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATI_LABEL: Record<string, string> = {
  ricevuto: 'Ricevuto', in_valutazione: 'In valutazione', valutato: 'Valutato',
  finalista: 'Finalista', eliminato: 'Eliminato', vincitore: 'Vincitore',
}
const STATO_BADGE: Record<string, string> = {
  ricevuto: 'bg-gray-100 text-gray-600', in_valutazione: 'bg-blue-50 text-blue-600',
  valutato: 'bg-teal-50 text-teal-600', finalista: 'bg-purple-50 text-purple-600',
  eliminato: 'bg-red-50 text-red-500', vincitore: 'bg-amber-100 text-amber-600',
}
const TIPO_CONFIG: Record<string, { badge: string; attivo: string; label: string }> = {
  interno: { badge: 'bg-purple-100 text-purple-700', attivo: 'bg-purple-50 border-purple-400 text-purple-800', label: 'INT' },
  lettore: { badge: 'bg-blue-100 text-blue-700',    attivo: 'bg-blue-50 border-blue-400 text-blue-800',     label: 'LET' },
  qualita: { badge: 'bg-amber-100 text-amber-700',  attivo: 'bg-amber-50 border-amber-400 text-amber-800',  label: 'QUA' },
}
const CRITERI = [
  { key: 'a', label: 'Incipit' }, { key: 'b', label: 'Svolta narrativa' },
  { key: 'c', label: 'Climax' },  { key: 'd', label: 'Scioglimento' },
  { key: 'e', label: 'Giudizio complessivo' },
]
const SEZIONI = ['racconti', 'assegnazioni', 'finalisti', 'risultati', 'giurati'] as const
const STATI_ORDINE = ['ricevuto', 'in_valutazione', 'valutato', 'finalista', 'eliminato', 'vincitore']
type Sezione = typeof SEZIONI[number]
type SortKey = 'titolo' | 'autore' | 'data'
type SortDir = 'asc' | 'desc'

function fmt(stato: string) { return STATI_LABEL[stato] ?? stato }

function autoreLabel(r: any) {
  return r.autore_nome ? `${r.autore_nome} ${r.autore_cognome}` : `${r.profiles?.nome ?? ''} ${r.profiles?.cognome ?? ''}`
}

function sortRacconti(list: any[], key: SortKey, dir: SortDir) {
  return [...list].sort((a, b) => {
    let va = '', vb = ''
    if (key === 'titolo') { va = a.titolo ?? ''; vb = b.titolo ?? '' }
    if (key === 'autore') { va = autoreLabel(a); vb = autoreLabel(b) }
    if (key === 'data')   { va = a.inviato_il ?? ''; vb = b.inviato_il ?? '' }
    return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })
}

function SortBar({ sortKey, sortDir, onChange }: {
  sortKey: SortKey; sortDir: SortDir
  onChange: (k: SortKey, d: SortDir) => void
}) {
  function toggle(k: SortKey) {
    if (sortKey === k) onChange(k, sortDir === 'asc' ? 'desc' : 'asc')
    else onChange(k, 'asc')
  }
  const btn = (k: SortKey, label: string) => (
    <button onClick={() => toggle(k)}
      className={`text-xs px-2 py-1 rounded border transition-colors ${sortKey === k ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-400 mr-1">Ordina:</span>
      {btn('titolo', 'Titolo')}
      {btn('autore', 'Autore')}
      {btn('data', 'Data')}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()

  const [racconti, setRacconti]                           = useState<any[]>([])
  const [giurati, setGiurati]                             = useState<any[]>([])
  const [assegnazioniEsistenti, setAssegnazioniEsistenti] = useState<any[]>([])
  const [valutazioni, setValutazioni]                     = useState<any[]>([])
  const [medie, setMedie]                                 = useState<any[]>([])
  const [profilo, setProfilo]                             = useState<any>(null)
  const [caricamento, setCaricamento]                     = useState(true)
  const [linkGenerati, setLinkGenerati]                   = useState<Record<string, string>>({})
  const [generando, setGenerando]                         = useState<string | null>(null)
  const [nuovoGiurato, setNuovoGiurato]                   = useState({ nome: '', cognome: '', email: '', tipo_giurato: 'lettore' })
  const [aggiungendo, setAggiungendo]                     = useState(false)
  const [messaggioGiurato, setMessaggioGiurato]           = useState('')
  const [sezione, setSezione] = useState<Sezione>(() => {
    if (typeof window === 'undefined') return 'racconti'
    const h = window.location.hash.replace('#', '')
    return (SEZIONI as readonly string[]).includes(h) ? h as Sezione : 'racconti'
  })

  const [raccontiFilter, setRaccontiFilter] = useState('')
  const [raccontiStato, setRaccontiStato]   = useState('')
  const [raccontiSort, setRaccontiSort]     = useState<SortKey>('data')
  const [raccontiDir, setRaccontiDir]       = useState<SortDir>('desc')

  const [assFilter, setAssFilter] = useState('')
  const [assSort, setAssSort]     = useState<SortKey>('data')
  const [assDir, setAssDir]       = useState<SortDir>('desc')
  const [assOpen, setAssOpen]     = useState<Record<string, boolean>>({
    'Da assegnare': true, 'In valutazione': true, 'Valutati': false, 'Eliminati': false,
  })

  const [risFilter, setRisFilter] = useState('')
  const [risSort, setRisSort]     = useState<SortKey>('titolo')
  const [risDir, setRisDir]       = useState<SortDir>('asc')

  const [giuratiFilter, setGiuratiFilter] = useState('')
  const [giuratiSort, setGiuratiSort]     = useState<'nome' | 'cognome'>('cognome')

  function cambiaSezione(s: Sezione) { setSezione(s); window.location.hash = s }

  async function carica() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: p } = await supabase.from('profiles').select('ruolo, is_admin, nome, cognome').eq('id', user.id).single()
    if (!p?.is_admin) { router.push('/login'); return }
    setProfilo(p)
    const [{ data: r }, { data: g }, { data: m }, { data: a }, { data: v }] = await Promise.all([
      supabase.from('racconti').select('*, profiles(nome, cognome)').order('inviato_il', { ascending: false }),
      supabase.from('profiles').select('*').eq('ruolo', 'giurato'),
      supabase.from('medie_racconti').select('*').order('media_complessiva', { ascending: false }),
      supabase.from('assegnazioni').select('*'),
      supabase.from('valutazioni').select('*, assegnazioni(racconto_id, giurato_id, profiles(nome, cognome))'),
    ])
    setRacconti(r || []); setGiurati(g || []); setMedie(m || [])
    setAssegnazioniEsistenti(a || []); setValutazioni(v || [])
    setCaricamento(false)
  }

  useEffect(() => { carica() }, [])

  async function aggiornaStato(racconto_id: string, stato: string) {
    await supabase.from('racconti').update({ stato }).eq('id', racconto_id)
    setRacconti(prev => prev.map(r => r.id === racconto_id ? { ...r, stato } : r))
    setMedie(prev => prev.map(m => m.racconto_id === racconto_id ? { ...m, stato } : m))
  }

  async function assegna(racconto_id: string, giurato_id: string, fase: string) {
    const racconto = racconti.find(r => r.id === racconto_id)
    if (fase !== 'finale') {
      if (['valutato', 'finalista', 'eliminato', 'vincitore'].includes(racconto?.stato)) return
    } else {
      if (['eliminato', 'vincitore'].includes(racconto?.stato)) return
    }
    const tipoGiurato = giurati.find(g => g.id === giurato_id)?.tipo_giurato
    const assegnazioniRacconto = assegnazioniEsistenti.filter(a => a.racconto_id === racconto_id)
    const assegnazioneEsistente = assegnazioniRacconto.find(a => a.giurato_id === giurato_id)
    if (assegnazioneEsistente) {
      if (!!assegnazioneEsistente.completata) return
      const { error } = await supabase.from('assegnazioni')
        .delete().eq('racconto_id', racconto_id).eq('giurato_id', giurato_id)
      if (error) return
      const nuove = assegnazioniEsistenti.filter(a => !(a.racconto_id === racconto_id && a.giurato_id === giurato_id))
      setAssegnazioniEsistenti(nuove)
      if (nuove.filter(a => a.racconto_id === racconto_id).length === 0) {
        await supabase.from('racconti').update({ stato: 'ricevuto' }).eq('id', racconto_id)
        setRacconti(prev => prev.map(r => r.id === racconto_id ? { ...r, stato: 'ricevuto' } : r))
      }
      return
    }
    if (tipoGiurato === 'interno' || tipoGiurato === 'lettore') {
      const occupante = assegnazioniRacconto.find(a =>
        giurati.find(g => g.id === a.giurato_id)?.tipo_giurato === tipoGiurato
      )
      if (occupante) {
        if (!!occupante.completata) return
        const { error } = await supabase.from('assegnazioni')
          .delete().eq('racconto_id', racconto_id).eq('giurato_id', occupante.giurato_id)
        if (error) return
        setAssegnazioniEsistenti(prev => prev.filter(
          a => !(a.racconto_id === racconto_id && a.giurato_id === occupante.giurato_id)
        ))
      }
    }
    const { data, error } = await supabase.from('assegnazioni')
      .insert({ racconto_id, giurato_id, fase }).select().single()
    if (error || !data) return
    setAssegnazioniEsistenti(prev => [...prev, data])
    if (racconto?.stato === 'ricevuto') {
      await supabase.from('racconti').update({ stato: 'in_valutazione' }).eq('id', racconto_id)
      setRacconti(prev => prev.map(r => r.id === racconto_id ? { ...r, stato: 'in_valutazione' } : r))
    }
  }

  async function aggiungiGiurato() {
    setAggiungendo(true); setMessaggioGiurato('')
    const res = await fetch('/api/invite-giurato', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuovoGiurato),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessaggioGiurato(`Errore: ${data.error}`)
    } else {
      setGiurati(prev => [...prev, { id: data.user.id, ...nuovoGiurato, attivo: true }])
      setNuovoGiurato({ nome: '', cognome: '', email: '', tipo_giurato: 'lettore' })
      setMessaggioGiurato('Giurato aggiunto. Genera il link di accesso dalla lista.')
    }
    setAggiungendo(false)
  }

  async function disabilitaGiurato(id: string) {
    if (!confirm('Sei sicuro di voler disabilitare questo giurato?')) return
    await supabase.from('profiles').update({ attivo: false }).eq('id', id)
    setGiurati(prev => prev.map(g => g.id === id ? { ...g, attivo: false } : g))
  }

  async function riabilitaGiurato(id: string) {
    await supabase.from('profiles').update({ attivo: true }).eq('id', id)
    setGiurati(prev => prev.map(g => g.id === id ? { ...g, attivo: true } : g))
  }

  async function generaLink(giuratoId: string, email: string) {
    setGenerando(giuratoId)
    const res = await fetch('/api/genera-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    setLinkGenerati(prev => ({ ...prev, [giuratoId]: data.link || 'Errore nella generazione' }))
    setGenerando(null)
  }

  async function copiaLink(giuratoId: string) {
    const link = linkGenerati[giuratoId]
    await navigator.clipboard.writeText(link)
    setLinkGenerati(prev => ({ ...prev, [giuratoId]: 'Copiato!' }))
    setTimeout(() => setLinkGenerati(prev => ({ ...prev, [giuratoId]: link })), 2000)
  }

  const giuratiAssegnabili = [
    ...giurati.filter(g => g.tipo_giurato === 'interno' && g.attivo !== false).sort((a, b) => a.cognome.localeCompare(b.cognome)),
    ...giurati.filter(g => g.tipo_giurato === 'lettore' && g.attivo !== false).sort((a, b) => a.cognome.localeCompare(b.cognome)),
  ]

  function BtnGiurato({ g, racconto, tipo }: { g: any; racconto: any; tipo: 'interno' | 'lettore' | 'qualita' }) {
    const assegnazioniRacconto = assegnazioniEsistenti.filter(a => a.racconto_id === racconto.id)
    const assegnazione = assegnazioniRacconto.find(a => a.giurato_id === g.id)
    const assegnato    = !!assegnazione
    const haValutato   = !!assegnazione?.completata
    const statoBlocco  = ['valutato', 'finalista', 'eliminato', 'vincitore'].includes(racconto.stato)
    const slotValutato = !assegnato && assegnazioniRacconto.some(a =>
      giurati.find(x => x.id === a.giurato_id)?.tipo_giurato === tipo && !!a.completata
    )
    const bloccato = statoBlocco || haValutato || slotValutato
    const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.lettore
    return (
      <button key={g.id}
        onClick={() => !bloccato && assegna(racconto.id, g.id, racconto.stato === 'finalista' ? 'finale' : 'preliminare')}
        disabled={bloccato}
        title={haValutato ? 'Gia valutato - non modificabile' : slotValutato ? `Slot ${tipo} occupato da giurato che ha gia valutato` : ''}
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
          assegnato
            ? bloccato ? `${cfg.attivo} opacity-50 cursor-not-allowed` : cfg.attivo
            : bloccato ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
        {assegnato ? '✓ ' : ''}{g.nome} {g.cognome}
        {haValutato && <span className="text-[10px] opacity-60">· valutato</span>}
      </button>
    )
  }

  function CardAssegnazione({ r }: { r: any }) {
    const isChiusa = ['valutato', 'eliminato'].includes(r.stato)
    const assegnazioniRacconto = assegnazioniEsistenti.filter(a => a.racconto_id === r.id)
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-800">{r.titolo}</p>
            <p className="text-xs text-gray-400 mt-0.5">Autore: {autoreLabel(r)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Caricato il: {new Date(r.inviato_il).toLocaleDateString('it-IT')}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full shrink-0 ${STATO_BADGE[r.stato]}`}>{fmt(r.stato)}</span>
        </div>
        {isChiusa ? (
          <div className="flex flex-wrap gap-2">
            {assegnazioniRacconto.length === 0
              ? <p className="text-xs text-gray-300">Nessun giurato assegnato</p>
              : assegnazioniRacconto.map(a => {
                  const g = giurati.find(x => x.id === a.giurato_id)
                  if (!g) return null
                  const cfg = TIPO_CONFIG[g.tipo_giurato] || TIPO_CONFIG.lettore
                  return (
                    <div key={a.id} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${a.completata ? cfg.attivo : 'border-gray-200 text-gray-400'}`}>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
                      {g.nome} {g.cognome}
                      {a.completata
                        ? <span className="text-[10px] opacity-60">· valutato</span>
                        : <span className="text-[10px] text-red-400">· non valutato</span>
                      }
                    </div>
                  )
                })
            }
          </div>
        ) : (
          <div className="flex gap-4 items-start">
            <div className="flex flex-wrap gap-2">
              {giuratiAssegnabili.filter(g => g.tipo_giurato === 'interno').map(g =>
                <BtnGiurato key={g.id} g={g} racconto={r} tipo="interno" />
              )}
            </div>
            <div className="w-px self-stretch bg-gray-200" />
            <div className="flex flex-wrap gap-2">
              {giuratiAssegnabili.filter(g => g.tipo_giurato === 'lettore').map(g =>
                <BtnGiurato key={g.id} g={g} racconto={r} tipo="lettore" />
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (caricamento) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  const raccontiFiltrati = sortRacconti(
    racconti.filter(r => {
      const matchTesto = r.titolo?.toLowerCase().includes(raccontiFilter.toLowerCase()) ||
        autoreLabel(r).toLowerCase().includes(raccontiFilter.toLowerCase())
      const matchStato = raccontiStato ? r.stato === raccontiStato : true
      return matchTesto && matchStato
    }),
    raccontiSort, raccontiDir
  )

  const assFiltra = (list: any[]) => sortRacconti(
    list.filter(r =>
      r.titolo?.toLowerCase().includes(assFilter.toLowerCase()) ||
      autoreLabel(r).toLowerCase().includes(assFilter.toLowerCase())
    ),
    assSort, assDir
  )
  const raccontinDaAssegnare  = assFiltra(racconti.filter(r => r.stato === 'ricevuto'))
  const raccontiInValutazione = assFiltra(racconti.filter(r => r.stato === 'in_valutazione'))
  const raccontiValutati      = assFiltra(racconti.filter(r => r.stato === 'valutato'))
  const raccontiEliminati     = assFiltra(racconti.filter(r => r.stato === 'eliminato'))
  const raccontiFinalisti     = racconti.filter(r => r.stato === 'finalista')

  const medieFiltered = (() => {
    let list = medie.filter(m => {
      const racconto = racconti.find(r => r.id === m.racconto_id)
      if (!racconto) return false
      const hasValutazione = valutazioni.some(v => v.assegnazioni?.racconto_id === racconto.id)
      if (['ricevuto', 'in_valutazione'].includes(racconto.stato) && !hasValutazione) return false
      if (racconto.stato === 'vincitore') return false
      const matchTesto = m.titolo?.toLowerCase().includes(risFilter.toLowerCase()) ||
        autoreLabel(racconto).toLowerCase().includes(risFilter.toLowerCase())
      return matchTesto
    })
    if (risSort === 'titolo') list = [...list].sort((a, b) => risDir === 'asc' ? (a.titolo ?? '').localeCompare(b.titolo ?? '') : (b.titolo ?? '').localeCompare(a.titolo ?? ''))
    if (risSort === 'autore') list = [...list].sort((a, b) => {
      const ra = racconti.find(r => r.id === a.racconto_id)
      const rb = racconti.find(r => r.id === b.racconto_id)
      const va = ra ? autoreLabel(ra) : ''; const vb = rb ? autoreLabel(rb) : ''
      return risDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
    if (risSort === 'data') list = [...list].sort((a, b) => {
      const ra = racconti.find(r => r.id === a.racconto_id)
      const rb = racconti.find(r => r.id === b.racconto_id)
      const va = ra?.inviato_il ?? ''; const vb = rb?.inviato_il ?? ''
      return risDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
    return list
  })()

  const giuratiFiltrati = [...giurati]
    .filter(g => `${g.nome} ${g.cognome}`.toLowerCase().includes(giuratiFilter.toLowerCase()))
    .sort((a, b) => giuratiSort === 'cognome'
      ? a.cognome.localeCompare(b.cognome)
      : a.nome.localeCompare(b.nome)
    )

  const sezioniAssegnazioni = [
    { label: 'Da assegnare', list: raccontinDaAssegnare },
    { label: 'In valutazione', list: raccontiInValutazione },
    { label: 'Valutati', list: raccontiValutati },
    { label: 'Eliminati', list: raccontiEliminati },
  ]

  const activeClass: Record<string, string> = {
    finalista: 'bg-purple-50 border-purple-300 text-purple-700',
    eliminato: 'bg-red-50 border-red-300 text-red-600',
    vincitore: 'bg-amber-50 border-amber-300 text-amber-700',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <img src="/logo_tohorror_dark.png" alt="TOHorror" className="h-16" />
        <div className="flex gap-2">
          {SEZIONI.map(s => (
            <button key={s} onClick={() => cambiaSezione(s)}
              className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-colors ${sezione === s ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/giurato')}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            Area giurato
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-semibold">
            {profilo?.nome?.[0]?.toUpperCase()}{profilo?.cognome?.[0]?.toUpperCase()}
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            Logout
          </button>
        </div>
      </div>

      <div className="px-8 py-8 max-w-5xl mx-auto">

        {/* RACCONTI */}
        {sezione === 'racconti' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">{racconti.length} racconti ricevuti</p>
              <button onClick={() => router.push('/admin-invio')}
                className="text-sm bg-gray-800 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700">
                Carica racconto
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <input type="text" placeholder="Cerca per titolo o autore..."
                value={raccontiFilter} onChange={e => setRaccontiFilter(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              <select value={raccontiStato} onChange={e => setRaccontiStato(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Tutti gli stati</option>
                {Object.entries(STATI_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <SortBar sortKey={raccontiSort} sortDir={raccontiDir}
                onChange={(k, d) => { setRaccontiSort(k); setRaccontiDir(d) }} />
            </div>
            {raccontiFiltrati.length === 0
              ? <p className="text-xs text-gray-300">Nessun racconto trovato</p>
              : raccontiFiltrati.map(r => {
                const idx = STATI_ORDINE.indexOf(r.stato)
                const pct = Math.round((idx / (STATI_ORDINE.length - 1)) * 100)
                const isEnabled = ['valutato','finalista','eliminato','vincitore'].includes(r.stato)
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <p className="text-sm font-medium text-gray-800">{r.titolo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Autore: {autoreLabel(r)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Caricato il: {new Date(r.inviato_il).toLocaleDateString('it-IT')}</p>
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-800">{fmt(r.stato)}</span>
                        <span className="text-xs text-gray-400">{idx + 1} / {STATI_ORDINE.length}</span>
                      </div>
                      <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                        <div className="absolute left-0 top-0 h-full bg-gray-800 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between mb-3">
                        {STATI_ORDINE.map(s => (
                          <span key={s} className={`text-[10px] ${r.stato === s ? 'text-gray-800 font-medium' : 'text-gray-300'}`}>
                            {fmt(s)}
                          </span>
                        ))}
                      </div>
                      {isEnabled && (
                        <div className="flex gap-2 justify-end">
                          {(['finalista', 'eliminato'] as const).map(key => (
                            <button key={key} onClick={() => aggiornaStato(r.id, key)}
                              className={`px-3 py-1 rounded-full text-xs border transition-colors ${r.stato === key ? activeClass[key] : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                              {fmt(key)}
                            </button>
                          ))}
                          <button onClick={() => aggiornaStato(r.id, 'vincitore')}
                            className={`px-3 py-1 rounded-full text-xs border transition-colors ${r.stato === 'vincitore' ? activeClass['vincitore'] : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                            {fmt('vincitore')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            }
          </div>
        )}

        {/* ASSEGNAZIONI */}
        {sezione === 'assegnazioni' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <input type="text" placeholder="Cerca per titolo o autore..."
                value={assFilter} onChange={e => setAssFilter(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              <SortBar sortKey={assSort} sortDir={assDir}
                onChange={(k, d) => { setAssSort(k); setAssDir(d) }} />
              <button onClick={carica} className="text-xs text-gray-400 hover:text-gray-600">Aggiorna</button>
            </div>
            {sezioniAssegnazioni.map(({ label, list }) => (
              <div key={label}>
                <button
                  onClick={() => setAssOpen(prev => ({ ...prev, [label]: !prev[label] }))}
                  className="flex items-center gap-2 w-full text-left mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label} ({list.length})</span>
                  <span className="text-gray-400 text-xs">{assOpen[label] ? '▲' : '▼'}</span>
                </button>
                {assOpen[label] && (
                  list.length === 0
                    ? <p className="text-xs text-gray-300 mb-3">Nessun racconto</p>
                    : <div className="space-y-3 mb-3">{list.map(r => <CardAssegnazione key={r.id} r={r} />)}</div>
                )}
                <div className="border-t border-gray-100" />
              </div>
            ))}
          </div>
        )}

        {/* FINALISTI */}
        {sezione === 'finalisti' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">{raccontiFinalisti.length} racconti finalisti</p>
              <button onClick={carica} className="text-xs text-gray-400 hover:text-gray-600">Aggiorna</button>
            </div>
            {raccontiFinalisti.length === 0
              ? <p className="text-xs text-gray-300">Nessun racconto finalista ancora</p>
              : raccontiFinalisti.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.titolo}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Autore: {autoreLabel(r)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Caricato il: {new Date(r.inviato_il).toLocaleDateString('it-IT')}</p>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-purple-50 text-purple-600 shrink-0">Finalista</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {giurati.filter(g => g.tipo_giurato === 'qualita' && g.attivo !== false).length === 0
                      ? <p className="text-xs text-gray-300">Nessun giurato di qualita disponibile</p>
                      : giurati.filter(g => g.tipo_giurato === 'qualita' && g.attivo !== false).map(g =>
                          <BtnGiurato key={g.id} g={g} racconto={r} tipo="qualita" />
                        )
                    }
                  </div>
                  <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-400 mr-2">Stato:</p>
                    {(['vincitore', 'eliminato'] as const).map(key => (
                      <button key={key} onClick={() => aggiornaStato(r.id, key)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${r.stato === key ? activeClass[key] : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                        {fmt(key)}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* RISULTATI */}
        {sezione === 'risultati' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <input type="text" placeholder="Cerca per titolo o autore..."
                value={risFilter} onChange={e => setRisFilter(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              <SortBar sortKey={risSort} sortDir={risDir}
                onChange={(k, d) => { setRisSort(k); setRisDir(d) }} />
            </div>
            {medieFiltered.length === 0
              ? <p className="text-xs text-gray-300">Nessun risultato trovato</p>
              : medieFiltered.map((m, i) => {
                const valRacconto = valutazioni.filter(v => v.assegnazioni?.racconto_id === m.racconto_id)
                const racconto = racconti.find(r => r.id === m.racconto_id)
                const autore = racconto ? autoreLabel(racconto) : ''
                return (
                  <div key={m.racconto_id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-300 font-medium w-5">{i + 1}</span>
                        <p className="text-sm font-medium text-gray-800">{m.titolo}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-3 py-1 rounded-full ${STATO_BADGE[m.stato]}`}>{fmt(m.stato)}</span>
                        {m.media_complessiva && <span className="text-lg font-semibold text-gray-800">{m.media_complessiva}</span>}
                      </div>
                    </div>
                    {valRacconto.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Autore: {autore}</p>
                        <p className="text-xs text-gray-500 mb-3">Caricato il: {racconto?.inviato_il ? new Date(racconto.inviato_il).toLocaleDateString('it-IT') : '-'}</p>
                        <div className="space-y-2">
                          <div className="grid grid-cols-7 gap-2 text-[10px] text-gray-400 uppercase px-2">
                            <span className="col-span-2">Giurato</span>
                            {CRITERI.map(c => <span key={c.key} className="text-center">{c.label}</span>)}
                          </div>
                          {valRacconto.map(v => (
                            <div key={v.id} className="grid grid-cols-7 gap-2 bg-gray-50 rounded-lg px-2 py-1.5 text-xs">
                              <span className="col-span-2 text-gray-600 truncate">
                                {v.assegnazioni?.profiles?.nome} {v.assegnazioni?.profiles?.cognome}
                              </span>
                              {CRITERI.map(c => (
                                <span key={c.key} className="text-center text-gray-700 font-medium">{v[`criterio_${c.key}`]}</span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.media_complessiva && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Medie</p>
                        <div className="grid grid-cols-5 gap-2">
                          {CRITERI.map(c => (
                            <div key={c.key} className="text-center bg-gray-50 rounded-lg py-2">
                              <p className="text-[10px] text-gray-400 mb-1">{c.label}</p>
                              <p className="text-sm font-semibold text-gray-700">{m[`media_${c.key}`]}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!m.media_complessiva && <p className="text-xs text-gray-300">Nessuna valutazione ancora</p>}
                  </div>
                )
              })
            }
          </div>
        )}

        {/* GIURATI */}
        {sezione === 'giurati' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-medium text-gray-800 mb-1">Aggiungi giurato</p>
              <p className="text-xs text-gray-400 mb-4">
                Crea l'account e genera un link di accesso da inviare al giurato via WhatsApp o email.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {(['nome', 'cognome'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-xs text-gray-500 mb-1 capitalize">{field}</label>
                    <input type="text" value={nuovoGiurato[field]}
                      onChange={e => setNuovoGiurato(p => ({ ...p, [field]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input type="email" value={nuovoGiurato.email}
                    onChange={e => setNuovoGiurato(p => ({ ...p, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                  <select value={nuovoGiurato.tipo_giurato}
                    onChange={e => setNuovoGiurato(p => ({ ...p, tipo_giurato: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                    <option value="interno">Interno</option>
                    <option value="lettore">Lettore</option>
                    <option value="qualita">Qualita</option>
                  </select>
                </div>
              </div>
              {messaggioGiurato && (
                <p className={`text-sm mb-3 ${messaggioGiurato.includes('Errore') ? 'text-red-500' : 'text-green-600'}`}>
                  {messaggioGiurato}
                </p>
              )}
              <button onClick={aggiungiGiurato}
                disabled={aggiungendo || !nuovoGiurato.email || !nuovoGiurato.nome || !nuovoGiurato.cognome}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50">
                {aggiungendo ? 'Creazione...' : 'Crea giurato'}
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input type="text" placeholder="Cerca per nome..."
                  value={giuratiFilter} onChange={e => setGiuratiFilter(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">Ordina:</span>
                  {(['cognome', 'nome'] as const).map(k => (
                    <button key={k} onClick={() => setGiuratiSort(k)}
                      className={`text-xs px-2 py-1 rounded border transition-colors capitalize ${giuratiSort === k ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {k}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {giurati.filter(g => g.attivo !== false).length} attivi · {giurati.filter(g => g.attivo === false).length} disabilitati
                </p>
                <button onClick={carica} className="text-xs text-gray-400 hover:text-gray-600">Aggiorna</button>
              </div>
              {giuratiFiltrati.map(g => {
                const cfg = TIPO_CONFIG[g.tipo_giurato] || TIPO_CONFIG.lettore
                const link = linkGenerati[g.id]
                const isCopied = link === 'Copiato!'
                const disabilitato = g.attivo === false
                return (
                  <div key={g.id} className={`bg-white rounded-xl border p-4 ${disabilitato ? 'border-gray-100 opacity-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{g.nome} {g.cognome}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{g.email}</p>
                        </div>
                        {disabilitato && (
                          <span className="text-[10px] text-red-400 border border-red-200 px-1.5 py-0.5 rounded">disabilitato</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!disabilitato && (
                          <button onClick={() => generaLink(g.id, g.email)} disabled={generando === g.id}
                            className="text-xs px-3 py-1 rounded-lg border border-blue-200 text-blue-500 hover:bg-blue-50 disabled:opacity-50">
                            {generando === g.id ? '...' : 'Genera link'}
                          </button>
                        )}
                        {disabilitato ? (
                          <button onClick={() => riabilitaGiurato(g.id)}
                            className="text-xs px-3 py-1 rounded-lg border border-green-200 text-green-600 hover:bg-green-50">
                            Riabilita
                          </button>
                        ) : (
                          <button onClick={() => disabilitaGiurato(g.id)}
                            className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                            Disabilita
                          </button>
                        )}
                      </div>
                    </div>
                    {link && !disabilitato && (
                      <div className="mt-3 flex items-center gap-2">
                        <input readOnly value={link}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-500 bg-gray-50 truncate" />
                        <button onClick={() => copiaLink(g.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${isCopied ? 'border-green-200 text-green-600 bg-green-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {isCopied ? 'Copiato' : 'Copia'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
