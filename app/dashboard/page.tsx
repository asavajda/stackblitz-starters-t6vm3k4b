'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://kgxhjcdssbdgolanidzh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneGhqY2Rzc2JkZ29sYW5pZHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjYxMDIsImV4cCI6MjA5MTUwMjEwMn0.oYce_FKMUq4aP3IzIP5Nz4Lquuv2Me5JPOuGrAZKjTU'
)

export default function DashboardPage() {
  const router = useRouter()
  const [racconti, setRacconti] = useState<any[]>([])
  const [giurati, setGiurati] = useState<any[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [sezione, setSezione] = useState<'racconti' | 'assegnazioni' | 'risultati' | 'giurati'>('racconti')
  const [medie, setMedie] = useState<any[]>([])
  const [nuovoGiurato, setNuovoGiurato] = useState({
    nome: '',
    cognome: '',
    email: '',
    tipo_giurato: 'lettore',
  })
  const [aggiungendo, setAggiungendo] = useState(false)
  const [messaggioGiurato, setMessaggioGiurato] = useState('')

  useEffect(() => {
    async function carica() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profilo } = await supabase
        .from('profiles')
        .select('ruolo')
        .eq('id', user.id)
        .single()

      if (profilo?.ruolo !== 'admin') { router.push('/login'); return }

      const [{ data: r }, { data: g }, { data: m }] = await Promise.all([
        supabase.from('racconti').select('*, profiles(nome, cognome)').order('inviato_il', { ascending: false }),
        supabase.from('profiles').select('*').eq('ruolo', 'giurato'),
        supabase.from('medie_racconti').select('*').order('media_complessiva', { ascending: false }),
      ])

      setRacconti(r || [])
      setGiurati(g || [])
      setMedie(m || [])
      setCaricamento(false)
    }
    carica()
  }, [])

  async function aggiornaStato(racconto_id: string, stato: string) {
    await supabase.from('racconti').update({ stato }).eq('id', racconto_id)
    setRacconti(prev => prev.map(r => r.id === racconto_id ? { ...r, stato } : r))
    setMedie(prev => prev.map(m => m.racconto_id === racconto_id ? { ...m, stato } : m))
  }

  async function assegna(racconto_id: string, giurato_id: string, fase: string) {
    await supabase.from('assegnazioni').insert({ racconto_id, giurato_id, fase })
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

    setGiurati(prev => [...prev, {
      id: data.user.id,
      ...nuovoGiurato,
    }])
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
    promosso: 'bg-yellow-50 text-yellow-600',
    finalista: 'bg-purple-50 text-purple-600',
    eliminato: 'bg-red-50 text-red-500',
    vincitore: 'bg-green-50 text-green-600',
  }

  if (caricamento) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">Dashboard admin</h1>
        <div className="flex gap-2">
          {(['racconti', 'assegnazioni', 'risultati', 'giurati'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSezione(s)}
              className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                sezione === s
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
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
                  <span className={`text-xs px-3 py-1 rounded-full shrink-0 ${statoBadge[r.stato]}`}>
                    {r.stato}
                  </span>
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {['ricevuto', 'in_valutazione', 'promosso', 'finalista', 'eliminato', 'vincitore'].map(s => (
                    <button
                      key={s}
                      onClick={() => aggiornaStato(r.id, s)}
                      disabled={r.stato === s}
                      className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SEZIONE ASSEGNAZIONI */}
        {sezione === 'assegnazioni' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">Assegna racconti ai giurati</p>
            {racconti
              .filter(r => ['ricevuto', 'in_valutazione', 'promosso', 'finalista'].includes(r.stato))
              .map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-sm font-medium text-gray-800 mb-3">{r.titolo}</p>
                  <div className="flex flex-wrap gap-2">
                    {giurati.map(g => (
                      <button
                        key={g.id}
                        onClick={() => assegna(r.id, g.id, r.stato === 'finalista' ? 'finale' : 'preliminare')}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        {g.nome} {g.cognome}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* SEZIONE RISULTATI */}
        {sezione === 'risultati' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 mb-4">Medie per racconto (ordinate per punteggio)</p>
            {medie.map((m, i) => (
              <div key={m.racconto_id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-300 font-medium w-5">{i + 1}</span>
                    <p className="text-sm font-medium text-gray-800">{m.titolo}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full ${statoBadge[m.stato]}`}>{m.stato}</span>
                    {m.media_complessiva && (
                      <span className="text-lg font-semibold text-gray-800">
                        {m.media_complessiva}
                      </span>
                    )}
                  </div>
                </div>
                {m.media_complessiva && (
                  <div className="grid grid-cols-5 gap-2 mt-2">
                    {['a', 'b', 'c', 'd', 'e'].map(k => (
                      <div key={k} className="text-center">
                        <p className="text-xs text-gray-400 uppercase">{k}</p>
                        <p className="text-sm font-medium text-gray-700">{m[`media_${k}`]}</p>
                      </div>
                    ))}
                  </div>
                )}
                {!m.media_complessiva && (
                  <p className="text-xs text-gray-300">Nessuna valutazione ancora</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SEZIONE GIURATI */}
        {sezione === 'giurati' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-medium text-gray-800 mb-1">Aggiungi giurato</p>
              <p className="text-xs text-gray-400 mb-4">
                Il giurato riceverà un magic link via email per accedere senza bisogno di password.
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
                {aggiungendo ? 'Invio in corso...' : 'Invia magic link'}
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-400">{giurati.length} giurati</p>
              {giurati.map(g => (
                <div key={g.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{g.nome} {g.cognome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{g.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                      {g.tipo_giurato || 'lettore'}
                    </span>
                    <button
                      onClick={() => eliminaGiurato(g.id)}
                      className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
