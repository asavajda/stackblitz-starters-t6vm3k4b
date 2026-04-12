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
  const [voti, setVoti] = useState({ a: 3, b: 3, c: 3, d: 3, e: 3 })
  const [note, setNote] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carica() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

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
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    }
    setValutazioneAperta(assegnazione)
    setVoti({ a: 3, b: 3, c: 3, d: 3, e: 3 })
    setNote('')
  }

  async function salvaValutazione() {
    setSalvando(true)
    console.log('valutazioneAperta:', valutazioneAperta)
  console.log('racconto_id:', valutazioneAperta.racconto_id)
    const { error } = await supabase.from('valutazioni').insert({
      assegnazione_id: valutazioneAperta.assegnazione_id,
      criterio_a: voti.a,
      criterio_b: voti.b,
      criterio_c: voti.c,
      criterio_d: voti.d,
      criterio_e: voti.e,
      note,
    })

    if (!error) {
      await supabase
        .from('assegnazioni')
        .update({ completata: true })
        .eq('id', valutazioneAperta.assegnazione_id)

     const { data: tutteAssegnazioni, error: errAssegnazioni } = await supabase
  .from('assegnazioni')
  .select('completata')
  .eq('racconto_id', valutazioneAperta.racconto_id)

console.log('tutteAssegnazioni:', tutteAssegnazioni)
console.log('errAssegnazioni:', errAssegnazioni)
console.log('tutteCompletate:', tutteAssegnazioni?.every(a => a.completata === true))

      const tutteCompletate =
        tutteAssegnazioni &&
        tutteAssegnazioni.length >= 2 &&
        tutteAssegnazioni.every(a => a.completata === true)

      if (tutteCompletate) {
        await supabase
          .from('racconti')
          .update({ stato: 'valutato' })
          .eq('id', valutazioneAperta.racconto_id)
      }

      setAssegnazioni(prev => prev.map(a =>
        a.assegnazione_id === valutazioneAperta.assegnazione_id
          ? { ...a, completata: true }
          : a
      ))
      setValutazioneAperta(null)
    }
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
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-700 leading-relaxed max-h-64 overflow-y-auto">
            {valutazioneAperta.testo}
          </div>
        )}

        {valutazioneAperta.tipo_invio === 'file' && (
          <p className="text-sm text-gray-500 mb-6">Il file si è aperto in una nuova scheda.</p>
        )}

        <div className="space-y-4 mb-6">
          {criteri.map(c => (
            <div key={c.key} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 w-40">{c.label}</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setVoti(prev => ({ ...prev, [c.key]: n }))}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                      voti[c.key as keyof typeof voti] === n
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-600 mb-1">Note (opzionale)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
          />
        </div>

        <button
          onClick={salvaValutazione}
          disabled={salvando}
          className="w-full bg-gray-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {salvando ? 'Salvataggio...' : 'Salva valutazione'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-800 mb-6">I tuoi racconti</h1>
        {assegnazioni.length === 0 ? (
          <p className="text-gray-400 text-sm">Nessun racconto assegnato al momento.</p>
        ) : (
          <div className="space-y-3">
            {assegnazioni.map(a => (
              <div
                key={a.assegnazione_id}
                className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.titolo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Fase: {a.fase}</p>
                </div>
                {a.completata ? (
                  <span className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    Valutato
                  </span>
                ) : (
                  <button
                    onClick={() => apriRacconto(a)}
                    className="text-sm bg-gray-800 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700"
                  >
                    Valuta
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
