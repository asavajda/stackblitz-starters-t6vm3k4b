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
  ricevuto:       'bg-gray-100 text-gray-700',
  in_valutazione: 'bg-blue-100 text-blue-700',
  valutato:       'bg-green-100 text-green-700',
  finalista:      'bg-purple-100 text-purple-700',
  eliminato:      'bg-red-100 text-red-700',
  vincitore:      'bg-amber-100 text-amber-700',
}
const TIPO_CONFIG: Record<string, { badge: string; attivo: string; label: string }> = {
  interno: { badge: 'bg-purple-100 text-purple-700', attivo: 'bg-purple-50 border-purple-400 text-purple-800', label: 'INT' },
  lettore: { badge: 'bg-blue-100 text-blue-700',    attivo: 'bg-blue-50 border-blue-400 text-blue-800',     label: 'LET' },
  qualita: { badge: 'bg-amber-100 text-amber-700',  attivo: 'bg-amber-50 border-amber-400 text-amber-800',  label: 'QUA' },
}
const CRITERI = [
  { key: 'a', label: 'Incipit' },
  { key: 'b', label: 'Svolta narrativa' },
  { key: 'c', label: 'Climax' },
  { key: 'd', label: 'Scioglimento' },
]
const SEZIONI = ['racconti', 'assegnazioni', 'finalisti', 'risultati', 'giurati'] as const
const activeClass: Record<string, string> = {
  finalista: 'bg-purple-50 border-purple-300 text-purple-700',
  eliminato: 'bg-red-50 border-red-300 text-red-600',
  vincitore: 'bg-amber-50 border-amber-300 text-amber-700',
}
type Sezione = typeof SEZIONI[number]
type SortKey = 'titolo' | 'autore' | 'data' | 'stato'
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
    if (key === 'stato')  { va = a.stato ?? ''; vb = b.stato ?? '' }
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
      {btn('stato', 'Stato')}
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
  const [blocchi, setBlocchi]                             = useState<any[]>([])
  const [blocchiCompletatiIds, setBlocchiCompletatiIds]   = useState<string[]>([])
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

  // Stato nuovo blocco
  const [nuovoBloccoInterno, setNuovoBloccoInterno]   = useState('')
  const [nuovoBloccoLettore, setNuovoBloccoLettore]   = useState('')
  const [nuovoBloccoRacconti, setNuovoBloccoRacconti] = useState<string[]>([])
  const [creandoBlocco, setCreandoBlocco]             = useState(false)
  const [messaggioBlocco, setMessaggioBlocco]         = useState('')
  const [raccontiDisponibiliFilter, setRaccontiDisponibiliFilter] = useState('')
  const [selectedDisponibili, setSelectedDisponibili] = useState<string[]>([])
  const [selectedScelti, setSelectedScelti]           = useState<string[]>([])

  const [raccontiFilter, setRaccontiFilter] = useState('')
  const [raccontiStato, setRaccontiStato]   = useState('')
  const [raccontiSort, setRaccontiSort]     = useState<SortKey>('data')
  const [raccontiDir, setRaccontiDir]       = useState<SortDir>('desc')

  const [assFilter, setAssFilter] = useState('')
  const [assSort, setAssSort]     = useState<SortKey>('data')
  const [assDir, setAssDir]       = useState<SortDir>('desc')
  const [assOpen, setAssOpen]     = useState<Record<string, boolean>>({
    'In valutazione': true, 'Valutati': false, 'Eliminati': false,
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
    const [{ data: r }, { data: g }, { data: m }, { data: a }, { data: v }, { data: b }, { data: bg }] = await Promise.all([
      supabase.from('racconti').select('*, profiles(nome, cognome)').order('inviato_il', { ascending: false }),
      supabase.from('profiles').select('*').eq('ruolo', 'giurato'),
      supabase.from('medie_racconti').select('*').order('media_complessiva', { ascending: false }),
      supabase.from('assegnazioni').select('*'),
      supabase.from('valutazioni').select('*, assegnazioni(racconto_id, giurato_id, profiles(nome, cognome))'),
      supabase.from('blocchi').select('*').order('creato_il', { ascending: false }),
      supabase.from('blocchi_giurato').select('blocco_id').eq('completato', true),
    ])
    setRacconti(r || []); setGiurati(g || []); setMedie(m || [])
    setAssegnazioniEsistenti(a || []); setValutazioni(v || []); setBlocchi(b || [])
    setBlocchiCompletatiIds((bg || []).map((x: any) => x.blocco_id))
    setCaricamento(false)
  }

  useEffect(() => { carica() }, [])

  async function aggiornaStato(racconto_id: string, stato: string) {
    await supabase.from('racconti').update({ stato }).eq('id', racconto_id)
    setRacconti(prev => prev.map(r => r.id === racconto_id ? { ...r, stato } : r))
    setMedie(prev => prev.map(m => m.racconto_id === racconto_id ? { ...m, stato } : m))
  }

  async function creaBlocco() {
    if (!nuovoBloccoInterno || !nuovoBloccoLettore || nuovoBloccoRacconti.length === 0) {
      setMessaggioBlocco('Seleziona almeno un racconto, un giurato interno e un lettore.')
      return
    }
    setCreandoBlocco(true)
    setMessaggioBlocco('')

    // Crea il blocco
    const { data: blocco, error: errBlocco } = await supabase
      .from('blocchi').insert({ completato: false }).select().single()
    if (errBlocco || !blocco) {
      setMessaggioBlocco('Errore nella creazione del blocco.')
      setCreandoBlocco(false)
      return
    }

    // Crea le assegnazioni per ogni racconto x ogni giurato
    const assegnazioni = nuovoBloccoRacconti.flatMap(racconto_id => [
      { racconto_id, giurato_id: nuovoBloccoInterno, fase: 'preliminare', blocco_id: blocco.id },
      { racconto_id, giurato_id: nuovoBloccoLettore, fase: 'preliminare', blocco_id: blocco.id },
    ])

    const { data: nuoveAss, error: errAss } = await supabase
      .from('assegnazioni').insert(assegnazioni).select()
    if (errAss) {
      setMessaggioBlocco('Errore nella creazione delle assegnazioni.')
      setCreandoBlocco(false)
      return
    }

    // Aggiorna stato racconti a in_valutazione
    for (const racconto_id of nuovoBloccoRacconti) {
      const racconto = racconti.find(r => r.id === racconto_id)
      if (racconto?.stato === 'ricevuto') {
        await supabase.from('racconti').update({ stato: 'in_valutazione' }).eq('id', racconto_id)
      }
    }

    // Aggiorna stato locale
    setBlocchi(prev => [blocco, ...prev])
    setAssegnazioniEsistenti(prev => [...prev, ...(nuoveAss || [])])
    setRacconti(prev => prev.map(r =>
      nuovoBloccoRacconti.includes(r.id) && r.stato === 'ricevuto'
        ? { ...r, stato: 'in_valutazione' }
        : r
    ))

    // Reset form
    setNuovoBloccoInterno('')
    setNuovoBloccoLettore('')
    setNuovoBloccoRacconti([])
    setMessaggioBlocco(`Blocco creato con ${nuovoBloccoRacconti.length} racconti.`)
    setCreandoBlocco(false)
  }

  function toggleRaccontoBlocco(id: string) {
    setNuovoBloccoRacconti(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
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

  function contaValutazioniCompletate(racconto_id: string) {
    return assegnazioniEsistenti.filter(a => a.racconto_id === racconto_id && !!a.completata).length
  }

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
        disabled={bloccato}
        title={haValutato ? 'Già valutato - non modificabile' : slotValutato ? `Slot ${tipo} occupato da giurato che ha già valutato` : ''}
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
  const raccontiInValutazione = assFiltra(racconti.filter(r => r.stato === 'in_valutazione'))
  const raccontiValutati      = assFiltra(racconti.filter(r => r.stato === 'valutato'))
  const raccontiEliminati     = assFiltra(racconti.filter(r => r.stato === 'eliminato'))
  const raccontiFinalisti     = racconti.filter(r => r.stato === 'finalista')

  // Racconti disponibili per nuovo blocco (solo ricevuti e non già in un blocco)
  const raccontiDisponibili = racconti.filter(r => r.stato === 'ricevuto')

  const medieFiltered = (() => {
    let list = medie.filter(m => {
      const racconto = racconti.find(r => r.id === m.racconto_id)
      if (!racconto) return false
      const assRacconto = assegnazioniEsistenti.filter(a => a.racconto_id === racconto.id)
      const bloccoId = assRacconto[0]?.blocco_id
      const bloccoCompletato = bloccoId ? blocchiCompletatiIds.includes(bloccoId) : false
      if (!bloccoCompletato && ['ricevuto', 'in_valutazione', 'valutato'].includes(racconto.stato)) return false
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
    if (risSort === 'stato') list = [...list].sort((a, b) => {
      const va = a.stato ?? ''; const vb = b.stato ?? ''
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
    { label: 'In valutazione', list: raccontiInValutazione },
    { label: 'Valutati', list: raccontiValutati },
    { label: 'Eliminati', list: raccontiEliminati },
  ]

  const isStaging = process.env.NEXT_PUBLIC_ENV === 'staging'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`border-b px-8 py-4 flex items-center justify-between ${isStaging ? 'bg-[#4A90A4] border-[#3a7a8e]' : 'bg-white border-gray-200'}`}>
        <img src="/logo_tohorror_dark.png" alt="TOHorror" className="h-16" />
        <div className="flex gap-2">
          {SEZIONI.map(s => (
            <button key={s} onClick={() => cambiaSezione(s)}
              className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-colors ${sezione === s ? (isStaging ? 'bg-white/20 text-white' : 'bg-gray-800 text-white') : (isStaging ? 'text-white/70 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100')}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/giurato')}
            className={`text-sm transition-colors ${isStaging ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
            Area giurato
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-semibold">
            {profilo?.nome?.[0]?.toUpperCase()}{profilo?.cognome?.[0]?.toUpperCase()}
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className={`text-sm transition-colors ${isStaging ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
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
                className="text-sm bg-gray-800 text-white px-5 py-2 rounded-lg hover:bg-gray-700 font-medium">
                + Carica racconto
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
                  const nValutazioni = contaValutazioniCompletate(r.id)
                  const nAssegnati = assegnazioniEsistenti.filter(a => a.racconto_id === r.id).length
                  const inCorso = ['ricevuto', 'in_valutazione', 'valutato'].includes(r.stato)
                  const puoDecidere = inCorso && nValutazioni >= 2
                  const badgeLabel = (r.stato === 'valutato' || (r.stato === 'in_valutazione' && nValutazioni >= 2)) ? 'Valutato' : fmt(r.stato)
                  const badgeClass = (r.stato === 'valutato' || (r.stato === 'in_valutazione' && nValutazioni >= 2)) ? STATO_BADGE['valutato'] : STATO_BADGE[r.stato]
                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{r.titolo}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{autoreLabel(r)} · {new Date(r.inviato_il).toLocaleDateString('it-IT')}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {inCorso && nAssegnati > 0 && (
                          <span className="text-xs text-gray-400">{nValutazioni}/{nAssegnati}</span>
                        )}
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${badgeClass}`}>
                          {badgeLabel}
                        </span>
                        {puoDecidere && (['finalista', 'eliminato'] as const).map(key => (
                          <button key={key} onClick={() => aggiornaStato(r.id, key)}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                              r.stato === key ? activeClass[key] : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                            }`}>
                            {fmt(key)}
                          </button>
                        ))}
                        {r.stato === 'finalista' && (
                          <button onClick={() => aggiornaStato(r.id, 'vincitore')}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                              r.stato === 'vincitore' ? activeClass['vincitore'] : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                            }`}>
                            {fmt('vincitore')}
                          </button>
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

            {/* Pannello crea blocco */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-medium text-gray-800 mb-1">Crea nuovo blocco</p>
              <p className="text-xs text-gray-400 mb-4">
                Seleziona i giurati e i racconti da assegnare. Tutti i racconti del blocco saranno assegnati alla coppia scelta.
              </p>

              {/* Selezione giurati */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Giurato interno</label>
                  <select value={nuovoBloccoInterno} onChange={e => setNuovoBloccoInterno(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                    <option value="">Seleziona...</option>
                    {giurati.filter(g => g.tipo_giurato === 'interno' && g.attivo !== false)
                      .sort((a, b) => a.cognome.localeCompare(b.cognome))
                      .map(g => (
                        <option key={g.id} value={g.id}>{g.cognome} {g.nome}</option>
                      ))
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lettore</label>
                  <select value={nuovoBloccoLettore} onChange={e => setNuovoBloccoLettore(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                    <option value="">Seleziona...</option>
                    {giurati.filter(g => g.tipo_giurato === 'lettore' && g.attivo !== false)
                      .sort((a, b) => a.cognome.localeCompare(b.cognome))
                      .map(g => (
                        <option key={g.id} value={g.id}>{g.cognome} {g.nome}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              {/* Selezione racconti — dual listbox */}
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-2">
                  Racconti
                  {nuovoBloccoRacconti.length > 0 && (
                    <span className="ml-2 text-gray-800 font-medium">{nuovoBloccoRacconti.length} selezionati</span>
                  )}
                </label>
                {raccontiDisponibili.length === 0 && nuovoBloccoRacconti.length === 0
                  ? <p className="text-xs text-gray-300">Nessun racconto disponibile da assegnare</p>
                  : (
                    <div className="flex gap-2 items-stretch">
                      {/* Colonna sinistra — disponibili */}
                      <div className="flex-1 flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                          Disponibili ({raccontiDisponibili.filter(r =>
                            !nuovoBloccoRacconti.includes(r.id) &&
                            (r.titolo?.toLowerCase().includes(raccontiDisponibiliFilter.toLowerCase()) ||
                            autoreLabel(r).toLowerCase().includes(raccontiDisponibiliFilter.toLowerCase()))
                          ).length})
                        </span>
                        <input
                          type="text"
                          placeholder="Cerca..."
                          value={raccontiDisponibiliFilter}
                          onChange={e => setRaccontiDisponibiliFilter(e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs mb-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
                        />
                        <select
                          multiple
                          value={selectedDisponibili}
                          onChange={e => setSelectedDisponibili(Array.from(e.target.selectedOptions, o => o.value))}
                          className="flex-1 border border-gray-200 rounded-lg text-xs min-h-[160px] focus:outline-none focus:ring-1 focus:ring-gray-300"
                        >
                          {raccontiDisponibili
                            .filter(r =>
                              !nuovoBloccoRacconti.includes(r.id) &&
                              (r.titolo?.toLowerCase().includes(raccontiDisponibiliFilter.toLowerCase()) ||
                              autoreLabel(r).toLowerCase().includes(raccontiDisponibiliFilter.toLowerCase()))
                            )
                            .sort((a, b) => (a.titolo ?? '').localeCompare(b.titolo ?? ''))
                            .map(r => (
                              <option key={r.id} value={r.id}>
                                {r.titolo} — {autoreLabel(r)}
                              </option>
                            ))
                          }
                        </select>
                      </div>

                      {/* Frecce centrali */}
                      <div className="flex flex-col justify-center gap-2 pt-10">
                        <button
                          onClick={() => {
                            setNuovoBloccoRacconti(prev => [...prev, ...selectedDisponibili.filter(id => !prev.includes(id))])
                            setSelectedDisponibili([])
                          }}
                          disabled={selectedDisponibili.length === 0}
                          className="px-2 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                          title="Aggiungi selezionati"
                        >›</button>
                        <button
                          onClick={() => {
                            setNuovoBloccoRacconti(prev => prev.filter(id => !selectedScelti.includes(id)))
                            setSelectedScelti([])
                          }}
                          disabled={selectedScelti.length === 0}
                          className="px-2 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                          title="Rimuovi selezionati"
                        >‹</button>
                        <button
                          onClick={() => {
                            setNuovoBloccoRacconti([])
                            setSelectedDisponibili([])
                            setSelectedScelti([])
                          }}
                          disabled={nuovoBloccoRacconti.length === 0}
                          className="px-2 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                          title="Rimuovi tutti"
                        >«</button>
                      </div>

                      {/* Colonna destra — selezionati */}
                      <div className="flex-1 flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                          Selezionati ({nuovoBloccoRacconti.length})
                        </span>
                        <div className="mb-1 h-[26px]" />
                        <select
                          multiple
                          value={selectedScelti}
                          onChange={e => setSelectedScelti(Array.from(e.target.selectedOptions, o => o.value))}
                          className="flex-1 border border-gray-200 rounded-lg text-xs min-h-[160px] focus:outline-none focus:ring-1 focus:ring-gray-300"
                        >
                          {nuovoBloccoRacconti
                            .map(id => raccontiDisponibili.find(r => r.id === id))
                            .filter(Boolean)
                            .sort((a, b) => (a!.titolo ?? '').localeCompare(b!.titolo ?? ''))
                            .map(r => (
                              <option key={r!.id} value={r!.id}>
                                {r!.titolo} — {autoreLabel(r)}
                              </option>
                            ))
                          }
                        </select>
                      </div>
                    </div>
                  )
                }
              </div>

              {messaggioBlocco && (
                <p className={`text-sm mb-3 ${messaggioBlocco.includes('Errore') || messaggioBlocco.includes('Seleziona') ? 'text-red-500' : 'text-green-600'}`}>
                  {messaggioBlocco}
                </p>
              )}

              <button onClick={creaBlocco}
                disabled={creandoBlocco || !nuovoBloccoInterno || !nuovoBloccoLettore || nuovoBloccoRacconti.length === 0}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50">
                {creandoBlocco ? 'Creazione...' : `Crea blocco${nuovoBloccoRacconti.length > 0 ? ` (${nuovoBloccoRacconti.length} racconti)` : ''}`}
              </button>
            </div>

            {/* Lista blocchi esistenti */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <input type="text" placeholder="Cerca per titolo o autore..."
                  value={assFilter} onChange={e => setAssFilter(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                <SortBar sortKey={assSort} sortDir={assDir}
                  onChange={(k, d) => { setAssSort(k); setAssDir(d) }} />
                <button onClick={carica} className="text-xs text-gray-400 hover:text-gray-600">Aggiorna</button>
              </div>

              {sezioniAssegnazioni.map(({ label, list }) => (
                <div key={label} className="mb-6">
                  <button
                    onClick={() => setAssOpen(prev => ({ ...prev, [label]: !prev[label] }))}
                    className="flex items-center gap-2 w-full text-left mb-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label} ({list.length})</span>
                    <span className="text-gray-400 text-xs">{assOpen[label] ? '▲' : '▼'}</span>
                  </button>
                  {assOpen[label] && (
                    list.length === 0
                      ? <p className="text-xs text-gray-300 mb-3">Nessun racconto</p>
                      : (
                        <div className="space-y-3 mb-3">
                          {list.map(r => {
                            const assegnazioniRacconto = assegnazioniEsistenti.filter(a => a.racconto_id === r.id)
                            const bloccoId = assegnazioniRacconto[0]?.blocco_id
                            const isChiusa = ['valutato', 'eliminato'].includes(r.stato)
                            return (
                              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">{r.titolo}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Autore: {autoreLabel(r)}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Caricato il: {new Date(r.inviato_il).toLocaleDateString('it-IT')}</p>
                                    {bloccoId && (
                                      <p className="text-[10px] text-gray-300 mt-0.5">Blocco: {bloccoId.slice(0, 8)}…</p>
                                    )}
                                  </div>
                                  <span className={`text-xs px-3 py-1 rounded-full shrink-0 font-medium ${STATO_BADGE[r.stato]}`}>{fmt(r.stato)}</span>
                                </div>
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
                              </div>
                            )
                          })}
                        </div>
                      )
                  )}
                  <div className="border-t border-gray-100" />
                </div>
              ))}
            </div>
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
                    <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-medium shrink-0">Finalista</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {giurati.filter(g => g.tipo_giurato === 'qualita' && g.attivo !== false).length === 0
                      ? <p className="text-xs text-gray-300">Nessun giurato di qualità disponibile</p>
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
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATO_BADGE[m.stato]}`}>{fmt(m.stato)}</span>
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
                            <span className="text-center">Bonus</span>
                            <span className="text-center">Totale</span>
                          </div>
                          {valRacconto.map(v => {
                            const totale = (v.criterio_a ?? 0) + (v.criterio_b ?? 0) + (v.criterio_c ?? 0) + (v.criterio_d ?? 0) + (v.bonus ? 1 : 0)
                            return (
                              <div key={v.id} className="grid grid-cols-7 gap-2 bg-gray-50 rounded-lg px-2 py-1.5 text-xs">
                                <span className="col-span-2 text-gray-600 truncate">
                                  {v.assegnazioni?.profiles?.nome} {v.assegnazioni?.profiles?.cognome}
                                </span>
                                {CRITERI.map(c => (
                                  <span key={c.key} className="text-center text-gray-700 font-medium">{v[`criterio_${c.key}`]}</span>
                                ))}
                                <span className="text-center text-gray-700 font-medium">{v.bonus ? '+1' : '—'}</span>
                                <span className="text-center text-gray-800 font-semibold">{totale}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {m.media_complessiva && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Medie</p>
                        <div className="grid grid-cols-4 gap-2">
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
                    <option value="qualita">Qualità</option>
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
