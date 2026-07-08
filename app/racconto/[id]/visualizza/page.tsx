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
    <iframe
      src={srcIframe}
      title={titolo}
      className="w-full border-0"
      style={{ height: '100dvh' }}
    />
  )
}
