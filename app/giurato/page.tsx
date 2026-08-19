'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const CRITERI = [
  { key: 'a', label: 'Incipit' },
  { key: 'b', label: 'Svolta narrativa' },
  { key: 'c', label: 'Climax' },
  { key: 'd', label: 'Scioglimento' },
]

// Rimuove l'articolo iniziale italiano (con o senza apostrofo) per un ordinamento
// alfabetico "da catalogo", es. "Il Cerchio" si ordina come "Cerchio"
function titoloPerOrdinamento(titolo: string): string {
  return (titolo || '')
    .trim()
    .replace(/^(l['’]|gl['’]|un['’]|il|lo|la|gli|le|uno|una|un)\s+/i, '')
    .replace(/^(l['’]|gl['’]|un['’])/i, '')
    .trim()
}

function dataAssegnazione(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Header({ profilo }: { profilo: any }) {
  const router = useRouter()
  const isStaging = process.env.NEXT_PUBLIC_ENV === 'staging'
  return (
    <div className={`border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-2 ${isStaging ? 'bg-[#4A90A4] border-[#3a7a8e]' : 'bg-white border-gray-200'}`}>
      <img src="/logo_tohorror_dark.png" alt="TOHorror" className="h-8 sm:h-10 shrink-0" />
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {profilo?.is_admin && (
          <button onClick={() => router.push('/dashboard')}
            className={`text-sm transition-colors ${isStaging ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
            Dashboard
          </button>
        )}
        <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-semibold">
          {profilo?.nome?.[0]?.toUpperCase()}{profilo?.cognome?.[0]?.toUpperCase()}
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
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
  const [bonusSelezionato, setBonusSelezionato]   = useState<Record<string, string | null>>({}) // blocco_id -> assegnazione_id con bonus
  const [blocchiCompletati, setBlocchiCompletati] = useState<Record<string, boolean>>({}) // blocco_id -> completato
  const [caricamento, setCaricamento]             = useState(true)
  const [profilo, setProfilo]                     = useState<any>(null)
  const [valutazioneAperta, setValutazioneAperta] = useState<any>(null)
  const [valutazioneId, setValutazioneId]         = useState<string | null>(null) // id della riga valutazioni, se già esiste
  const [voti, setVoti]                           = useState({ a: 3, b: 3, c: 3, d: 3 })
  const [salvando, setSalvando]                   = useState(false)
  const [utenteId, setUtenteId]                   = useState('')
  const [blocchiAperti, setBlocchiAperti]         = useState<Record<string, boolean>>({})
  const [completandoBlocco, setCompletandoBlocco] = useState<string | null>(null)
  const [mostraConfermaCompletaBlocco, setMostraConfermaCompletaBlocco] = useState<string | null>(null)
  const [salvandoBonus, setSalvandoBonus]         = useState(false)
  const [bonusPendenteAperta, setBonusPendenteAperta] = useState(false) // bonus scelto nel form prima del primo salvataggio, non ancora su DB

  async function caricaDati(userId: string) {
    const { data } = await supabase
      .from('assegnazioni_giurato')
      .select('*')
      .eq('giurato_id', userId)

    const ass = data || []
    setAssegnazioni(ass)

    // Carica bonus esistenti dalle valutazioni
    const assIds = ass.map((a: any) => a.assegnazione_id)
    const { data: valData } = assIds.length > 0
      ? await supabase.from('valutazioni').select('assegnazione_id, bonus').in('assegnazione_id', assIds)
      : { data: [] }

    // Per ogni blocco, trova quale assegnazione ha il bonus
    const bMap: Record<string, string | null> = {}
    ass.forEach((a: any) => {
      if (!a.blocco_id) return
      if (!bMap[a.blocco_id]) bMap[a.blocco_id] = null
      const val = (valData || []).find((v: any) => v.assegnazione_id === a.assegnazione_id)
      if (val?.bonus) bMap[a.blocco_id] = a.assegnazione_id
    })
    setBonusSelezionato(bMap)

    // Carica stato completamento blocchi
    const bloccoIds = ass.map((a: any) => a.blocco_id).filter(Boolean).filter((id: string, i: number, arr: string[]) => arr.indexOf(id) === i) as string[]
    const { data: bgData } = bloccoIds.length > 0
      ? await supabase.from('blocchi_giurato').select('blocco_id, completato').eq('giurato_id', userId).in('blocco_id', bloccoIds)
      : { data: [] }
    const cMap: Record<string, boolean> = {}
    ;(bgData || []).forEach((bg: any) => { cMap[bg.blocco_id] = bg.completato })
    setBlocchiCompletati(cMap)

    // Aperti di default, tranne quelli già completati
    const open: Record<string, boolean> = {}
    bloccoIds.forEach(id => { open[id] = !cMap[id] })
    setBlocchiAperti(open)
  }

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
      await caricaDati(user.id)
      setCaricamento(false)
    }
    carica()
  }, [])

  async function controllaOrtografia(assegnazione: any) {
    const titolo = encodeURIComponent(assegnazione.titolo || 'Racconto')
    if (assegnazione.tipo_invio === 'file') {
      const filePath = encodeURIComponent(assegnazione.file_path)
      window.open(`/racconto/${assegnazione.racconto_id}/controllo-ortografico?file_path=${filePath}&titolo=${titolo}`, '_blank')
    } else if (assegnazione.tipo_invio === 'testo') {
      window.open(`/racconto/${assegnazione.racconto_id}/controllo-ortografico?titolo=${titolo}`, '_blank')
    }
  }

  function isMobileDevice() {
    if (typeof navigator === 'undefined') return false
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  }

  async function apriRacconto(assegnazione: any) {
    const titolo = encodeURIComponent(assegnazione.titolo || 'Racconto')

    if (assegnazione.tipo_invio === 'file') {
      if (isMobileDevice()) {
        // Su mobile il PDF va aperto col visualizzatore nativo del browser:
        // dentro l'iframe di /visualizza iOS Safari lo rende male (scroll
        // rotto / pagina singola). Per avere anche titolo e favicon corretti
        // nella scheda, il file passa dalla nostra route /api/racconto-file,
        // costruita come .../<signed url in base64url>/<Titolo>.pdf
        // Il nome e' l'ultimo segmento e non c'e' query string, perche' Safari
        // per i PDF inline ignora Content-Disposition e sembra ricadere
        // sull'hostname se l'URL non termina con un nome file pulito.
        // Apriamo la scheda vuota in modo sincrono rispetto al click, cosi' il
        // popup non viene bloccato, e le assegniamo l'URL dopo il signed URL.
        const finestra = window.open('', '_blank')
        const { data } = await supabase.storage
          .from('racconti-files')
          .createSignedUrl(assegnazione.file_path, 3600)
        if (data?.signedUrl) {
          const estensione = assegnazione.file_path?.split('.').pop()?.toLowerCase()
          // I caratteri non validi in un nome file vengono togliti prima della
          // codifica, cosi' il percorso resta un singolo segmento pulito.
          const nomeFile = encodeURIComponent(
            `${(assegnazione.titolo || 'Racconto').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim()}.pdf`
          )
          const srcCodificato = btoa(data.signedUrl)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
          const url = estensione === 'pdf'
            ? `/api/racconto-file/${srcCodificato}/${nomeFile}`
            : `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(data.signedUrl)}`
          if (finestra) finestra.location.href = url
          else window.open(url, '_blank') // fallback nel caso la scheda iniziale non si sia aperta
        } else if (finestra) {
          finestra.close()
        }
      } else {
        const filePath = encodeURIComponent(assegnazione.file_path)
        window.open(`/racconto/${assegnazione.racconto_id}/visualizza?file_path=${filePath}&titolo=${titolo}`, '_blank')
      }
    } else if (assegnazione.tipo_invio === 'testo') {
      window.open(`/racconto/${assegnazione.racconto_id}?titolo=${titolo}`, '_blank')
    }

    // La valutazione resta modificabile finche' il giurato non completa il blocco:
    // se esiste gia' una riga in valutazioni, il form si apre precompilato coi voti
    // salvati. Cerchiamo sempre la riga (non solo se assegnazione.completata) per
    // robustezza, anche se in condizioni normali le due cose coincidono.
    const { data: valEsistente } = await supabase
      .from('valutazioni').select('*')
      .eq('assegnazione_id', assegnazione.assegnazione_id).maybeSingle()

    setValutazioneId(valEsistente?.id ?? null)
    setVoti({
      a: valEsistente?.criterio_a ?? 3,
      b: valEsistente?.criterio_b ?? 3,
      c: valEsistente?.criterio_c ?? 3,
      d: valEsistente?.criterio_d ?? 3,
    })
    setBonusPendenteAperta(false) // reset: il bonus provvisorio non deve sopravvivere tra un racconto e l'altro
    setValutazioneAperta(assegnazione)
  }

  async function salvaValutazione() {
    setSalvando(true)

    // Update se la riga esiste gia' (modifica consentita a blocco aperto), insert
    // la prima volta. Non usiamo upsert per non dipendere da un vincolo UNIQUE su
    // assegnazione_id, che non e' garantito identico su staging e produzione.
    const eraNuova = !valutazioneId
    const criteri = {
      criterio_a: voti.a,
      criterio_b: voti.b,
      criterio_c: voti.c,
      criterio_d: voti.d,
    }

    const { data, error } = valutazioneId
      ? await supabase.from('valutazioni').update(criteri).eq('id', valutazioneId).select()
      : await supabase.from('valutazioni').insert({
          assegnazione_id: valutazioneAperta.assegnazione_id,
          ...criteri,
          bonus: false, // il bonus, se scelto nel form prima di questo salvataggio, viene applicato subito dopo con toggleBonus
        }).select()

    if (error) {
      alert(`Errore durante il salvataggio: ${error.message}`)
      setSalvando(false)
      return
    }

    // Con RLS un update bloccato non genera errore: restituisce zero righe.
    // Senza questo controllo la modifica sembrerebbe riuscita.
    if ((data?.length ?? 0) === 0) {
      console.error('[SalvaValutazione] 0 righe scritte. Probabile blocco da policy RLS.')
      alert('La valutazione non è stata salvata. Se hai già completato il blocco non è più modificabile.')
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

    // Il bonus scelto nel form prima di questo salvataggio (mai scritto su DB fino
    // ad ora, per non salvare punteggi non ancora reali) viene applicato solo qui,
    // sulla riga appena creata. Se il racconto era gia' valutato in precedenza, il
    // bonus era gia' gestito direttamente da toggleBonus e non passa da qui.
    if (eraNuova && bonusPendenteAperta) {
      await toggleBonus(valutazioneAperta.blocco_id, valutazioneAperta.assegnazione_id)
    }

    await caricaDati(utenteId)
    setValutazioneAperta(null)
    setSalvando(false)
  }

  async function toggleBonus(blocco_id: string, assegnazione_id: string) {
    const corrente = bonusSelezionato[blocco_id]
    const nuovoBonus = corrente === assegnazione_id ? null : assegnazione_id

    // Aggiorna subito lo stato locale per reattività dell'interfaccia
    setBonusSelezionato(prev => ({ ...prev, [blocco_id]: nuovoBonus }))
    setSalvandoBonus(true)

    // Persisti immediatamente su DB con due query rapide invece di N sequenziali,
    // per minimizzare la finestra in cui un ricaricamento dati potrebbe leggere uno stato intermedio
    const assDelBlocco = assegnazioni.filter(a => a.blocco_id === blocco_id && a.completata)
    const altriIds = assDelBlocco.map(a => a.assegnazione_id).filter(id => id !== nuovoBonus)

    const [risultatoNuovo, risultatoAltri] = await Promise.all([
      nuovoBonus
        ? supabase.from('valutazioni').update({ bonus: true }).eq('assegnazione_id', nuovoBonus).select()
        : Promise.resolve(null),
      altriIds.length > 0
        ? supabase.from('valutazioni').update({ bonus: false }).in('assegnazione_id', altriIds).select()
        : Promise.resolve(null),
    ])

    // Verifico esplicitamente errori ED effettivo numero di righe modificate:
    // Supabase con RLS può bloccare un update senza generare un errore,
    // restituendo semplicemente zero righe aggiornate
    if (risultatoNuovo?.error) {
      console.error('[Bonus] Errore aggiornando il racconto con bonus:', risultatoNuovo.error)
    } else if (nuovoBonus && (risultatoNuovo?.data?.length ?? 0) === 0) {
      console.error('[Bonus] ATTENZIONE: 0 righe aggiornate per il bonus (assegnazione_id:', nuovoBonus, '). Probabile blocco da policy RLS.')
    }
    if (risultatoAltri?.error) {
      console.error('[Bonus] Errore rimuovendo il bonus dagli altri racconti:', risultatoAltri.error)
    } else if (altriIds.length > 0 && (risultatoAltri?.data?.length ?? 0) === 0) {
      console.error('[Bonus] ATTENZIONE: 0 righe aggiornate rimuovendo il bonus dagli altri racconti. Probabile blocco da policy RLS.')
    }

    setSalvandoBonus(false)
  }

  async function completaBlocco(blocco_id: string) {
    setCompletandoBlocco(blocco_id)

    // Aggiorna bonus nelle valutazioni del blocco
    const assDelBlocco = assegnazioni.filter(a => a.blocco_id === blocco_id)
    const bonusAssId = bonusSelezionato[blocco_id]

    for (const a of assDelBlocco) {
      if (a.completata) {
        const { error: bonusError } = await supabase.from('valutazioni')
          .update({ bonus: a.assegnazione_id === bonusAssId })
          .eq('assegnazione_id', a.assegnazione_id)
        if (bonusError) console.error('[CompletaBlocco] Errore aggiornando bonus:', bonusError)
      }
    }

    // Salva completamento blocco per questo giurato
    const { data: bgData, error: bgError } = await supabase.from('blocchi_giurato').upsert({
      blocco_id,
      giurato_id: utenteId,
      completato: true,
      completato_il: new Date().toISOString(),
    }, { onConflict: 'blocco_id,giurato_id' }).select()

    if (bgError) {
      console.error('[CompletaBlocco] Errore salvando il completamento del blocco:', bgError)
    } else if (!bgData || bgData.length === 0) {
      console.error('[CompletaBlocco] ATTENZIONE: 0 righe salvate per il completamento del blocco. Probabile blocco da policy RLS.')
    } else {
      console.log('[CompletaBlocco] Completamento salvato correttamente:', bgData)
    }

    // La conferma del blocco e' il momento in cui il punteggio diventa definitivo:
    // avvisiamo il server perche' ricalcoli lo stato dei racconti coinvolti.
    try {
      await fetch('/api/completa-blocco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocco_id }),
      })
    } catch (e) {
      console.error('[CompletaBlocco] Errore aggiornando lo stato dei racconti:', e)
    }

    setBlocchiCompletati(prev => ({ ...prev, [blocco_id]: true }))
    setBlocchiAperti(prev => ({ ...prev, [blocco_id]: false }))
    setCompletandoBlocco(null)
    setMostraConfermaCompletaBlocco(null)
  }

  // Raggruppa assegnazioni per blocco
  const blocchi = (() => {
    const map: Record<string, any[]> = {}
    assegnazioni.forEach(a => {
      const key = a.blocco_id ?? 'senza_blocco'
      if (!map[key]) map[key] = []
      map[key].push(a)
    })
    return Object.entries(map)
      .map(([blocco_id, ass]) => ({
        blocco_id,
        // Ordine stabile per titolo: Postgres non garantisce l'ordine delle righe
        // senza ORDER BY, e una riga aggiornata (es. completata=true) puo
        // "spostarsi" nella scansione — qui fissiamo l'ordine cosi non cambia mai
        assegnazioni: [...ass].sort((a, b) => titoloPerOrdinamento(a.titolo).localeCompare(titoloPerOrdinamento(b.titolo))),
        nCompletate: ass.filter(a => a.completata).length,
        nTotali: ass.length,
        tutteCompletate: ass.every(a => a.completata),
        bloccoCompletato: blocchiCompletati[blocco_id] ?? false,
        creatoIl: ass[0]?.blocco_creato_il ?? null,
        // Numero progressivo assegnato dal DB alla creazione del blocco: e' stabile
        // e identico per tutti i giurati e per il dashboard. Non usiamo l'indice
        // nella lista, che cambia ogni volta che un blocco viene completato.
        numero: ass[0]?.blocco_numero ?? null,
      }))
      .sort((x, y) => {
        // Non completati prima, completati dopo
        if (x.bloccoCompletato !== y.bloccoCompletato) {
          return x.bloccoCompletato ? 1 : -1
        }
        // A parità di stato, più recenti in alto
        const dx = x.creatoIl ? new Date(x.creatoIl).getTime() : 0
        const dy = y.creatoIl ? new Date(y.creatoIl).getTime() : 0
        return dy - dx
      })
  })()

  // Una valutazione e' immodificabile solo se il giurato ha completato il blocco
  // a cui appartiene: fino a quel momento criteri e bonus restano riscrivibili.
  const soloLettura = valutazioneAperta
    ? (blocchiCompletati[valutazioneAperta.blocco_id] ?? false)
    : false

  if (caricamento) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  if (valutazioneAperta) return (
    <div className="min-h-screen bg-gray-50">
      <Header profilo={profilo} />

      <div className="py-12 px-4">
        <div className="bg-white p-5 sm:p-8 rounded-xl border border-gray-200 max-w-xl mx-auto">
          <button onClick={() => setValutazioneAperta(null)}
            className="text-sm text-gray-400 hover:text-gray-600 mb-4 block">
            ← Torna alla lista
          </button>
          <h2 className="text-xl font-semibold text-gray-800 mb-1">{valutazioneAperta.titolo}</h2>
          <p className="text-xs text-gray-400 mb-6">Fase: {valutazioneAperta.fase}</p>
          <p className="text-sm text-gray-500 mb-3">
            {valutazioneAperta.tipo_invio === 'testo' ? 'Il testo si è aperto in una nuova scheda.' : 'Il file si è aperto in una nuova scheda.'}
          </p>
          <button onClick={() => controllaOrtografia(valutazioneAperta)}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 mb-6">
            ✓ Controlla ortografia
          </button>

          <div className="space-y-4 mb-6">
            {CRITERI.map(c => (
              <div key={c.key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-gray-600 sm:w-40">{c.label}</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => {
                    const attivo = voti[c.key as keyof typeof voti] === n
                    return soloLettura ? (
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
          </div>

          {soloLettura ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6">
              <p className="text-sm text-green-700 font-medium">Blocco completato</p>
              <p className="text-xs text-green-600 mt-0.5">La valutazione non è più modificabile.</p>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs text-gray-500">
                  Potrai modificare questa valutazione e il bonus ★ fino a quando non completi il blocco.
                </p>
              </div>

              {/* Toggle bonus — disponibile fin dalla primissima apertura del racconto.
                  Se la valutazione esiste gia' su DB (valutazioneId), il click persiste
                  subito come nella lista blocchi. Se non esiste ancora, il click resta
                  solo una selezione locale: niente viene scritto finche' non si preme
                  "Salva valutazione", per non salvare voti non ancora reali insieme al
                  bonus. Se si chiude il form senza salvare, la selezione locale si perde. */}
              {(() => {
                const haBonusReale = bonusSelezionato[valutazioneAperta.blocco_id] === valutazioneAperta.assegnazione_id
                const haBonusForm = valutazioneId ? haBonusReale : bonusPendenteAperta
                const onClickBonus = valutazioneId
                  ? () => toggleBonus(valutazioneAperta.blocco_id, valutazioneAperta.assegnazione_id)
                  : () => setBonusPendenteAperta(prev => !prev)
                return (
                  <button
                    onClick={onClickBonus}
                    disabled={salvandoBonus}
                    className={`w-full flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium mb-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${haBonusForm ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-500'}`}>
                    ★ {haBonusForm
                      ? (valutazioneId ? 'Bonus assegnato — rimuovi' : 'Bonus selezionato — verrà salvato con la valutazione')
                      : 'Assegna bonus +1'}
                  </button>
                )
              })()}

              <button onClick={salvaValutazione} disabled={salvando}
                className="w-full bg-gray-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                {salvando
                  ? 'Salvataggio...'
                  : valutazioneAperta.completata ? 'Aggiorna valutazione' : 'Salva valutazione'}
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

      {/* Modal conferma completa blocco */}
      {mostraConfermaCompletaBlocco && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full shadow-lg">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Completa blocco</h3>
            <p className="text-sm text-gray-500 mb-2">
              Stai per completare il blocco.
            </p>
            {bonusSelezionato[mostraConfermaCompletaBlocco] ? (
              <p className="text-sm text-amber-600 mb-4">
                ★ Il bonus verrà assegnato a: <span className="font-medium">
                  {assegnazioni.find(a => a.assegnazione_id === bonusSelezionato[mostraConfermaCompletaBlocco])?.titolo}
                </span>
              </p>
            ) : (
              <p className="text-sm text-gray-400 mb-4">Nessun bonus assegnato in questo blocco.</p>
            )}
            <p className="text-xs text-gray-400 mb-6">
              Una volta completato il blocco, né le valutazioni né il bonus potranno più essere modificati.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setMostraConfermaCompletaBlocco(null)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">
                Annulla
              </button>
              <button
                onClick={() => completaBlocco(mostraConfermaCompletaBlocco)}
                disabled={completandoBlocco === mostraConfermaCompletaBlocco}
                className="flex-1 bg-gray-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                {completandoBlocco === mostraConfermaCompletaBlocco ? 'Salvataggio...' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-800 mb-6">I tuoi racconti</h1>
          {assegnazioni.length === 0
            ? <p className="text-gray-400 text-sm">Nessun racconto assegnato al momento.</p>
            : (
              <div className="space-y-4">
                {blocchi.map((blocco, i) => {
                  const isAperto = blocchiAperti[blocco.blocco_id] ?? true
                  const { nCompletate, nTotali, tutteCompletate, bloccoCompletato } = blocco
                  const bonusId = bonusSelezionato[blocco.blocco_id]
                  const coloreStato = bloccoCompletato
                    ? 'border-l-green-400'
                    : tutteCompletate
                      ? 'border-l-amber-400'
                      : 'border-l-blue-400'

                  return (
                    <div key={blocco.blocco_id} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${coloreStato} overflow-hidden shadow-sm`}>
                      <button
                        onClick={() => setBlocchiAperti(prev => ({ ...prev, [blocco.blocco_id]: !prev[blocco.blocco_id] }))}
                        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-base font-bold text-gray-900">Blocco {blocco.numero ?? i + 1}</span>
                          <span className="text-xs text-gray-500 font-medium">{nTotali} {nTotali === 1 ? 'racconto' : 'racconti'}</span>
                          {blocco.creatoIl && (
                            <span className="text-xs text-gray-400">Assegnato il {dataAssegnazione(blocco.creatoIl)}</span>
                          )}
                          {bloccoCompletato && (
                            <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">✓ Completato</span>
                          )}
                          {!bloccoCompletato && nCompletate > 0 && nCompletate < nTotali && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">{nCompletate}/{nTotali} valutati</span>
                          )}
                          {!bloccoCompletato && tutteCompletate && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">Pronto per il completamento</span>
                          )}
                        </div>
                        <span className="text-gray-500 text-sm font-bold">{isAperto ? '▲' : '▼'}</span>
                      </button>

                      {isAperto && (
                        <div className="border-t border-gray-100">
                          <div className="divide-y divide-gray-100">
                            {blocco.assegnazioni.map(a => {
                              const haBonus = bonusId === a.assegnazione_id
                              return (
                              <div key={a.assegnazione_id}
                                className={`flex items-center justify-between px-5 py-3 transition-colors ${haBonus ? 'bg-amber-50 border-l-4 border-amber-400 pl-4' : ''}`}>
                                <div className="flex-1 min-w-0 mr-3">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-800 truncate">{a.titolo}</p>
                                    {haBonus && (
                                      <span className="shrink-0 text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                        ★ Bonus
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-0.5">Fase: {a.fase}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Toggle bonus — visibile solo se valutato e blocco non completato */}
                                  {a.completata && !bloccoCompletato && (
                                    <button
                                      onClick={() => toggleBonus(blocco.blocco_id, a.assegnazione_id)}
                                      disabled={salvandoBonus}
                                      title={haBonus ? 'Rimuovi bonus' : 'Assegna bonus +1'}
                                      className={`text-sm px-2 py-1 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${haBonus ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-500'}`}>
                                      ★
                                    </button>
                                  )}
                                  <button onClick={() => apriRacconto(a)} disabled={salvandoBonus}
                                    className={`text-sm px-4 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${a.completata ? 'border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                                    {!a.completata ? 'Valuta' : bloccoCompletato ? 'Vedi' : 'Modifica'}
                                  </button>
                                </div>
                              </div>
                              )
                            })}
                          </div>

                          {/* Bottone completa blocco */}
                          {tutteCompletate && !bloccoCompletato && (
                            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                              <p className="text-xs text-gray-500 mb-3">
                                Hai valutato tutti i racconti del blocco: puoi ancora modificare le valutazioni finché non lo completi.
                                {bonusId
                                  ? <> Il bonus ★ è assegnato a <span className="font-medium text-amber-600">{assegnazioni.find(a => a.assegnazione_id === bonusId)?.titolo}</span>.</>
                                  : <> Nessun bonus assegnato.</>
                                }
                              </p>
                              <button
                                onClick={() => setMostraConfermaCompletaBlocco(blocco.blocco_id)}
                                className="text-sm bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 font-medium">
                                Completa blocco
                              </button>
                            </div>
                          )}
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
