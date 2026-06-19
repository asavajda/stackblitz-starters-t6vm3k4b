'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CRITERI = [
  { key: 'a', label: 'Incipit' },
  { key: 'b', label: 'Svolta narrativa' },
  { key: 'c', label: 'Climax' },
  { key: 'd', label: 'Scioglimento' },
]

function Header({ profilo }: { profilo: any }) {
  const router = useRouter()
  const isStaging = process.env.NEXT_PUBLIC_ENV === 'staging'
  return (
    <div className={`border-b px-6 py-3 flex items-center justify-between ${isStaging ? 'bg-[#4A90A4] border-[#3a7a8e]' : 'bg-white border-gray-200'}`}>
      <img src="/logo_tohorror_dark.png" alt="TOHorror" className="h-10" />
      <div className="flex items-center gap-3">
        {profilo?.is_admin && (
          <button onClick={() => router.push('/dashboard')}
            className={`text-sm transition-colors ${isStaging ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
            Dashboard
          </button>
        )}
        <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-semibold">
          {profilo?.nome?.[0]?.toUpperCase()}{profilo?.cognome?.[0]?.toUpperCase()}
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          className={`text-sm transition-colors ${isStaging ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
          Logout
        </button>
      </div>
    </div>
  )
}

export default function GiuratoPage() {
  const router = useRouter()
  const [assegnazioni, setAssegnazioni]           = useState<any[]>([])
  const [caricamento, setCaricamento]             = useState(true)
  const [profilo, setProfilo]                     = useState<any>(null)
  const [valutazioneAperta, setValutazioneAperta] = useState<any>(null)
  const [votiEsistenti, setVotiEsistenti]         = useState<any>(null)
  const [voti, setVoti]                           = useState({ a: 3, b: 3, c: 3, d: 3 })
  const [bonus, setBonus]                         = useState(false)
  const [note, setNote]                           = useState('')
  const [salvando, setSalvando]                   = useState(false)
  const [utenteId, setUtenteId]                   = useState('')
  const [mostraConferma, setMostraConferma]       = useState(false)
  const [blocchiAperti, setBlocchiAperti]         = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function carica() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: p } = await supabase
        .from('profiles')
        .select('nome, cognome, ruolo, is_admin, must_change_password')
        .eq('id', user.id)
        .single()

      if (p?.must_change_password) { router.push('/set-password?required=1'); return }
      if (p?.ruolo !== 'giurato' && !p?.is_admin) { router.push('/login'); return }

      setProfilo(p)
      setUtenteId(user.id)

      const { data } = await supabase
        .from('assegnazioni_giurato')
        .select('*')
        .eq('giurato_id', user.id)

      const ass = data || []
      setAssegnazioni(ass)

      // Apri di default tutti i blocchi
      const ids = ass.map((a: any) => a.blocco_id).filter(Boolean).filter((id: string, i: number, arr: string[]) => arr.indexOf(id) === i) as string[]
      const open: Record<string, boolean> = {}
      ids.forEach(id => { open[id] = true })
      setBlocchiAperti(open)

      setCaricamento(false)
    }
    carica()
  }, [])

  async function apriRacconto(assegnazione: any) {
    if (assegnazione.tipo_invio === 'file') {
      const { data } = await supabase.storage
        .from('racconti-files')
        .createSignedUrl(assegnazione.file_path, 3600)
      if (data?.signedUrl) {
        window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(data.signedUrl)}`, '_blank')
      }
    } else if (assegnazione.tipo_invio === 'testo') {
      window.open(`/racconto/${assegnazione.racconto_id}`, '_blank')
    }

    if (assegnazione.completata) {
      const { data: valEsistente } = await supabase
        .from('valutazioni').select('*')
        .eq('assegnazione_id', assegnazione.assegnazione_id).single()
      setVotiEsistenti(valEsistente)
      setBonus(valEsistente?.bonus ?? false)
    } else {
      setVotiEsistenti(null)
      setVoti({ a: 3, b: 3, c: 3, d: 3 })
      setBonus(false)
      setNote('')
    }
    setValutazioneAperta(assegnazione)
  }

  // Controlla se il bonus è già stato assegnato in questo blocco a un altro racconto
  function bonusGiaAssegnatoInBlocco(assegnazione: any) {
    if (!assegnazione.blocco_id) return false
    return assegnazioni.some(a =>
      a.blocco_id === assegnazione.blocco_id &&
      a.assegnazione_id !== assegnazione.assegnazione_id &&
      a.completata
      // nota: verificheremmo il bonus dalla valutazione, ma lo teniamo semplice per ora
    )
  }

  async function salvaValutazione() {
    setSalvando(true)

    // Se bonus è attivo, controlla se esiste già una valutazione con bonus nel blocco
    if (bonus && valutazioneAperta.blocco_id) {
      const assStessoBlocco = assegnazioni.filter(a =>
        a.blocco_id === valutazioneAperta.blocco_id &&
        a.assegnazione_id !== valutazioneAperta.assegnazione_id &&
        a.completata
      )
      if (assStessoBlocco.length > 0) {
        const { data: valBlocco } = await supabase
          .from('valutazioni')
          .select('bonus')
          .in('assegnazione_id', assStessoBlocco.map(a => a.assegnazione_id))
        const bonusGiaUsato = valBlocco?.some(v => v.bonus)
        if (bonusGiaUsato) {
          alert('Hai già assegnato il bonus a un altro racconto in questo blocco.')
          setSalvando(false)
          return
        }
      }
    }

    const { error } = await supabase.from('valutazioni').insert({
      assegnazione_id: valutazioneAperta.assegnazione_id,
      criterio_a: voti.a,
      criterio_b: voti.b,
      criterio_c: voti.c,
      criterio_d: voti.d,
      bonus,
      note,
    })

    if (error) {
      alert(error.code === '23505'
        ? 'Hai già valutato questo racconto. La valutazione non è modificabile.'
        : `Errore durante il salvataggio: ${error.message}`)
      setSalvando(false)
      return
    }

    await fetch('/api/completa-valutazione', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assegnazione_id: valutazioneAperta.assegnazione_id,
        racconto_id: valutazioneAperta.racconto_id,
      }),
    })

    const { data: aggiornate } = await supabase
      .from('assegnazioni_giurato').select('*').eq('giurato_id', utenteId)
    setAssegnazioni(aggiornate || [])
    setValutazioneAperta(null)
    setSalvando(false)
  }

  // Raggruppa assegnazioni per blocco
  const blocchi = (() => {
    const map: Record<string, any[]> = {}
    assegnazioni.forEach(a => {
      const key = a.blocco_id ?? 'senza_blocco'
      if (!map[key]) map[key] = []
      map[key].push(a)
    })
    return Object.entries(map).map(([blocco_id, ass]) => ({
      blocco_id,
      assegnazioni: ass,
      tutteCompletate: ass.every(a => a.completata),
      dataAssegnazione: ass[0]?.assegnato_il,
    }))
  })()

  if (caricamento) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  if (valutazioneAperta) return (
    <div className="min-h-screen bg-gray-50">
      <Header profilo={profilo} />

      {mostraConferma && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full shadow-lg">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Conferma invio valutazione</h3>
            <p className="text-sm text-gray-500 mb-6">
              Una volta inviata, la valutazione non potrà essere modificata. Sei sicuro di voler procedere?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setMostraConferma(false)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">
                Annulla
              </button>
              <button onClick={() => { setMostraConferma(false); salvaValutazione() }} disabled={salvando}
                className="flex-1 bg-gray-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="py-12 px-4">
        <div className="bg-white p-8 rounded-xl border border-gray-200 max-w-xl mx-auto">
          <button onClick={() => setValutazioneAperta(null)}
            className="text-sm text-gray-400 hover:text-gray-600 mb-4 block">
            ← Torna alla lista
          </button>
          <h2 className="text-xl font-semibold text-gray-800 mb-1">{valutazioneAperta.titolo}</h2>
          <p className="text-xs text-gray-400 mb-6">Fase: {valutazioneAperta.fase}</p>
          <p className="text-sm text-gray-500 mb-6">
            {valutazioneAperta.tipo_invio === 'testo' ? 'Il testo si è aperto in una nuova scheda.' : 'Il file si è aperto in una nuova scheda.'}
          </p>

          <div className="space-y-4 mb-6">
            {CRITERI.map(c => (
              <div key={c.key} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 w-40">{c.label}</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => {
                    const attivo = valutazioneAperta.completata
                      ? votiEsistenti?.[`criterio_${c.key}`] === n
                      : voti[c.key as keyof typeof voti] === n
                    return valutazioneAperta.completata ? (
                      <div key={n} className={`w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center ${attivo ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-300'}`}>
                        {n}
                      </div>
                    ) : (
                      <button key={n} onClick={() => setVoti(prev => ({ ...prev, [c.key]: n }))}
                        className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${attivo ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Bonus +1 */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                <span className="text-sm text-gray-600">Bonus +1</span>
                <p className="text-[10px] text-gray-400 mt-0.5">Puoi assegnarlo a un solo racconto per blocco</p>
              </div>
              {valutazioneAperta.completata ? (
                <div className={`w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center ${votiEsistenti?.bonus ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-300'}`}>
                  {votiEsistenti?.bonus ? '★' : '—'}
                </div>
              ) : (
                <button
                  onClick={() => setBonus(prev => !prev)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${bonus ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {bonus ? '★ Assegnato' : '☆ Assegna bonus'}
                </button>
              )}
            </div>
          </div>

          {valutazioneAperta.completata ? (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
                <p className="text-sm text-amber-700 font-medium">Valutazione già inviata</p>
                <p className="text-xs text-amber-600 mt-0.5">Le valutazioni non sono modificabili dopo l'invio.</p>
              </div>
              {votiEsistenti?.note && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Note</p>
                  <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50">
                    {votiEsistenti.note}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-6">
                <label className="block text-sm text-gray-600 mb-1">Note (opzionale)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs text-gray-500">⚠️ Attenzione: una volta inviata, la valutazione non potrà essere modificata.</p>
              </div>
              <button onClick={() => setMostraConferma(true)} disabled={salvando}
                className="w-full bg-gray-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                {salvando ? 'Salvataggio...' : 'Salva valutazione'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Header profilo={profilo} />
      <div className="py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-800 mb-6">I tuoi racconti</h1>
          {assegnazioni.length === 0
            ? <p className="text-gray-400 text-sm">Nessun racconto assegnato al momento.</p>
            : (
              <div className="space-y-4">
                {blocchi.map((blocco, i) => {
                  const isAperto = blocchiAperti[blocco.blocco_id] ?? true
                  const nCompletate = blocco.assegnazioni.filter(a => a.completata).length
                  const nTotali = blocco.assegnazioni.length
                  return (
                    <div key={blocco.blocco_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setBlocchiAperti(prev => ({ ...prev, [blocco.blocco_id]: !prev[blocco.blocco_id] }))}
                        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700">
                            Blocco {i + 1}
                          </span>
                          <span className="text-xs text-gray-400">
                            {nTotali} {nTotali === 1 ? 'racconto' : 'racconti'}
                          </span>
                          {nCompletate === nTotali && nTotali > 0 && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Completato</span>
                          )}
                          {nCompletate > 0 && nCompletate < nTotali && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{nCompletate}/{nTotali} valutati</span>
                          )}
                        </div>
                        <span className="text-gray-400 text-xs">{isAperto ? '▲' : '▼'}</span>
                      </button>

                      {isAperto && (
                        <div className="border-t border-gray-100 divide-y divide-gray-100">
                          {blocco.assegnazioni.map(a => (
                            <div key={a.assegnazione_id} className="flex items-center justify-between px-5 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-800">{a.titolo}</p>
                                <p className="text-xs text-gray-400 mt-0.5">Fase: {a.fase}</p>
                              </div>
                              <button onClick={() => apriRacconto(a)}
                                className={`text-sm px-4 py-1.5 rounded-lg ${a.completata ? 'border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                                {a.completata ? 'Vedi valutazione' : 'Valuta'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}
