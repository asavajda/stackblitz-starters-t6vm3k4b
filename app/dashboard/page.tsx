'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
const STATO_ORDER: Record<string, number> = {
  ricevuto: 0, in_valutazione: 1, valutato: 2, finalista: 3, eliminato: 4, vincitore: 5,
}
const SEZIONI = ['racconti', 'assegnazioni', 'finalisti', 'risultati', 'giurati'] as const
const activeClass: Record<string, string> = {
  finalista: 'bg-purple-50 border-purple-300 text-purple-700',
  eliminato: 'bg-red-50 border-red-300 text-red-600',
  vincitore: 'bg-amber-50 border-amber-300 text-amber-700',
}
type Sezione = typeof SEZIONI[number]
type SortKey = 'titolo' | 'autore' | 'data' | 'stato' | 'punteggio'

/**
 * Totale assegnato da un singolo giurato: somma dei 4 criteri piu' il bonus.
 */
function totaleGiurato(v: any): number {
  return (v.criterio_a ?? 0) + (v.criterio_b ?? 0) + (v.criterio_c ?? 0) + (v.criterio_d ?? 0) + (v.bonus ? 1 : 0)
}
type SortDir = 'asc' | 'desc'

function fmt(stato: string) { return STATI_LABEL[stato] ?? stato }

function autoreLabel(r: any) {
  return r.autore_nome ? `${r.autore_nome} ${r.autore_cognome}` : `${r.profiles?.nome ?? ''} ${r.profiles?.cognome ?? ''}`
}

function sortRacconti(list: any[], key: SortKey, dir: SortDir) {
  return [...list].sort((a, b) => {
    if (key === 'stato') {
      const va = STATO_ORDER[a.stato] ?? 99
      const vb = STATO_ORDER[b.stato] ?? 99
      return dir === 'asc' ? va - vb : vb - va
    }
    let va = '', vb = ''
    if (key === 'titolo') { va = a.titolo ?? ''; vb = b.titolo ?? '' }
    if (key === 'autore') { va = autoreLabel(a); vb = autoreLabel(b) }
    if (key === 'data')   { va = a.inviato_il ?? ''; vb = b.inviato_il ?? '' }
    return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })
}

function SortBar({ sortKey, sortDir, onChange, showPunteggio }: {
  sortKey: SortKey; sortDir: SortDir
  onChange: (k: SortKey, d: SortDir) => void
  showPunteggio?: boolean
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
  const opzioni: { key: SortKey; label: string }[] = [
    ...(showPunteggio ? [{ key: 'punteggio' as SortKey, label: 'Punteggio' }] : []),
    { key: 'titolo', label: 'Titolo' },
    { key: 'data', label: 'Data' },
    { key: 'stato', label: 'Stato' },
  ]
  return (
    <>
      {/* Mobile: un unico menu a tendina invece di 3-4 bottoni separati */}
      <div className="flex sm:hidden items-center gap-2 flex-1 min-w-0">
        <span className="hidden sm:inline text-xs text-gray-400 shrink-0">Ordina:</span>
        <svg className="shrink-0 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 9l4-4 4 4" />
          <path d="M16 15l-4 4-4-4" />
        </svg>
        <select value={sortKey} onChange={e => onChange(e.target.value as SortKey, sortDir)}
          className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300">
          {opzioni.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <button onClick={() => onChange(sortKey, sortDir === 'asc' ? 'desc' : 'asc')}
          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0">
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>
      {/* Desktop: bottoni originali, invariati */}
      <div className="hidden sm:flex items-center gap-1">
        <span className="text-xs text-gray-400 mr-1">Ordina:</span>
        {showPunteggio && btn('punteggio', 'Punteggio')}
        {btn('titolo', 'Titolo')}
        {btn('data', 'Data')}
        {btn('stato', 'Stato')}
      </div>
    </>
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
  const [raccontiSort, setRaccontiSort]     = useState<SortKey>('stato')
  const [raccontiDir, setRaccontiDir]       = useState<SortDir>('asc')
  const [raccontoDettaglio, setRaccontoDettaglio] = useState<any>(null)

  const [assFilter, setAssFilter] = useState('')
  const [assSort, setAssSort]     = useState<SortKey>('data')
  const [assDir, setAssDir]       = useState<SortDir>('desc')
  const [assOpen, setAssOpen]     = useState<Record<string, boolean>>({
    'In valutazione': true, 'Valutati': false, 'Eliminati': false,
  })

  const [risFilter, setRisFilter] = useState('')
  const [risSort, setRisSort]     = useState<SortKey>('punteggio')
  const [risDir, setRisDir]       = useState<SortDir>('desc')
  const [risAperti, setRisAperti] = useState<Record<string, boolean>>({})
  // Coppie "blocco_id|giurato_id" per cui il giurato ha CONFERMATO il blocco.
  const [blocchiConfermati, setBlocchiConfermati] = useState<Record<string, boolean>>({})

  const [giuratiFilter, setGiuratiFilter] = useState('')
  const [caricoAperto, setCaricoAperto]   = useState(false)

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
      supabase.from('valutazioni').select('*, assegnazioni(racconto_id, giurato_id, fase, blocco_id, profiles(nome, cognome))'),
      supabase.from('blocchi').select('*').order('creato_il', { ascending: false }),
      supabase.from('blocchi_giurato').select('blocco_id, giurato_id').eq('completato', true),
    ])

    // Una valutazione entra nei risultati solo quando il giurato ha CONFERMATO il
    // blocco: fino a quel momento criteri e bonus restano modificabili, quindi
    // mostrarli darebbe punteggi provvisori destinati a cambiare.
    // Il filtro e' per coppia (blocco, giurato) perche' i due giurati confermano
    // in modo indipendente: uno confermato su due da' il badge "Parziale 1/2".
    // Le righe senza blocco_id (storiche, precedenti al sistema a blocchi)
    // restano visibili, altrimenti sparirebbero per sempre.
    const confermati: Record<string, boolean> = {}
    ;(bg || []).forEach((x: any) => { confermati[`${x.blocco_id}|${x.giurato_id}`] = true })
    const valutazioniConfermate = (v || []).filter((val: any) => {
      const ass = val.assegnazioni
      if (!ass?.blocco_id) return true
      return !!confermati[`${ass.blocco_id}|${ass.giurato_id}`]
    })

    setRacconti(r || []); setGiurati(g || []); setMedie(m || [])
    setAssegnazioniEsistenti(a || []); setValutazioni(valutazioniConfermate); setBlocchi(b || [])
    setBlocchiConfermati(confermati)
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
    setMessaggioBlocco(`Blocco ${blocco.numero ?? ''} creato con ${nuovoBloccoRacconti.length} racconti.`)
    setCreandoBlocco(false)
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

  // Conta solo le valutazioni DEFINITIVE, cioe' quelle il cui blocco e' stato
  // confermato dal giurato (lo stato valutazioni e' gia' filtrato in carica()).
  // Non usare assegnazioni.completata: quel flag scatta al salvataggio della
  // singola valutazione, quando criteri e bonus sono ancora modificabili.
  function contaValutazioniCompletate(racconto_id: string) {
    return valutazioni.filter(v => v.assegnazioni?.racconto_id === racconto_id).length
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

  // Punteggio di un racconto = SOMMA dei totali di ogni giurato, non la media.
  // La view medie_racconti espone ancora media_complessiva (media dei totali)
  // e vive solo dentro Supabase, non nel repo: per non dipendere da una
  // modifica SQL il punteggio viene ricalcolato qui dalle valutazioni grezze.
  // Con due giurati la somma e' il doppio della media, quindi l'ordine in
  // classifica non cambia; cambia quando le valutazioni non sono ancora tutte
  // arrivate (totale parziale, segnalato dal badge "Parziale n/n").
  //
  // Le due fasi hanno classifiche SEPARATE e non si sommano tra loro:
  // - preliminare: coppia interno + lettore, alimenta la sezione Risultati
  // - finale: giurati di qualita' sui finalisti, alimenta la sezione Finalisti
  // La distinzione si basa su assegnazioni.fase; per prudenza tutto cio' che
  // non e' esplicitamente 'finale' viene contato come preliminare, cosi' le
  // righe storiche senza fase valorizzata restano dov'erano.
  const punteggiPreliminare: Record<string, { totale: number; n: number }> = {}
  const punteggiFinale: Record<string, { totale: number; n: number }> = {}
  for (const v of valutazioni) {
    const rid = v.assegnazioni?.racconto_id
    if (!rid) continue
    const mappa = v.assegnazioni?.fase === 'finale' ? punteggiFinale : punteggiPreliminare
    if (!mappa[rid]) mappa[rid] = { totale: 0, n: 0 }
    mappa[rid].totale += totaleGiurato(v)
    mappa[rid].n += 1
  }
  const punteggioDi = (racconto_id: string): number | null => {
    const p = punteggiPreliminare[racconto_id]
    return p && p.n > 0 ? p.totale : null
  }
  const punteggioFinaleDi = (racconto_id: string): number | null => {
    const p = punteggiFinale[racconto_id]
    return p && p.n > 0 ? p.totale : null
  }
  const nValutazioniPreliminare = (racconto_id: string): number =>
    punteggiPreliminare[racconto_id]?.n ?? 0
  const nAssegnatiPreliminare = (racconto_id: string): number =>
    assegnazioniEsistenti.filter(a => a.racconto_id === racconto_id && a.fase !== 'finale').length
  const nValutazioniFinale = (racconto_id: string): number =>
    punteggiFinale[racconto_id]?.n ?? 0
  const nAssegnatiFinale = (racconto_id: string): number =>
    assegnazioniEsistenti.filter(a => a.racconto_id === racconto_id && a.fase === 'finale').length

  // Classifica della fase finale: ordinata sul punteggio dei giurati di qualita',
  // indipendente dal punteggio preliminare.
  const finalistiOrdinati = [...raccontiFinalisti].sort((a, b) =>
    (punteggioFinaleDi(b.id) ?? -1) - (punteggioFinaleDi(a.id) ?? -1)
  )

  const medieFiltered = (() => {
    let list = medie.filter(m => {
      const racconto = racconti.find(r => r.id === m.racconto_id)
      if (!racconto) return false
      // Mostriamo il racconto nei Risultati non appena esiste ALMENO UNA
      // valutazione (anche parziale, in attesa del secondo giudice),
      // così da avere visibilità immediata sull'avanzamento. La media
      // "definitiva" (racconto.stato === 'valutato') si ottiene solo
      // quando tutti i giudici assegnati hanno completato (vedi
      // /api/completa-valutazione), e viene segnalata con un badge.
      const haAlmenoUnaValutazione = nValutazioniPreliminare(m.racconto_id) > 0
      const statoRilevante = ['valutato', 'finalista', 'eliminato'].includes(racconto.stato)
      if (!haAlmenoUnaValutazione && !statoRilevante) return false
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
    if (risSort === 'punteggio') list = [...list].sort((a, b) => {
      const va = punteggioDi(a.racconto_id) ?? -1; const vb = punteggioDi(b.racconto_id) ?? -1
      return risDir === 'asc' ? va - vb : vb - va
    })
    return list
  })()

  const giuratiFiltrati = [...giurati]
    .filter(g => `${g.nome} ${g.cognome}`.toLowerCase().includes(giuratiFilter.toLowerCase()))
    // Ordine unico per cognome; il nome discrimina i casi di omonimia.
    .sort((a, b) =>
      a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome)
    )

  function statsGiurato(giuratoId: string) {
    const ass = assegnazioniEsistenti.filter(a => a.giurato_id === giuratoId)
    const valutati = ass.filter(a => a.completata).length
    const inCorso = ass.length - valutati
    return { valutati, inCorso, totale: ass.length }
  }

  // Report blocchi per giurato. Un blocco contiene piu' racconti e quindi piu'
  // assegnazioni: qui va contato una volta sola, percio' si deduplica sui
  // blocco_id. 'Confermato' significa che il giurato ha sottomesso il blocco
  // (blocchi_giurato.completato), non che abbia salvato le valutazioni.
  function blocchiGiurato(giuratoId: string) {
    const visti: Record<string, boolean> = {}
    const assegnati: string[] = []
    assegnazioniEsistenti.forEach(a => {
      if (a.giurato_id !== giuratoId || !a.blocco_id || visti[a.blocco_id]) return
      visti[a.blocco_id] = true
      assegnati.push(a.blocco_id)
    })
    const confermato = (id: string) => !!blocchiConfermati[`${id}|${giuratoId}`]
    const mancanti = assegnati
      .filter(id => !confermato(id))
      .map(id => blocchi.find(b => b.id === id)?.numero)
      .filter(n => n !== null && n !== undefined)
      .sort((a: number, b: number) => a - b)
    return {
      assegnati: assegnati.length,
      completati: assegnati.filter(confermato).length,
      mancanti,
    }
  }

  const sezioniAssegnazioni = [
    { label: 'In valutazione', list: raccontiInValutazione },
    { label: 'Valutati', list: raccontiValutati },
    { label: 'Eliminati', list: raccontiEliminati },
  ]

  const isStaging = process.env.NEXT_PUBLIC_ENV === 'staging'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`border-b px-4 sm:px-8 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 ${isStaging ? 'bg-[#4A90A4] border-[#3a7a8e]' : 'bg-white border-gray-200'}`}>
        <img src="/logo_tohorror_dark.png" alt="TOHorror" className="h-10 sm:h-16 shrink-0" />
        <div className={`order-3 sm:order-none w-full sm:w-auto pt-3 mt-1 border-t sm:border-0 sm:pt-0 sm:mt-0 ${isStaging ? 'border-white/20' : 'border-gray-100'}`}>
          <div className="flex flex-wrap sm:flex-nowrap justify-center sm:justify-start gap-2">
            {SEZIONI.map(s => (
              <button key={s} onClick={() => cambiaSezione(s)}
                className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-colors whitespace-nowrap ${sezione === s ? (isStaging ? 'bg-white/20 text-white' : 'bg-gray-800 text-white') : (isStaging ? 'text-white/70 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100')}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button onClick={() => router.push('/giurato')}
            className={`text-sm transition-colors whitespace-nowrap ${isStaging ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
            Area giurato
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-semibold shrink-0">
            {profilo?.nome?.[0]?.toUpperCase()}{profilo?.cognome?.[0]?.toUpperCase()}
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
            className={`text-sm transition-colors ${isStaging ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
            Logout
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-5xl mx-auto">

        {/* RACCONTI */}
        {sezione === 'racconti' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2">
              <p className="text-sm text-gray-400">{racconti.length} racconti ricevuti</p>
              <button onClick={() => router.push('/admin-invio')}
                className="w-full sm:w-auto text-sm bg-gray-800 text-white px-5 py-2 rounded-lg hover:bg-gray-700 font-medium">
                + Carica racconto
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 sm:flex-wrap">
              <input type="text" placeholder="Cerca per titolo o autore..."
                value={raccontiFilter} onChange={e => setRaccontiFilter(e.target.value)}
                className="sm:flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              <div className="flex gap-3 sm:contents">
                <div className="flex-1 sm:flex-initial min-w-0 flex items-center gap-2">
                  <span className="hidden sm:inline text-xs text-gray-400 shrink-0">Filtra per:</span>
                  <svg className="sm:hidden shrink-0 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16l-6 8v6l-4 2v-8z" />
                  </svg>
                  <select value={raccontiStato} onChange={e => setRaccontiStato(e.target.value)}
                    className="flex-1 sm:flex-initial min-w-0 border border-gray-200 rounded sm:rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                    <option value="">Tutti gli stati</option>
                    {Object.entries(STATI_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <SortBar sortKey={raccontiSort} sortDir={raccontiDir}
                  onChange={(k, d) => { setRaccontiSort(k); setRaccontiDir(d) }} />
              </div>
            </div>
            {raccontiFiltrati.length === 0
              ? <p className="text-xs text-gray-300">Nessun racconto trovato</p>
              : raccontiFiltrati.map(r => {
                  const nValutazioni = contaValutazioniCompletate(r.id)
                  const nAssegnati = assegnazioniEsistenti.filter(a => a.racconto_id === r.id).length
                  const inCorso = ['ricevuto', 'in_valutazione', 'valutato'].includes(r.stato)
                  // Nessun ricalcolo qui: r.stato passa a 'valutato' lato server
                  // (lib/statoRacconti) solo quando TUTTI i giurati hanno confermato
                  // il blocco. Ricalcolarlo nel client anticipava il badge.
                  const badgeLabel = fmt(r.stato)
                  const badgeClass = STATO_BADGE[r.stato]
                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      {/* Card — solo mobile */}
                      <div className="sm:hidden">
                        <p className="text-sm font-medium text-gray-800">{r.titolo}</p>
                        <p className="text-xs text-gray-400 mt-0.5 mb-3">{autoreLabel(r)} · {new Date(r.inviato_il).toLocaleDateString('it-IT')}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {inCorso && nAssegnati > 0 && (
                            <span className="text-xs text-gray-400">{nValutazioni}/{nAssegnati}</span>
                          )}
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                          {nAssegnati > 0 && (
                            <button onClick={() => setRaccontoDettaglio(r)}
                              className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                              Vedi valutazioni
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Riga — solo desktop */}
                      <div className="hidden sm:flex items-center justify-between gap-4">
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
                          {nAssegnati > 0 && (
                            <button onClick={() => setRaccontoDettaglio(r)}
                              className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                              Vedi valutazioni
                            </button>
                          )}
                        </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Giurato interno</label>
                  <select value={nuovoBloccoInterno} onChange={e => setNuovoBloccoInterno(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                    <option value="">Seleziona...</option>
                    {giurati.filter(g => g.tipo_giurato === 'interno' && g.attivo !== false)
                      .sort((a, b) => a.cognome.localeCompare(b.cognome))
                      .map(g => (
                        <option key={g.id} value={g.id}>{g.cognome} {g.nome} — {statsGiurato(g.id).inCorso} in corso</option>
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
                        <option key={g.id} value={g.id}>{g.cognome} {g.nome} — {statsGiurato(g.id).inCorso} in corso</option>
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
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch">
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
                        {/* Mobile: lista di button */}
                        <div className="sm:hidden flex flex-col gap-2 flex-1 overflow-y-auto">
                          {raccontiDisponibili
                            .filter(r =>
                              !nuovoBloccoRacconti.includes(r.id) &&
                              (r.titolo?.toLowerCase().includes(raccontiDisponibiliFilter.toLowerCase()) ||
                              autoreLabel(r).toLowerCase().includes(raccontiDisponibiliFilter.toLowerCase()))
                            )
                            .sort((a, b) => (a.titolo ?? '').localeCompare(b.titolo ?? ''))
                            .map(r => (
                              <button
                                key={r.id}
                                onClick={() => setNuovoBloccoRacconti(prev => [...prev, r.id])}
                                className="p-4 rounded border border-gray-200 text-left hover:bg-blue-50 hover:border-blue-300 transition-colors"
                              >
                                <div className="font-semibold text-sm text-gray-900 mb-1">{r.titolo}</div>
                                <div className="text-xs text-gray-500">{autoreLabel(r)}</div>
                              </button>
                            ))
                          }
                        </div>
                        {/* Desktop: select */}
                        <select
                          multiple
                          value={selectedDisponibili}
                          onChange={e => setSelectedDisponibili(Array.from(e.target.selectedOptions, o => o.value))}
                          className="hidden sm:block flex-1 border border-gray-200 rounded-lg text-xs min-h-[160px] focus:outline-none focus:ring-1 focus:ring-gray-300"
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
                      <div className="flex flex-row sm:flex-col justify-center gap-2 py-1 sm:pt-10">
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
                        {/* Mobile: lista di button */}
                        <div className="sm:hidden flex flex-col gap-2 flex-1 overflow-y-auto">
                          {nuovoBloccoRacconti
                            .map(id => raccontiDisponibili.find(r => r.id === id))
                            .filter(Boolean)
                            .sort((a, b) => (a!.titolo ?? '').localeCompare(b!.titolo ?? ''))
                            .map(r => (
                              <button
                                key={r!.id}
                                onClick={() => setNuovoBloccoRacconti(prev => prev.filter(id => id !== r!.id))}
                                className="p-4 rounded border border-blue-300 bg-blue-50 text-left hover:bg-blue-100 transition-colors"
                              >
                                <div className="font-semibold text-sm text-gray-900 mb-1">{r!.titolo}</div>
                                <div className="text-xs text-gray-500">{autoreLabel(r!)}</div>
                              </button>
                            ))
                          }
                        </div>
                        {/* Desktop: select */}
                        <select
                          multiple
                          value={selectedScelti}
                          onChange={e => setSelectedScelti(Array.from(e.target.selectedOptions, o => o.value))}
                          className="hidden sm:block flex-1 border border-gray-200 rounded-lg text-xs min-h-[160px] focus:outline-none focus:ring-1 focus:ring-gray-300"
                        >
                          {nuovoBloccoRacconti
                            .map(id => raccontiDisponibili.find(r => r.id === id))
                            .filter(Boolean)
                            .sort((a, b) => (a!.titolo ?? '').localeCompare(b!.titolo ?? ''))
                            .map(r => (
                              <option key={r!.id} value={r!.id}>
                                {r!.titolo} — {autoreLabel(r!)}
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 sm:flex-wrap">
                <input type="text" placeholder="Cerca per titolo o autore..."
                  value={assFilter} onChange={e => setAssFilter(e.target.value)}
                  className="sm:flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                <div className="flex items-center gap-3 sm:contents">
                  <SortBar sortKey={assSort} sortDir={assDir}
                    onChange={(k, d) => { setAssSort(k); setAssDir(d) }} />
                  <button onClick={carica} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Aggiorna</button>
                </div>
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
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3">
                          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_90px_minmax(0,2fr)_110px] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-100">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Titolo</span>
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Blocco</span>
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Giurati</span>
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Stato</span>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {list.map(r => {
                              const assegnazioniRacconto = assegnazioniEsistenti
                                .filter(a => a.racconto_id === r.id)
                                .slice()
                                .sort((a, b) => {
                                  const ga = giurati.find(x => x.id === a.giurato_id)
                                  const gb = giurati.find(x => x.id === b.giurato_id)
                                  const ordine: Record<string, number> = { interno: 0, lettore: 1, qualita: 2 }
                                  return (ordine[ga?.tipo_giurato] ?? 9) - (ordine[gb?.tipo_giurato] ?? 9)
                                })
                              const bloccoId = assegnazioniRacconto[0]?.blocco_id
                              // Numero progressivo dal DB, non la posizione nella lista:
                              // cosi' l'etichetta coincide con quella vista dai giurati
                              const numeroBlocco = blocchi.find(b => b.id === bloccoId)?.numero
                              const bloccoLabel = bloccoId ? `Blocco ${numeroBlocco ?? '—'}` : '—'
                              const badgesGiurati = assegnazioniRacconto.length === 0
                                ? <span className="text-xs text-gray-300">Nessun giurato</span>
                                : assegnazioniRacconto.map(a => {
                                    const g = giurati.find(x => x.id === a.giurato_id)
                                    if (!g) return null
                                    const cfg = TIPO_CONFIG[g.tipo_giurato] || TIPO_CONFIG.lettore
                                    // 'valutato' solo a blocco confermato: fino a quel momento
                                    // criteri e bonus restano modificabili. Le assegnazioni
                                    // storiche senza blocco mantengono il vecchio criterio.
                                    const confermato = a.blocco_id
                                      ? !!blocchiConfermati[`${a.blocco_id}|${a.giurato_id}`]
                                      : !!a.completata
                                    return (
                                      <div key={a.id} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border shrink-0 ${confermato ? cfg.attivo : 'border-gray-200 text-gray-400'}`}>
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
                                        {g.nome} {g.cognome}
                                        {confermato
                                          ? <span className="text-[10px] opacity-60">· valutato</span>
                                          : <span className="text-[10px] text-red-400">· non valutato</span>
                                        }
                                      </div>
                                    )
                                  })
                              const statoBadge = <span className={`text-xs px-3 py-1 rounded-full font-medium shrink-0 ${STATO_BADGE[r.stato]}`}>{fmt(r.stato)}</span>
                              return (
                                <div key={r.id}>
                                  {/* Card impilata — solo mobile */}
                                  <div className="sm:hidden px-4 py-3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-sm font-medium text-gray-800 truncate">{r.titolo}</p>
                                      {statoBadge}
                                    </div>
                                    <span className="text-xs text-gray-500">{bloccoLabel}</span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {badgesGiurati}
                                    </div>
                                  </div>
                                  {/* Tabella a colonne — solo desktop */}
                                  <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_90px_minmax(0,2fr)_110px] gap-4 px-4 py-3 items-center">
                                    <p className="text-sm font-medium text-gray-800 truncate">{r.titolo}</p>
                                    <span className="text-xs text-gray-500">{bloccoLabel}</span>
                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                      {badgesGiurati}
                                    </div>
                                    <span className="justify-self-start">{statoBadge}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
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
              : finalistiOrdinati.map((r, i) => {
                // Le due fasi non si sommano: qui conta solo il punteggio dato
                // dai giurati di qualita'. Quello preliminare resta visibile
                // come riferimento, ma non entra in questa classifica.
                const punteggioFinale = punteggioFinaleDi(r.id)
                const punteggioPrelim = punteggioDi(r.id)
                const nValFinale = nValutazioniFinale(r.id)
                const nAssFinale = nAssegnatiFinale(r.id)
                const finaleCompleto = nAssFinale > 0 && nValFinale >= nAssFinale
                return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-sm text-gray-300 font-medium shrink-0">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{r.titolo}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Autore: {autoreLabel(r)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Caricato il: {new Date(r.inviato_il).toLocaleDateString('it-IT')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {punteggioFinale !== null && (
                        <span className="text-lg font-semibold text-gray-800">{punteggioFinale}</span>
                      )}
                      <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">Finalista</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">Fase finale</span>
                    {punteggioFinale === null
                      ? <span className="text-xs text-gray-300">Nessuna valutazione di qualità</span>
                      : <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                          finaleCompleto ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {finaleCompleto ? `✓ Completo (${nValFinale}/${nAssFinale})` : `⏳ Parziale (${nValFinale}/${nAssFinale || '?'})`}
                        </span>
                    }
                    {punteggioPrelim !== null && (
                      <span className="text-xs text-gray-400">· preliminare: {punteggioPrelim}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {giurati.filter(g => g.tipo_giurato === 'qualita' && g.attivo !== false).length === 0
                      ? <p className="text-xs text-gray-300">Nessun giurato di qualità disponibile</p>
                      : giurati.filter(g => g.tipo_giurato === 'qualita' && g.attivo !== false).map(g =>
                          <BtnGiurato key={g.id} g={g} racconto={r} tipo="qualita" />
                        )
                    }
                  </div>
                  <div className="flex items-center gap-2 border-t border-gray-100 pt-3 flex-wrap">
                    <p className="text-xs text-gray-400 mr-2">Stato:</p>
                    {(['vincitore', 'eliminato'] as const).map(key => (
                      <button key={key} onClick={() => aggiornaStato(r.id, key)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${r.stato === key ? activeClass[key] : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                        {fmt(key)}
                      </button>
                    ))}
                  </div>
                </div>
                )
              })
            }
          </div>
        )}

        {/* RISULTATI */}
        {sezione === 'risultati' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 sm:flex-wrap">
              <input type="text" placeholder="Cerca per titolo o autore..."
                value={risFilter} onChange={e => setRisFilter(e.target.value)}
                className="sm:flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              <SortBar sortKey={risSort} sortDir={risDir} showPunteggio
                onChange={(k, d) => { setRisSort(k); setRisDir(d) }} />
            </div>
            {medieFiltered.length === 0
              ? <p className="text-xs text-gray-300">Nessun risultato trovato</p>
              : medieFiltered.map((m, i) => {
                const valRacconto = valutazioni.filter(v =>
                  v.assegnazioni?.racconto_id === m.racconto_id && v.assegnazioni?.fase !== 'finale')
                // La riga Punteggio mostra le SOMME dei criteri, non le medie della view
                // medie_racconti: con le medie la riga non tornava con il proprio totale
                // (4+4+4.5+4 accanto a un totale di 34).
                const sommaCriterio = (k: string) =>
                  valRacconto.reduce((tot: number, v: any) => tot + (v[`criterio_${k}`] ?? 0), 0)
                const sommaBonus = valRacconto.filter((v: any) => v.bonus).length
                const punteggio = punteggioDi(m.racconto_id)
                const racconto = racconti.find(r => r.id === m.racconto_id)
                const autore = racconto ? autoreLabel(racconto) : ''
                const aperto = risAperti[m.racconto_id] ?? false
                const numAssegnati = nAssegnatiPreliminare(m.racconto_id)
                const numValutazioni = nValutazioniPreliminare(m.racconto_id)
                const risultatoCompleto = numAssegnati > 0 && numValutazioni >= numAssegnati
                return (
                  <div key={m.racconto_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Card — solo mobile */}
                    <div className="sm:hidden px-5 py-3">
                      <button
                        onClick={() => setRisAperti(prev => ({ ...prev, [m.racconto_id]: !prev[m.racconto_id] }))}
                        className="w-full flex items-start justify-between gap-3 mb-2 text-left">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-sm text-gray-300 font-medium shrink-0">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{m.titolo}</p>
                            <p className="text-xs text-gray-400 truncate">{autore}</p>
                          </div>
                        </div>
                        {punteggio !== null && <span className="text-lg font-semibold text-gray-800 shrink-0">{punteggio}</span>}
                      </button>
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        {/* A valutazione chiusa "Completo" ripeterebbe lo stato accanto:
                            la pill compare solo quando manca ancora un giurato. */}
                        {!risultatoCompleto && (
                          <span className="text-xs px-3 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                            ⏳ Parziale ({numValutazioni}/{numAssegnati || '?'})
                          </span>
                        )}
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATO_BADGE[m.stato]}`}>{fmt(m.stato)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {(['finalista', 'eliminato'] as const).map(key => (
                            <button key={key} onClick={() => aggiornaStato(m.racconto_id, key)}
                              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                m.stato === key ? activeClass[key] : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                              }`}>
                              {fmt(key)}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setRisAperti(prev => ({ ...prev, [m.racconto_id]: !prev[m.racconto_id] }))}
                          className="text-gray-400 text-xs px-1 hover:text-gray-600">
                          {aperto ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>
                    {/* Riga — solo desktop */}
                    <div className="hidden sm:flex w-full items-center justify-between gap-3 px-5 py-3">
                      <button
                        onClick={() => setRisAperti(prev => ({ ...prev, [m.racconto_id]: !prev[m.racconto_id] }))}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-70 transition-opacity">
                        <span className="text-sm text-gray-300 font-medium w-5 shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{m.titolo}</p>
                          <p className="text-xs text-gray-400 truncate">{autore}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Larghezze fisse e cifre a passo costante: senza queste il
                            punteggio (26 vs 9) sposta tutte le pill a destra e le righe
                            non risultano incolonnate. */}
                        <span className="w-10 text-right text-lg font-semibold text-gray-800 tabular-nums">
                          {punteggio !== null ? punteggio : ''}
                        </span>
                        <span className="w-32 text-center">
                          {!risultatoCompleto && (
                            <span className="text-xs px-3 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                              ⏳ Parziale ({numValutazioni}/{numAssegnati || '?'})
                            </span>
                          )}
                        </span>
                        <span className={`w-28 text-center text-xs px-3 py-1 rounded-full font-medium ${STATO_BADGE[m.stato]}`}>{fmt(m.stato)}</span>
                        <div className="flex items-center gap-2">
                          {(['finalista', 'eliminato'] as const).map(key => (
                            <button key={key} onClick={() => aggiornaStato(m.racconto_id, key)}
                              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                m.stato === key ? activeClass[key] : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                              }`}>
                              {fmt(key)}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setRisAperti(prev => ({ ...prev, [m.racconto_id]: !prev[m.racconto_id] }))}
                          className="text-gray-400 text-xs px-1 hover:text-gray-600">
                          {aperto ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>
                    {aperto && (
                      <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                        {valRacconto.length > 0 && (
                          <div className="mb-4">
                            {/* Card impilate — solo mobile */}
                            <div className="sm:hidden space-y-2">
                              {valRacconto.map(v => {
                                const totale = (v.criterio_a ?? 0) + (v.criterio_b ?? 0) + (v.criterio_c ?? 0) + (v.criterio_d ?? 0) + (v.bonus ? 1 : 0)
                                const giuratoInfo = giurati.find(g => g.id === v.assegnazioni?.giurato_id)
                                const cfg = TIPO_CONFIG[giuratoInfo?.tipo_giurato] || TIPO_CONFIG.lettore
                                return (
                                  <div key={v.id} className="bg-gray-50 rounded-lg p-3 text-xs">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
                                      <span className="text-gray-700 font-medium">{v.assegnazioni?.profiles?.nome} {v.assegnazioni?.profiles?.cognome}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                      {CRITERI.map(c => (
                                        <div key={c.key} className="flex justify-between">
                                          <span className="text-gray-400">{c.label}</span>
                                          <span className="font-medium text-gray-700">{v[`criterio_${c.key}`]}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                                      <span className="text-gray-400">Bonus: {v.bonus ? '+1' : '—'}</span>
                                      <span className="font-semibold text-gray-800">Totale: {totale}</span>
                                    </div>
                                  </div>
                                )
                              })}
                              {risultatoCompleto && punteggio !== null && (
                                <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 text-xs">
                                  <p className="text-gray-500 font-medium uppercase text-[10px] tracking-wide mb-2">Punteggio</p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    {CRITERI.map(c => (
                                      <div key={c.key} className="flex justify-between">
                                        <span className="text-gray-400">{c.label}</span>
                                        <span className="font-semibold text-gray-700">{sommaCriterio(c.key)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                                    <span className="text-gray-400">Bonus: {sommaBonus > 0 ? `+${sommaBonus}` : '—'}</span>
                                    <span className="font-bold text-gray-900">Totale: {punteggio}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Tabella a colonne — solo desktop */}
                            <div className="hidden sm:block space-y-2">
                              <div className="grid grid-cols-8 gap-2 text-[10px] text-gray-400 uppercase px-2">
                                <span className="col-span-2">Giurato</span>
                                {CRITERI.map(c => <span key={c.key} className="text-center">{c.label}</span>)}
                                <span className="text-center">Bonus</span>
                                <span className="text-center">Totale</span>
                              </div>
                              {valRacconto.map(v => {
                                const totale = (v.criterio_a ?? 0) + (v.criterio_b ?? 0) + (v.criterio_c ?? 0) + (v.criterio_d ?? 0) + (v.bonus ? 1 : 0)
                                const giuratoInfo = giurati.find(g => g.id === v.assegnazioni?.giurato_id)
                                const cfg = TIPO_CONFIG[giuratoInfo?.tipo_giurato] || TIPO_CONFIG.lettore
                                return (
                                  <div key={v.id} className="grid grid-cols-8 gap-2 bg-gray-50 rounded-lg px-2 py-1.5 text-xs items-center">
                                    <span className="col-span-2 text-gray-600 truncate flex items-center gap-1.5">
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${cfg.badge}`}>{cfg.label}</span>
                                      <span className="truncate">{v.assegnazioni?.profiles?.nome} {v.assegnazioni?.profiles?.cognome}</span>
                                    </span>
                                    {CRITERI.map(c => (
                                      <span key={c.key} className="text-center text-gray-700 font-medium">{v[`criterio_${c.key}`]}</span>
                                    ))}
                                    <span className="text-center text-gray-700 font-medium">{v.bonus ? '+1' : '—'}</span>
                                    <span className="text-center text-gray-800 font-semibold">{totale}</span>
                                  </div>
                                )
                              })}
                              {/* Punteggio: solo quando entrambi i giudici hanno valutato,
                                  allineata alle stesse colonne della tabella sopra. Ogni cella
                                  e' la somma della colonna, bonus compreso, cosi' la riga torna
                                  con il totale. */}
                              {risultatoCompleto && punteggio !== null && (
                                <div className="grid grid-cols-8 gap-2 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-xs items-center">
                                  <span className="col-span-2 text-gray-500 font-medium uppercase text-[10px] tracking-wide">Punteggio</span>
                                  {CRITERI.map(c => (
                                    <span key={c.key} className="text-center text-gray-700 font-semibold">{sommaCriterio(c.key)}</span>
                                  ))}
                                  <span className="text-center text-gray-700 font-semibold">{sommaBonus > 0 ? `+${sommaBonus}` : '—'}</span>
                                  <span className="text-center text-gray-900 font-bold">{punteggio}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {punteggio === null && <p className="text-xs text-gray-300">Nessuna valutazione ancora</p>}
                      </div>
                    )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-medium text-gray-800 mb-1">Blocchi per giurato</p>
              <p className="text-xs text-gray-400 mb-4">
                Blocchi confermati sul totale assegnato. Un blocco risulta confermato quando il
                giurato lo ha sottomesso, non quando ha salvato le valutazioni.
              </p>
              {(() => {
                const righe = giurati
                  .filter(g => g.attivo !== false)
                  .map(g => ({ g, ...blocchiGiurato(g.id) }))
                  .filter(r => r.assegnati > 0)
                  .sort((a, b) =>
                    a.g.cognome.localeCompare(b.g.cognome) || a.g.nome.localeCompare(b.g.nome))
                if (righe.length === 0) {
                  return <p className="text-xs text-gray-300">Nessun blocco ancora assegnato.</p>
                }
                const totAssegnati = righe.reduce((t, r) => t + r.assegnati, 0)
                const totCompletati = righe.reduce((t, r) => t + r.completati, 0)
                return (
                  <div>
                    <div className="space-y-2">
                      {righe.map(({ g, assegnati, completati, mancanti }) => {
                        const cfg = TIPO_CONFIG[g.tipo_giurato] || TIPO_CONFIG.lettore
                        const chiuso = completati === assegnati
                        const nota = mancanti.length === 0
                          ? 'tutti confermati'
                          : `da confermare: ${mancanti.join(', ')}`
                        return (
                          <div key={g.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-1">
                            <div className="flex items-center gap-2 min-w-0 sm:w-52 sm:shrink-0">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${cfg.badge}`}>{cfg.label}</span>
                              <span className="text-xs text-gray-700 truncate">{g.cognome} {g.nome}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-1 h-2 bg-gray-100 rounded-sm overflow-hidden">
                                <div className={`h-full rounded-sm ${chiuso ? 'bg-green-500' : 'bg-amber-400'}`}
                                  style={{ width: `${(completati / assegnati) * 100}%` }} />
                              </div>
                              <span className="text-xs text-gray-600 tabular-nums w-12 text-right shrink-0">{completati}/{assegnati}</span>
                              <span className={`text-[10px] shrink-0 sm:w-44 truncate ${chiuso ? 'text-gray-300' : 'text-amber-600'}`} title={nota}>
                                {nota}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                      Totale: {totCompletati} blocchi confermati su {totAssegnati} assegnati.
                    </p>
                  </div>
                )
              })()}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              {/* Pannello richiudibile: di default e' chiuso, cosi' l'elenco dei
                  giurati resta subito visibile senza scorrere. */}
              <button onClick={() => setCaricoAperto(v => !v)}
                className="w-full flex items-start justify-between gap-3 text-left">
                <span className="block">
                  <span className="block text-sm font-medium text-gray-800 mb-1">Carico di lavoro</span>
                  <span className="block text-xs text-gray-400">Ordinato dal più libero al più occupato.</span>
                </span>
                <span className="text-gray-400 text-xs px-1 shrink-0">{caricoAperto ? '▲' : '▼'}</span>
              </button>
              {caricoAperto && <div className="mt-4">{(() => {
                const righe = (g: any, maxValore: number, inCorso: number) => (
                  <div key={g.id} className="flex items-center gap-3 py-1">
                    <span className="text-xs text-gray-600 truncate shrink-0 w-32" title={`${g.cognome} ${g.nome}`}>{g.cognome} {g.nome}</span>
                    <div className="flex-1 h-2 bg-gray-50 rounded-sm overflow-hidden">
                      <div className={`h-full rounded-sm ${inCorso > 0 ? 'bg-red-400' : ''}`}
                        style={{ width: `${(inCorso / maxValore) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-4 shrink-0">{inCorso}</span>
                  </div>
                )
                const colonna = (tipo: string, label: string) => {
                  const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.lettore
                  const lista = giurati.filter(g => g.attivo !== false && g.tipo_giurato === tipo)
                    .map(g => ({ g, ...statsGiurato(g.id) }))
                    .sort((a, b) => a.inCorso - b.inCorso || a.g.cognome.localeCompare(b.g.cognome))
                  const maxValore = Math.max(1, ...lista.map(s => s.inCorso))
                  return (
                    <div>
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${cfg.badge}`}>{label}</span>
                      <div className="mt-2">
                        {lista.length === 0
                          ? <p className="text-xs text-gray-300">Nessuno</p>
                          : lista.map(({ g, inCorso }) => righe(g, maxValore, inCorso))
                        }
                      </div>
                    </div>
                  )
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    {colonna('interno', 'Interni')}
                    {colonna('lettore', 'Lettori')}
                  </div>
                )
              })()}</div>}
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
                <input type="text" placeholder="Cerca per nome..."
                  value={giuratiFilter} onChange={e => setGiuratiFilter(e.target.value)}
                  className="sm:flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                <button onClick={carica} className="text-xs text-gray-400 hover:text-gray-600 shrink-0 self-start sm:self-auto">Aggiorna</button>
              </div>
              {giuratiFiltrati.map(g => {
                const cfg = TIPO_CONFIG[g.tipo_giurato] || TIPO_CONFIG.lettore
                const link = linkGenerati[g.id]
                const isCopied = link === 'Copiato!'
                const disabilitato = g.attivo === false
                return (
                  <div key={g.id} className={`bg-white rounded-xl border p-4 ${disabilitato ? 'border-gray-100 opacity-50' : 'border-gray-200'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${cfg.badge}`}>{cfg.label}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{g.nome} {g.cognome}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{g.email}</p>
                        </div>
                        {disabilitato && (
                          <span className="text-[10px] text-red-400 border border-red-200 px-1.5 py-0.5 rounded shrink-0">disabilitato</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
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

        {/* Modale dettaglio valutazioni */}
        {raccontoDettaglio && (() => {
          const r = racconti.find(rr => rr.id === raccontoDettaglio.id) ?? raccontoDettaglio
          const valRacconto = valutazioni.filter(v => v.assegnazioni?.racconto_id === r.id)
          return (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl w-full shadow-lg max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-gray-800">{r.titolo}</h3>
                  <button onClick={() => setRaccontoDettaglio(null)}
                    className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
                </div>
                <p className="text-xs text-gray-400 mb-5">{autoreLabel(r)}</p>

                {valRacconto.length === 0 ? (
                  <p className="text-sm text-gray-400 mb-5">Nessuna valutazione disponibile ancora.</p>
                ) : (
                  <div className="space-y-3 mb-5">
                    {valRacconto.map(v => {
                      const totale = (v.criterio_a ?? 0) + (v.criterio_b ?? 0) + (v.criterio_c ?? 0) + (v.criterio_d ?? 0) + (v.bonus ? 1 : 0)
                      return (
                        <div key={v.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-0 mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              {v.assegnazioni?.profiles?.nome} {v.assegnazioni?.profiles?.cognome}
                            </span>
                            <span className="text-sm font-semibold text-gray-800">Totale: {totale}</span>
                          </div>
                          {/* Elenco etichetta:valore — solo mobile */}
                          <div className="sm:hidden space-y-1 text-xs mb-2">
                            {CRITERI.map(c => (
                              <div key={c.key} className="flex justify-between">
                                <span className="text-gray-400">{c.label}</span>
                                <span className="font-medium text-gray-700">{v[`criterio_${c.key}`]}</span>
                              </div>
                            ))}
                            <div className="flex justify-between">
                              <span className="text-gray-400">Bonus</span>
                              <span className="font-medium text-gray-700">{v.bonus ? '+1 ★' : '—'}</span>
                            </div>
                          </div>
                          {/* Griglia a colonne — solo desktop */}
                          <div className="hidden sm:grid sm:grid-cols-5 gap-2 text-xs mb-2">
                            {CRITERI.map(c => (
                              <div key={c.key} className="text-center">
                                <p className="text-[10px] text-gray-400 uppercase">{c.label}</p>
                                <p className="font-medium text-gray-700">{v[`criterio_${c.key}`]}</p>
                              </div>
                            ))}
                            <div className="text-center">
                              <p className="text-[10px] text-gray-400 uppercase">Bonus</p>
                              <p className="font-medium text-gray-700">{v.bonus ? '+1 ★' : '—'}</p>
                            </div>
                          </div>
                          {v.note && (
                            <p className="text-xs text-gray-500 border-t border-gray-200 pt-2 mt-1">
                              <span className="text-gray-400">Note: </span>{v.note}
                            </p>
                          )}
                        </div>
                      )
                    })}
                    {r.stato === 'valutato' && valRacconto.length > 0 && (() => {
                      // Somma e non media: per ogni criterio si sommano i voti
                      // dei giurati, e il totale e' la somma dei loro totali.
                      const somma = (vals: number[]) => vals.reduce((s, x) => s + x, 0)
                      const sommaA = somma(valRacconto.map(v => v.criterio_a ?? 0))
                      const sommaB = somma(valRacconto.map(v => v.criterio_b ?? 0))
                      const sommaC = somma(valRacconto.map(v => v.criterio_c ?? 0))
                      const sommaD = somma(valRacconto.map(v => v.criterio_d ?? 0))
                      const sommaBonus = somma(valRacconto.map(v => v.bonus ? 1 : 0))
                      const sommaTotale = somma(valRacconto.map(totaleGiurato))
                      return (
                        <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-0 mb-2">
                            <span className="text-sm font-semibold text-green-700">Punteggio</span>
                            <span className="text-sm font-semibold text-green-800">Totale: {sommaTotale}</span>
                          </div>
                          {/* Elenco etichetta:valore — solo mobile */}
                          <div className="sm:hidden space-y-1 text-xs">
                            {[sommaA, sommaB, sommaC, sommaD].map((m, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-green-500">{CRITERI[idx].label}</span>
                                <span className="font-medium text-green-700">{m}</span>
                              </div>
                            ))}
                            <div className="flex justify-between">
                              <span className="text-green-500">Bonus</span>
                              <span className="font-medium text-green-700">{sommaBonus}</span>
                            </div>
                          </div>
                          {/* Griglia a colonne — solo desktop */}
                          <div className="hidden sm:grid sm:grid-cols-5 gap-2 text-xs">
                            {[sommaA, sommaB, sommaC, sommaD].map((m, idx) => (
                              <div key={idx} className="text-center">
                                <p className="text-[10px] text-green-400 uppercase">{CRITERI[idx].label}</p>
                                <p className="font-medium text-green-700">{m}</p>
                              </div>
                            ))}
                            <div className="text-center">
                              <p className="text-[10px] text-green-400 uppercase">Bonus</p>
                              <p className="font-medium text-green-700">{sommaBonus}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
