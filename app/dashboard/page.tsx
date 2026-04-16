'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function formattaStato(stato: string) {
  const labels: Record<string, string> = {
    ricevuto: 'Ricevuto',
    in_valutazione: 'In valutazione',
    valutato: 'Valutato',
    finalista: 'Finalista',
    eliminato: 'Eliminato',
    vincitore: 'Vincitore',
  }
  return labels[stato] ?? stato
}

export default function DashboardPage() {
  const router = useRouter()
  const [racconti, setRacconti] = useState<any[]>([])
  const [giurati, setGiurati] = useState<any[]>([])
  const [assegnazioniEsistenti, setAssegnazioniEsistenti] = useState<any[]>([])
  const [valutazioni, setValutazioni] = useState<any[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [sezione, setSezione] = useState<'racconti' | 'assegnazioni' | 'finalisti' | 'risultati' | 'giurati'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '')
      if (['racconti', 'assegnazioni', 'finalisti', 'risultati', 'giurati'].includes(hash)) {
        return hash as 'racconti' | 'assegnazioni' | 'finalisti' | 'risultati' | 'giurati'
      }
    }
    return 'racconti'
  })
  const [medie, setMedie] = useState<any[]>([])
  const [nuovoGiurato, setNuovoGiurato] = useState({
    nome: '',
    cognome: '',
    email: '',
    tipo_giurato: 'lettore',
  })
  const [aggiungendo, setAggiungendo] = useState(false)
  const [messaggioGiurato, setMessaggioGiurato] = useState('')

  function cambiaSezione(s: 'racconti' | 'assegnazioni' | 'finalisti' | 'risultati' | 'giurati') {
    setSezione(s)
    window.location.hash = s
  }

  async function carica() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profilo } = await supabase
      .from('profiles')
      .select('ruolo')
      .eq('id', user.id)
      .single()

    if (profilo?.ruolo !== 'admin') { router.push('/login'); return }

    const [{ data: r }, { data: g }, { data: m }, { data: a }, { data: v }] = await Promise.all([
      supabase.from('racconti').select('*, profiles(nome, cognome)').order('inviato_il', { ascending: false }),
      supabase.from('profiles').select('*').eq('ruolo', 'giurato'),
      supabase.from('medie_racconti').select('*').order('media_complessiva', { ascending: false }),
      supabase.from('assegnazioni').select('*'),
      supabase.from('valutazioni').select(`
        *,
        assegnazioni(
          racconto_id,
          giurato_id,
          profiles(nome, cognome)
        )
      `),
    ])

    setRacconti(r || [])
    setGiurati(g || [])
    setMedie(m || [])
    setAssegnazioniEsistenti(a || [])
    setValutazioni(v || [])
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

    //Per la fase qualità i racconti sono finalisti - non bloccare
   if (fase !== 'qualità') {
    if (['valutato', 'finalista', 'eliminato', 'vincitore'].includes(racconto?.stato)) return
  } else {
    // Nella fase qualità blocca solo se già vinti/eliminati
    if (['eliminato', 'vincitore'].includes(racconto?.stato)) return
  }

    const haValutato = assegnazioniEsistenti.some(a =>
      a.racconto_id === racconto_id &&
      a.giurato_id === giurato_id &&
      a.completata === true
    )
    if (haValutato) return

    const esiste = assegnazioniEsistenti.some(
      a => a.racconto_id === racconto_id && a.giurato_id === giurato_id
    )
    if (esiste) {
      const { error } = await supabase
        .from('assegnazioni')
        .delete()
        .eq('racconto_id', racconto_id)
        .eq('giurato_id', giurato_id)
      if (!error) {
        const nuoveAssegnazioni = assegnazioniEsistenti.filter(
          a => !(a.racconto_id === racconto_id && a.giurato_id === giurato_id)
        )
        setAssegnazioniEsistenti(nuoveAssegnazioni)
        const rimaste = nuoveAssegnazioni.filter(a => a.racconto_id === racconto_id)
        if (rimaste.length === 0) {
          await supabase.from('racconti').update({ stato: 'ricevuto' }).eq('id', racconto_id)
          setRacconti(prev => prev.map(r => r.id === racconto_id ? { ...r, stato: 'ricevuto' } : r))
        }
      }
    } else {
      const { data, error } = await supabase
        .from('assegnazioni')
        .insert({ racconto_id, giurato_id, fase })
        .select()
        .single()
      if (!error && data) {
        setAssegnazioniEsistenti(prev => [...prev, data])
        const racconto = racconti.find(r => r.id === racconto_id)
        if (racconto?.stato === 'ricevuto') {
          await supabase.from('racconti').update({ stato: 'in_valutazione' }).eq('id', racconto_id)
          setRacconti(prev => prev.map(r => r.id === racconto_id ? { ...r, stato: 'in_valutazione' } : r))
        }
      }
    }
  }

  async function aggiungiGiurato() {
    setAggiungendo(true)
    setMessaggioGiurato('')

    const res = await fetch('/api/invite-giurato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuovoGiurato),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessaggioGiurato(`Errore: ${data.error}`)
      setAggiungendo(false)
      return
    }

    setGiurati(prev => [...prev, { id: data.user.id, ...nuovoGiurato }])
    setNuovoGiurato({ nome: '', cognome: '', email: '', tipo_giurato: 'lettore' })
    setMessaggioGiurato('✓ Invito inviato via email al giurato.')
    setAggiungendo(false)
  }

  async function eliminaGiurato(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questo giurato?')) return
    await supabase.from('profiles').delete().eq('id', id)
    setGiurati(prev => prev.filter(g => g.id !== id))
  }

  const statoBadge: Record<string, string> = {
    ricevuto: 'bg-gray-100 text-gray-600',
    in_valutazione: 'bg-blue-50 text-blue-600',
    valutato: 'bg-teal-50 text-teal-600',
    finalista: 'bg-purple-50 text-purple-600',
    eliminato: 'bg-red-50 text-red-500',
    vincitore: 'bg-amber-100 text-amber-600',
  }

  const coloriStepAuto: Record<string, string> = {
    ricevuto: 'bg-gray-400 text-white',
    in_valutazione: 'bg-blue-400 text-white',
    valutato: 'bg-teal-500 text-white',
  }

  const tipoConfig: Record<string, { badge: string, attivo: string, label: string }> = {
    interno: {
      badge: 'bg-purple-100 text-purple-700',
      attivo: 'bg-purple-50 border-purple-400 text-purple-800',
      label: 'INT',
    },
    lettore: {
      badge: 'bg-blue-100 text-blue-700',
      attivo: 'bg-blue-50 border-blue-400 text-blue-800',
      label: 'LET',
    },
    qualita: {
      badge: 'bg-amber-100 text-amber-700',
      attivo: 'bg-amber-50 border-amber-400 text-amber-800',
      label: 'QUA',
    },
  }

  const criteri = [
    { key: 'a', label: 'Incipit' },
    { key: 'b', label: 'Svolta narrativa' },
    { key: 'c', label: 'Climax' },
    { key: 'd', label: 'Scioglimento' },
    { key: 'e', label: 'Giudizio complessivo' },
  ]

  const giuratiAssegnabili = giurati.filter(g => ['interno', 'lettore'].includes(g.tipo_giurato))

  function CardAssegnazione({ r }: { r: any }) {
    const statoBlocco = ['valutato', 'finalista', 'eliminato', 'vincitore'].includes(r.stato)
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-800">{r.titolo}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Autore: {r.autore_nome ? `${r.autore_nome} ${r.autore_cognome}` : `${r.profiles?.nome} ${r.profiles?.cognome}`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Caricato il: {new Date(r.inviato_il).toLocaleDateString('it-IT')}
            </p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full shrink-0 ${statoBadge[r.stato]}`}>
            {formattaStato(r.stato)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {giuratiAssegnabili.map(g => {
            const assegnazione = assegnazioniEsistenti.find(
              a => a.racconto_id === r.id && a.giurato_id === g.id
            )
            const assegnato = !!assegnazione
            const haValutato = assegnazione?.completata === true
            const bloccato = statoBlocco || haValutato
            const cfg = tipoConfig[g.tipo_giurato] || tipoConfig['lettore']
            return (
              <button
                key={g.id}
                onClick={() => !bloccato && assegna(r.id, g.id, r.stato === 'finalista' ? 'finale' : 'preliminare')}
                disabled={bloccato}
                title={haValutato ? 'Il giurato ha già valutato questo racconto' : ''}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  assegnato
                    ? bloccato ? `${cfg.attivo} opacity-50 cursor-not-allowed` : cfg.attivo
                    : bloccato ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>
                  {cfg.label}
                </span>
                {assegnato ? '✓ ' : ''}{g.nome} {g.cognome}
                {haValutato && <span className="text-[10px] opacity-60">· valutato</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (caricamento) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  const raccontinDaAssegnare = racconti.filter(r => r.stato === 'ricevuto')
  const raccontiInValutazione = racconti.filter(r => r.stato === 'in_valutazione')
  const raccontiValutatiEliminati = racconti.filter(r => ['valutato', 'eliminato'].includes(r.stato))
  const raccontiFinalisti = racconti.filter(r => r.stato === 'finalista')

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        .pill-auto {
          cursor: not-allowed;
          position: relative;
        }
        .pill-auto:hover::after {
          content: 'Gestito automaticamente dal sistema';
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: #1f2937;
          color: white;
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 10;
        }
      `}</style>

      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <img src="/logo_tohorror_dark.png" alt="TOHorror" className="h-16" />
        <div className="flex gap-2">
          {(['racconti', 'assegnazioni', 'finalisti', 'risultati', 'giurati'] as const).map(s => (
            <button
              key={s}
              onClick={() => cambiaSezione(s)}
              className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                sezione === s ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-8 max-w-5xl mx-auto">

        {/* SEZIONE RACCONTI */}
        {sezione === 'racconti' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">{racconti.length} racconti ricevuti</p>
              <button
                onClick={() => router.push('/admin-invio')}
                className="text-sm bg-gray-800 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700"
              >
                Carica racconto
              </button>
            </div>
            {racconti.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.titolo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Autore: {r.autore_nome ? `${r.autore_nome} ${r.autore_cognome}` : `${r.profiles?.nome} ${r.profiles?.cognome}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Caricato il: {new Date(r.inviato_il).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center mt-4 gap-2 flex-wrap">
                  {['ricevuto', 'in_valutazione', 'valutato'].map((s, i) => {
                    const statiOrdinati = ['ricevuto', 'in_valutazione', 'valutato', 'finalista', 'eliminato', 'vincitore']
                    const indiceStatoAttuale = statiOrdinati.indexOf(r.stato)
                    const stepCompletato = indiceStatoAttuale >= i
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <div className={`pill-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                          stepCompletato ? coloriStepAuto[s] : 'bg-gray-100 text-gray-400'
                        }`}>
                          {stepCompletato && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                          {formattaStato(s)}
                        </div>
                        {i < 2 && <span className="text-gray-300 text-xs">›</span>}
                      </div>
                    )
                  })}

                  <span className="text-gray-300 text-xs">›</span>

                  {['finalista', 'eliminato'].map(key => {
                    const isSelected = r.stato === key
                    const isEnabled = ['valutato', 'finalista', 'eliminato', 'vincitore'].includes(r.stato)
                    const activeClass: Record<string, string> = {
                      finalista: 'bg-purple-50 border-purple-300 text-purple-700',
                      eliminato: 'bg-red-50 border-red-300 text-red-600',
                    }
                    return (
                      <button
                        key={key}
                        onClick={() => isEnabled && aggiornaStato(r.id, key)}
                        disabled={!isEnabled}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          isSelected
                            ? activeClass[key]
                            : isEnabled
                            ? 'border-gray-200 text-gray-400 hover:bg-gray-50 cursor-pointer'
                            : 'border-gray-100 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        {formattaStato(key)}
                      </button>
                    )
                  })}

                  <span className="text-gray-300 text-xs">›</span>

                  {(() => {
                    const isSelected = r.stato === 'vincitore'
                    const isEnabled = ['valutato', 'finalista', 'eliminato', 'vincitore'].includes(r.stato)
                    return (
                      <button
                        onClick={() => isEnabled && aggiornaStato(r.id, 'vincitore')}
                        disabled={!isEnabled}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          isSelected
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : isEnabled
                            ? 'border-gray-200 text-gray-400 hover:bg-gray-50 cursor-pointer'
                            : 'border-gray-100 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        {formattaStato('vincitore')}
                      </button>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SEZIONE ASSEGNAZIONI */}
        {sezione === 'assegnazioni' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Assegna racconti ai giurati</p>
              <button onClick={carica} className="text-xs text-gray-400 hover:text-gray-600">
                ↻ Aggiorna
              </button>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                Da assegnare ({raccontinDaAssegnare.length})
              </p>
              {raccontinDaAssegnare.length === 0 ? (
                <p className="text-xs text-gray-300">Nessun racconto da assegnare</p>
              ) : (
                <div className="space-y-3">
                  {raccontinDaAssegnare.map(r => <CardAssegnazione key={r.id} r={r} />)}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100" />

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                In valutazione ({raccontiInValutazione.length})
              </p>
              {raccontiInValutazione.length === 0 ? (
                <p className="text-xs text-gray-300">Nessun racconto in valutazione</p>
              ) : (
                <div className="space-y-3">
                  {raccontiInValutazione.map(r => <CardAssegnazione key={r.id} r={r} />)}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100" />

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                Valutati / Eliminati ({raccontiValutatiEliminati.length})
              </p>
              {raccontiValutatiEliminati.length === 0 ? (
                <p className="text-xs text-gray-300">Nessun racconto in questa fase</p>
              ) : (
                <div className="space-y-3">
                  {raccontiValutatiEliminati.map(r => <CardAssegnazione key={r.id} r={r} />)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SEZIONE FINALISTI */}
        {sezione === 'finalisti' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">{raccontiFinalisti.length} racconti finalisti</p>
              <button onClick={carica} className="text-xs text-gray-400 hover:text-gray-600">
                ↻ Aggiorna
              </button>
            </div>
            {raccontiFinalisti.length === 0 ? (
              <p className="text-xs text-gray-300">Nessun racconto finalista ancora</p>
            ) : (
              raccontiFinalisti.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.titolo}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Autore: {r.autore_nome ? `${r.autore_nome} ${r.autore_cognome}` : `${r.profiles?.nome} ${r.profiles?.cognome}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Caricato il: {new Date(r.inviato_il).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-purple-50 text-purple-600 shrink-0">
                      Finalista
                    </span>
                  </div>

                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {giurati.filter(g => g.tipo_giurato === 'qualita').map(g => {
                        const assegnazione = assegnazioniEsistenti.find(
                          a => a.racconto_id === r.id && a.giurato_id === g.id
                        )
                        const assegnato = !!assegnazione
                        const haValutato = assegnazione?.completata === true
                        const cfg = tipoConfig['qualita']
                        return (
                          <button
                            key={g.id}
                            onClick={() => !haValutato && assegna(r.id, g.id, 'finale')}
                            disabled={haValutato}
                            title={haValutato ? 'Il giurato ha già valutato questo racconto' : ''}
                            className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                              assegnato
                                ? haValutato ? `${cfg.attivo} opacity-50 cursor-not-allowed` : cfg.attivo
                                : haValutato ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>
                              {cfg.label}
                            </span>
                            {assegnato ? '✓ ' : ''}{g.nome} {g.cognome}
                            {haValutato && <span className="text-[10px] opacity-60">· valutato</span>}
                          </button>
                        )
                      })}
                      {giurati.filter(g => g.tipo_giurato === 'qualita').length === 0 && (
                        <p className="text-xs text-gray-300">Nessun giurato di qualità disponibile</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-400 mr-2">Stato:</p>
                    <button
                      onClick={() => aggiornaStato(r.id, 'vincitore')}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        r.stato === 'vincitore'
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'border-gray-200 text-gray-400 hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      Vincitore
                    </button>
                    <button
                      onClick={() => aggiornaStato(r.id, 'eliminato')}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        r.stato === 'eliminato'
                          ? 'bg-red-50 border-red-300 text-red-600'
                          : 'border-gray-200 text-gray-400 hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      Eliminato
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SEZIONE RISULTATI */}
        {sezione === 'risultati' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 mb-4">Medie per racconto (ordinate per punteggio)</p>
            {medie.map((m, i) => {
              const valRacconto = valutazioni.filter(
                v => v.assegnazioni?.racconto_id === m.racconto_id
              )
              const racconto = racconti.find(r => r.id === m.racconto_id)
              const autore = racconto?.autore_nome
                ? `${racconto.autore_nome} ${racconto.autore_cognome}`
                : `${racconto?.profiles?.nome} ${racconto?.profiles?.cognome}`
              const dataCaricamento = racconto?.inviato_il
                ? new Date(racconto.inviato_il).toLocaleDateString('it-IT')
                : '—'
              return (
                <div key={m.racconto_id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-300 font-medium w-5">{i + 1}</span>
                      <p className="text-sm font-medium text-gray-800">{m.titolo}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-3 py-1 rounded-full ${statoBadge[m.stato]}`}>
                        {formattaStato(m.stato)}
                      </span>
                      {m.media_complessiva && (
                        <span className="text-lg font-semibold text-gray-800">{m.media_complessiva}</span>
                      )}
                    </div>
                  </div>

                  {valRacconto.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-3">
                        <p className="text-xs text-gray-500">Autore: {autore}</p>
                        <p className="text-xs text-gray-500">Caricato il: {dataCaricamento}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-7 gap-2 text-[10px] text-gray-400 uppercase px-2">
                          <span className="col-span-2">Giurato</span>
                          {criteri.map(c => (
                            <span key={c.key} className="text-center">{c.label}</span>
                          ))}
                        </div>
                        {valRacconto.map(v => (
                          <div key={v.id} className="grid grid-cols-7 gap-2 bg-gray-50 rounded-lg px-2 py-1.5 text-xs">
                            <span className="col-span-2 text-gray-600 truncate">
                              {v.assegnazioni?.profiles?.nome} {v.assegnazioni?.profiles?.cognome}
                            </span>
                            {criteri.map(c => (
                              <span key={c.key} className="text-center text-gray-700 font-medium">
                                {v[`criterio_${c.key}`]}
                              </span>
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
                        {criteri.map(c => (
                          <div key={c.key} className="text-center bg-gray-50 rounded-lg py-2">
                            <p className="text-[10px] text-gray-400 mb-1">{c.label}</p>
                            <p className="text-sm font-semibold text-gray-700">{m[`media_${c.key}`]}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!m.media_complessiva && (
                    <p className="text-xs text-gray-300">Nessuna valutazione ancora</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* SEZIONE GIURATI */}
        {sezione === 'giurati' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-medium text-gray-800 mb-1">Aggiungi giurato</p>
              <p className="text-xs text-gray-400 mb-4">
                Il giurato riceverà un link via email per impostare la password e accedere.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nome</label>
                  <input
                    type="text"
                    value={nuovoGiurato.nome}
                    onChange={e => setNuovoGiurato(p => ({ ...p, nome: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cognome</label>
                  <input
                    type="text"
                    value={nuovoGiurato.cognome}
                    onChange={e => setNuovoGiurato(p => ({ ...p, cognome: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={nuovoGiurato.email}
                    onChange={e => setNuovoGiurato(p => ({ ...p, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                  <select
                    value={nuovoGiurato.tipo_giurato}
                    onChange={e => setNuovoGiurato(p => ({ ...p, tipo_giurato: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    <option value="interno">Interno</option>
                    <option value="lettore">Lettore</option>
                    <option value="qualita">{"Qualità"}</option>
                  </select>
                </div>
              </div>
              {messaggioGiurato && (
                <p className={`text-sm mb-3 ${messaggioGiurato.includes('✓') ? 'text-green-600' : 'text-red-500'}`}>
                  {messaggioGiurato}
                </p>
              )}
              <button
                onClick={aggiungiGiurato}
                disabled={aggiungendo || !nuovoGiurato.email || !nuovoGiurato.nome || !nuovoGiurato.cognome}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50"
              >
                {aggiungendo ? 'Invio in corso...' : 'Invia invito'}
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">{giurati.length} giurati</p>
                <button onClick={carica} className="text-xs text-gray-400 hover:text-gray-600">
                  ↻ Aggiorna lista
                </button>
              </div>
              {giurati.map(g => {
                const cfg = tipoConfig[g.tipo_giurato] || tipoConfig['lettore']
                return (
                  <div key={g.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{g.nome} {g.cognome}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{g.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => eliminaGiurato(g.id)}
                      className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                    >
                      Elimina
                    </button>
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
