'use client'

import { useEffect, useState } from 'react'

interface SpellCheckedTextProps {
  text: string
}

export function SpellCheckedText({ text }: SpellCheckedTextProps) {
  const [spellChecker, setSpellChecker] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')

  useEffect(() => {
    const initializeSpellChecker = async () => {
      try {
        console.log('[SpellCheck] Inizializzazione in corso...')
        
        // Carico nspell e il dizionario italiano
        const nspellModule = await import('nspell')
        const Nspell = nspellModule.default
        console.log('[SpellCheck] nspell caricato')

        // Carico i file del dizionario italiano da un CDN (pacchetto npm: dictionary-it)
        console.log('[SpellCheck] Carico dizionario da CDN...')
        const afxResponse = await fetch('https://cdn.jsdelivr.net/npm/dictionary-it@2.0.0/index.aff')
        const dicResponse = await fetch('https://cdn.jsdelivr.net/npm/dictionary-it@2.0.0/index.dic')

        console.log('[SpellCheck] AFX response:', afxResponse.status, dicResponse.status)

        if (!afxResponse.ok || !dicResponse.ok) {
          const msg = `Impossibile caricare il dizionario italiano (AFX: ${afxResponse.status}, DIC: ${dicResponse.status})`
          console.warn('[SpellCheck]', msg)
          setLoadingError(msg)
          setDebugInfo(msg)
          setIsLoading(false)
          return
        }

        const afxText = await afxResponse.text()
        const dicText = await dicResponse.text()
        console.log('[SpellCheck] Dizionario scaricato - AFX:', afxText.length, 'byte, DIC:', dicText.length, 'byte')

        // Creo l'istanza di nspell con la sintassi corretta per v2.x
        const checker = new Nspell(afxText, dicText)
        console.log('[SpellCheck] Nspell istanziato correttamente')
        
        // Test: controllo una parola corretta e una errata
        const testCorrect = checker.correct('ciao')
        const testWrong = checker.correct('ciaaao')
        console.log('[SpellCheck] Test - "ciao":', testCorrect, ', "ciaaao":', testWrong)
        
        setSpellChecker(checker)
        setDebugInfo('✓ Spell checker inizializzato')
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('[SpellCheck] Errore:', errorMsg)
        setLoadingError(errorMsg)
        setDebugInfo('✗ Errore: ' + errorMsg)
      } finally {
        setIsLoading(false)
      }
    }

    initializeSpellChecker()
  }, [])

  // Funzione per tokenizzare il testo e identificare gli errori
  const getSpellCheckedContent = () => {
    if (!spellChecker) {
      return <>{text}</>
    }

    // Splittiamo il testo mantenendo la punteggiatura
    const tokens = text.match(/\b\w+\b|[^\w\s]/g) || []
    const elements: React.ReactNode[] = []
    let lastIndex = 0
    let errorCount = 0

    tokens.forEach((token) => {
      const index = text.indexOf(token, lastIndex)
      
      // Aggiungo il testo tra il token precedente e questo
      if (index > lastIndex) {
        elements.push(text.substring(lastIndex, index))
      }

      // Controllo se è una parola (non punteggiatura)
      if (/\w+/.test(token)) {
        // Controllo ortografico
        const isCorrect = spellChecker.correct(token)
        
        if (!isCorrect) {
          errorCount++
          console.log('[SpellCheck] Errore trovato:', token)
          // Parola errata: evidenziala in rosso con sottolineatura
          elements.push(
            <span
              key={`error-${index}`}
              className="underline decoration-red-500 decoration-wavy text-red-600 cursor-help"
              title={`Errore ortografico: ${token}`}
            >
              {token}
            </span>
          )
        } else {
          // Parola corretta: mostrala normalmente
          elements.push(token)
        }
      } else {
        // Punteggiatura e spazi
        elements.push(token)
      }

      lastIndex = index + token.length
    })

    // Aggiungo il testo rimanente
    if (lastIndex < text.length) {
      elements.push(text.substring(lastIndex))
    }

    console.log('[SpellCheck] Totale errori trovati:', errorCount)
    setDebugInfo(`${debugInfo} | ${errorCount} errori trovati`)

    return <>{elements}</>
  }

  if (isLoading) {
    return (
      <div>
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap opacity-60">
          {text}
        </div>
        <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-100 rounded">
          ⏳ Caricamento controllo ortografico...
        </div>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div>
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
        <div className="text-xs text-amber-600 mt-2 p-2 bg-amber-50 rounded border border-amber-200">
          ⚠️ {loadingError}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {getSpellCheckedContent()}
      </div>
      {debugInfo && (
        <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-100 rounded">
          📋 {debugInfo}
        </div>
      )}
    </div>
  )
}
