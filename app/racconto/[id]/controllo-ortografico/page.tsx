'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SpellCheckedText } from '@/components/SpellCheckedText'

async function estraiTestoDaDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

async function estraiTestoDaPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  // Worker caricato da CDN, coerente con la versione della libreria
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const paginetesti: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    let testoPagina = ''
    let prevItem: any = null

    for (const item of content.items as any[]) {
      if (typeof item.str !== 'string' || item.str === '') continue

      if (prevItem) {
        // transform[5] = coordinata Y (riga), transform[4] = coordinata X (colonna)
        const stessaRiga = Math.abs(item.transform[5] - prevItem.transform[5]) < 2

        if (stessaRiga) {
          // Calcolo lo spazio reale tra la fine dell'elemento precedente
          // e l'inizio di questo, per capire se nel PDF originale c'era
          // uno spazio (testo giustificato) o se la parola prosegue
          const finePrecedente = prevItem.transform[4] + (prevItem.width || 0)
          const iniziaCorrente = item.transform[4]
          const gap = iniziaCorrente - finePrecedente
          const soglia = (prevItem.height || 10) * 0.25
          if (gap > soglia) testoPagina += ' '
        } else {
          // Riga diversa: distinguo tra un normale "a capo" (il testo
          // continua nello stesso paragrafo, come capita spesso con
          // testo giustificato/centrato che va a capo automaticamente)
          // e un vero cambio di paragrafo (salto verticale ampio, es.
          // una riga vuota tra due blocchi). Solo nel secondo caso vado
          // a capo davvero: altrimenti unisco con uno spazio, così un
          // correttore grammaticale non scambia ogni riga per l'inizio
          // di una nuova frase.
          const deltaY = Math.abs(prevItem.transform[5] - item.transform[5])
          const altezzaRiga = prevItem.height || item.height || 10
          if (deltaY > altezzaRiga * 1.8) {
            testoPagina += '\n\n'
          } else {
            testoPagina += ' '
          }
        }
      }

      testoPagina += item.str
      prevItem = item
    }

    paginetesti.push(testoPagina)
  }

  return paginetesti
    .join('\n\n')
    .replace(/[ \t]+\n/g, '\n')   // spazi finali di riga
    .replace(/ {2,}/g, ' ')       // spazi doppi
    .replace(/\n{3,}/g, '\n\n')   // righe vuote multiple
    .trim()
}

// Normalizza una stringa per il confronto: minuscolo, senza punteggiatura,
// spazi multipli ridotti a uno solo
function normalizza(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:!?"'«»""'']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Se la prima riga non vuota del testo estratto corrisponde al titolo del
// racconto (già mostrato come intestazione della pagina), la rimuove per
// evitare che il titolo compaia due volte
function rimuoviTitoloDuplicato(testo: string, titolo: string): string {
  if (!titolo) return testo
  const righe = testo.split('\n')
  const indicePrimaRigaNonVuota = righe.findIndex(r => r.trim().length > 0)
  if (indicePrimaRigaNonVuota === -1) return testo

  const primaRiga = righe[indicePrimaRigaNonVuota]
  if (normalizza(primaRiga) === normalizza(titolo)) {
    righe.splice(indicePrimaRigaNonVuota, 1)
    return righe.join('\n').replace(/^\n+/, '')
  }
  return testo
}

export default function ControlloOrtograficoPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()
  const filePath = searchParams.get('file_path')
  const titoloQuery = searchParams.get('titolo')
  const [titolo, setTitolo] = useState<string>(titoloQuery || '')
  const [testo, setTesto] = useState<string>('')
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)

  // Titolo della scheda del browser: usa il titolo del racconto anziché
  // il nome generico della piattaforma
  useEffect(() => {
    if (titolo) document.title = `${titolo} — Ortografia`
  }, [titolo])

  useEffect(() => {
    async function carica() {
      try {
        if (filePath) {
          // Estrai il testo dal file (PDF o DOCX) SOLO per l'analisi
          // ortografica. Il file originale su Storage non viene mai
          // modificato: viene solo letto e convertito in memoria.
          const { data: signedUrl, error: urlError } = await supabase.storage
            .from('racconti-files')
            .createSignedUrl(filePath, 3600)

          if (!signedUrl?.signedUrl) {
            throw new Error('Impossibile ottenere l\'URL del file: ' + (urlError?.message || 'sconosciuto'))
          }

          const response = await fetch(signedUrl.signedUrl)
          if (!response.ok) {
            throw new Error(`Errore nel download del file: HTTP ${response.status}`)
          }

          const arrayBuffer = await response.arrayBuffer()
          const estensione = filePath.split('.').pop()?.toLowerCase()

          let testoEstratto: string
          if (estensione === 'pdf') {
            testoEstratto = await estraiTestoDaPdf(arrayBuffer)
          } else if (estensione === 'docx') {
            testoEstratto = await estraiTestoDaDocx(arrayBuffer)
          } else {
            throw new Error(`Formato file non supportato per il controllo ortografico: .${estensione}`)
          }

          let titoloEffettivo = titoloQuery
          if (!titoloEffettivo) {
            const fileName = filePath.split('/').pop() || 'Racconto'
            titoloEffettivo = fileName.replace(/\.[^.]+$/, '')
            setTitolo(titoloEffettivo)
          }
          setTesto(rimuoviTitoloDuplicato(testoEstratto, titoloEffettivo))
        } else {
          const { data } = await supabase
            .from('racconti')
            .select('titolo, testo')
            .eq('id', params.id)
            .single()

          if (!data) throw new Error('Racconto non trovato')
          const titoloEffettivo = titoloQuery || data.titolo
          if (!titoloQuery) setTitolo(data.titolo)
          setTesto(rimuoviTitoloDuplicato(data.testo, titoloEffettivo))
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Errore sconosciuto'
        setErrore(msg)
      } finally {
        setCaricamento(false)
      }
    }
    carica()
  }, [params.id, filePath, titoloQuery])

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
