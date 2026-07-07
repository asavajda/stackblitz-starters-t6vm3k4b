'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SpellCheckedText } from '@/components/SpellCheckedText'

export default function RaccontoPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()
  const filePath = searchParams.get('file_path')
  const [racconto, setRacconto] = useState<any>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    async function carica() {
      try {
        // Se c'è un file_path, estrai il testo dal DOCX
        if (filePath) {
          console.log('[Racconto] Caricamento file:', filePath)
          
          // Ottieni l'URL firmato del file
          const { data: signedUrl } = await supabase.storage
            .from('racconti-files')
            .createSignedUrl(filePath, 3600)
          
          if (!signedUrl?.signedUrl) {
            throw new Error('Impossibile ottenere l\'URL del file')
          }

          // Scarica il file
          const response = await fetch(signedUrl.signedUrl)
          if (!response.ok) {
            throw new Error('Errore nel download del file')
          }

          const arrayBuffer = await response.arrayBuffer()
          
          // Estrai il testo dal DOCX usando mammoth
          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ arrayBuffer })
          
          // Estrai titolo e autore dal nome del file o dai metadati
          const fileName = filePath.split('/').pop() || 'Racconto'
          
          setRacconto({
            titolo: fileName.replace(/\.[^.]+$/, ''), // Rimuove l'estensione
            testo: result.value,
            autore_nome: '',
            autore_cognome: '',
            da_file: true
          })
          console.log('[Racconto] Testo estratto:', result.value.length, 'caratteri')
        } else {
          // Altrimenti carica da Supabase come prima
          const { data } = await supabase
            .from('racconti')
            .select('titolo, testo, autore_nome, autore_cognome')
            .eq('id', params.id)
            .single()
          
          if (!data) {
            throw new Error('Racconto non trovato')
          }
          
          setRacconto(data)
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Errore sconosciuto'
        console.error('[Racconto] Errore:', msg)
        setErrore(msg)
      } finally {
        setCaricamento(false)
      }
    }
    
    carica()
  }, [params.id, filePath])

  if (caricamento) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  if (errore) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
        <p className="text-red-700 text-sm font-medium">Errore</p>
        <p className="text-red-600 text-sm mt-2">{errore}</p>
      </div>
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
        {racconto.da_file && (
          <p className="text-xs text-blue-600 mb-4 bg-blue-50 p-2 rounded border border-blue-200">
            ✓ Testo estratto dal file DOCX con controllo ortografico
          </p>
        )}
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          <SpellCheckedText text={racconto.testo} />
        </div>
      </div>
    </div>
  )
}
