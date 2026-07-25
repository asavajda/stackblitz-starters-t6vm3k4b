'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function RaccontoPage({ params }: { params: { id: string } }) {
  const [racconto, setRacconto] = useState<any>(null)
  const [caricamento, setCaricamento] = useState(true)

  // Imposta il titolo della scheda:
  // 1. Prova dai query parameters via window.location
  // 2. Se non disponibile, legge dal database
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const titoloDaQuery = searchParams.get('titolo')
    
    if (titoloDaQuery) {
      document.title = `${decodeURIComponent(titoloDaQuery)} — Valuta`
      return
    }

    // Se non in query string, leggi dal database
    async function caricaTitolo() {
      const { data } = await supabase
        .from('racconti')
        .select('titolo')
        .eq('id', params.id)
        .single()
      if (data?.titolo) {
        document.title = `${data.titolo} — Valuta`
      }
    }
    caricaTitolo()
  }, [params.id])

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
