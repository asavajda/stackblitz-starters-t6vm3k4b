'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SpellCheckedText } from '@/components/SpellCheckedText'

export default function ControlloOrtograficoPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()
  const filePath = searchParams.get('file_path')
  const [titolo, setTitolo] = useState<string>('')
  const [testo, setTesto] = useState<string>('')
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    async function carica() {
      try {
        if (filePath) {
          // Estrai il testo dal file DOCX SOLO per l'analisi ortografica.
          // Il file originale su Storage non viene mai modificato: viene
          // solo letto e convertito in memoria per il controllo.
          console.log('[Ortografia] file_path ricevuto:', filePath)

          const { data: signedUrl, error: urlError } = await supabase.storage
            .from('racconti-files')
            .createSignedUrl(filePath, 3600)

          console.log('[Ortografia] signedUrl:', signedUrl?.signedUrl)
          console.log('[Ortografia] urlError:', urlError)

          if (!signedUrl?.signedUrl) {
            throw new Error('Impossibile ottenere l\'URL del file: ' + (urlError?.message || 'sconosciuto'))
          }

          const response = await fetch(signedUrl.signedUrl)
          console.log('[Ortografia] fetch status:', response.status, response.statusText)
          console.log('[Ortografia] content-type:', response.headers.get('content-type'))
          console.log('[Ortografia] content-length:', response.headers.get('content-length'))

          if (!response.ok) {
            const bodyText = await response.text().catch(() => '(non leggibile)')
            console.log('[Ortografia] corpo risposta errore:', bodyText.slice(0, 500))
            throw new Error(`Errore nel download del file: HTTP ${response.status}`)
          }

          const arrayBuffer = await response.arrayBuffer()
          console.log('[Ortografia] byte scaricati:', arrayBuffer.byteLength)

          // Controllo che sia effettivamente uno ZIP (i .docx sono file ZIP)
          // La firma ZIP inizia con i byte 'PK' (0x50 0x4B)
          const firstBytes = new Uint8Array(arrayBuffer.slice(0, 4))
          console.log('[Ortografia] primi byte del file:', Array.from(firstBytes).map(b => b.toString(16)).join(' '))

          if (firstBytes[0] !== 0x50 || firstBytes[1] !== 0x4B) {
            // Non è uno ZIP valido: probabilmente abbiamo scaricato una
            // pagina di errore HTML/JSON invece del file vero
            const asText = new TextDecoder().decode(arrayBuffer.slice(0, 300))
            console.log('[Ortografia] contenuto non-ZIP ricevuto:', asText)
            throw new Error('Il file scaricato non è un documento .docx valido (probabile URL scaduto o non accessibile).')
          }

          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ arrayBuffer })

          const fileName = filePath.split('/').pop() || 'Racconto'
          setTitolo(fileName.replace(/\.[^.]+$/, ''))
          setTesto(result.value)
        } else {
          const { data } = await supabase
            .from('racconti')
            .select('titolo, testo')
            .eq('id', params.id)
            .single()

          if (!data) throw new Error('Racconto non trovato')
          setTitolo(data.titolo)
          setTesto(data.testo)
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Errore sconosciuto'
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-semibold text-gray-800">{titolo}</h1>
        </div>
        <p className="text-xs text-gray-400 mb-8 bg-gray-50 border border-gray-200 rounded p-2">
          Questa è una vista solo per il controllo ortografico: il testo qui mostrato è
          un'estrazione automatica usata unicamente per l'analisi. Il file originale
          inviato dall'autore non viene modificato.
        </p>
        <SpellCheckedText text={testo} />
      </div>
    </div>
  )
}
