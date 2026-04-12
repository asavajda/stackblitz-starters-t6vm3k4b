'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function RaccontoPage({ params }: { params: { id: string } }) {
  const [racconto, setRacconto] = useState<any>(null)
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    async function carica() {
      const { data } = await supabase
        .from('racconti')
        .select('titolo, testo, autore_nome, autore_cognome')
        .eq('id', params.id)
        .single()
      setRacconto(data)
      setCaricamento(false)
    }
    carica()
  }, [params.id])

  if (caricamento) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  if (!racconto) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Racconto non trovato.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-8">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">{racconto.titolo}</h1>
        {racconto.autore_nome && (
          <p className="text-sm text-gray-400 mb-8">
            {racconto.autore_nome} {racconto.autore_cognome}
          </p>
        )}
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {racconto.testo}
        </div>
      </div>
    </div>
  )
}
