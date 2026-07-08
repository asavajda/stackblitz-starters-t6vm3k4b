'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function VisualizzaPage() {
  const searchParams = useSearchParams()
  const filePath = searchParams.get('file_path') || ''
  const titolo = searchParams.get('titolo') || 'Racconto'
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  const estensione = filePath.split('.').pop()?.toLowerCase()

  // Titolo della scheda del browser: usa il titolo del racconto anziché
  // il nome generico della piattaforma o il nome file interno
  useEffect(() => {
    document.title = `${titolo} — Valuta`
  }, [titolo])

  useEffect(() => {
    async function carica() {
      const { data, error } = await supabase.storage
        .from('racconti-files')
        .createSignedUrl(filePath, 3600)

      if (error || !data?.signedUrl) {
        setErrore('Impossibile aprire il file.')
        return
      }
      setSignedUrl(data.signedUrl)
    }
    if (filePath) carica()
  }, [filePath])

  if (errore) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-red-600 text-sm">{errore}</p>
    </div>
  )

  if (!signedUrl) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  // I PDF vengono mostrati nativamente dal browser, i DOCX tramite Office Viewer.
  // In entrambi i casi il titolo della scheda resta quello impostato sopra.
  const srcIframe = estensione === 'pdf'
    ? signedUrl
    : `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(signedUrl)}`

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      {/* Barra di apertura diretta: su mobile il visualizzatore dentro l'iframe
          ha spesso uno zoom limitato/poco affidabile. Aprendo il file
          direttamente (fuori dall'iframe) si ottiene il visualizzatore nativo
          del dispositivo, con zoom completo. Non ha alcun effetto sul
          comportamento desktop, resta solo un'opzione in più. */}
      <div className="shrink-0 bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 truncate">{titolo}</span>
        <a href={signedUrl} target="_blank" rel="noopener noreferrer"
          className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-700">
          Apri il file (zoom completo)
        </a>
      </div>
      <iframe
        src={srcIframe}
        title={titolo}
        className="w-full flex-1 border-0"
      />
    </div>
  )
}
