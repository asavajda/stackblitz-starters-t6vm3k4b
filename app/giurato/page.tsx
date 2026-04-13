'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function GiuratoPage() {
  const router = useRouter()
  const [assegnazioni, setAssegnazioni] = useState<any[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [valutazioneAperta, setValutazioneAperta] = useState<any>(null)
  const [votiEsistenti, setVotiEsistenti] = useState<any>(null)
  const [voti, setVoti] = useState({ a: 3, b: 3, c: 3, d: 3, e: 3 })
  const [note, setNote] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [utenteId, setUtenteId] = useState<string>('')
  const [mostraConferma, setMostraConferma] = useState(false)

  useEffect(() => {
    async function carica() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUtenteId(user.id)

      const { data } = await supabase
        .from('assegnazioni_giurato')
        .select('*')
        .eq('giurato_id', user.id)

      setAssegnazioni(data || [])
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
        const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(data.signedUrl)}`
        window.open(googleDocsUrl, '_blank')
      }
    }

    if (assegnazione.tipo_invio === 'testo') {
      window.open(`/racconto/${assegnazione.racconto_id}`, '_blank')
    }

    if (assegnazione.completata) {
      const { data: valEsistente } = await supabase
        .from('valutazioni')
        .select('*')
        .eq('assegnazione_id', assegnazione.assegnazione_id)
        .single()
      setVotiEsistenti(valEsistente)
    } else {
      setVotiEsistenti(null)
      setVoti({ a: 3, b: 3, c: 3, d: 3, e: 3 })
      setNote('')
    }

    setValutazioneAperta(assegnazione)
  }

  async function salvaValutazione() {
    setSalvando(true)

    const { error } = await supabase.from('valutazioni').insert({
      assegnazione_id: valutazioneAperta.assegnazione_id,
      criterio_a: voti.a,
      criterio_b: voti.b,
      criterio_c: voti.c,
      criterio_d: voti.d,
      criterio_e: voti.e,
      note,
    })

    if (error) {
      if (error.code === '23505') {
        alert('Hai già valutato questo racconto. La valutazione non è modificabile.')
      } else {
        alert(`Errore durante il salvataggio: ${error.message}`)
      }
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

    const { data: assegnazioniAggiornate } = await supabase
      .from('assegnazioni_giurato')
      .select('*')
      .eq('giurato_id', utenteId)

    setAssegnazioni(assegnazioniAggiornate || [])
    setValutazioneAperta(null)
    setSalvando(false)
  }

  const criteri = [
    { key: 'a', label: 'Incipit' },
    { key: 'b', label: 'Svolta narrativa' },
    { key: 'c', label: 'Climax' },
    { key: 'd', label: 'Scioglimento' },
    { key: 'e', label: 'Giudizio complessivo' },
  ]

  if (caricamento) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  if (valutazioneAperta) return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">

      {mostraConferma && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full shadow-lg">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Conferma invio valutazione</h3>
            <p className="text-sm text-gray-500 mb-6">
              Una volta inviata, la valutazione non potrà essere modificata. Sei sicuro di voler procedere?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMostraConferma(false)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  setMostraConferma(false)
                  salvaValutazione()
                }}
                disabled={salvando}
                className="flex-1 bg-gray-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-xl border border-gray-200 max-w-xl mx-auto">
        <button
          onClick={() => setValutazioneAperta(null)}
          className="text-sm text-gray-400 hover:text-gray-600 mb-4 block"
        >
          ← Torna alla lista
        </button>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">{valutazioneAperta.titolo}</h2>
        <p className="text-xs text-gray-400 mb-6">Fase: {valutazioneAperta.fase}</p>

        {valutazioneAperta.tipo_invio === 'testo' && (
          <p className="text-sm text-gray-500 mb-6">Il testo si è aperto in una nuova scheda.</p>
        )}

        {valutazioneAperta.tipo_invio === 'file' && (
          <p className="text-sm text-gray-500 mb-6">Il file si è aperto in una nuova scheda.</p>
        )}

        {valutazioneAperta.completata ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
              <p className="text-sm text-amber-700 font-medium">Valutazione già inviata</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Le valutazioni non sono modificabili dopo l'invio.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              {criteri.map(c => (
                <div key={c.key} className="flex items-cent
