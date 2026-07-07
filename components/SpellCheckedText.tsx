'use client'

import { useEffect, useState } from 'react'

interface SpellCheckedTextProps {
  text: string
}

export function SpellCheckedText({ text }: SpellCheckedTextProps) {
  const [spellChecker, setSpellChecker] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initializeSpellChecker = async () => {
      try {
        // Carico nspell e il dizionario italiano
        const nspellModule = await import('nspell')
        const Nspell = nspellModule.default

        // Carico i file del dizionario italiano da un CDN (hunspell-dictionary-it)
        const afxResponse = await fetch('https://cdn.jsdelivr.net/npm/hunspell-dictionary-it@7.0.0/it.aff')
        const dicResponse = await fetch('https://cdn.jsdelivr.net/npm/hunspell-dictionary-it@7.0.0/it.dic')

        if (!afxResponse.ok || !dicResponse.ok) {
          console.warn('Impossibile caricare il dizionario italiano')
          setIsLoading(false)
          return
        }

        const afxText = await afxResponse.text()
        const dicText = await dicResponse.text()

        // Creo l'istanza di nspell con la sintassi corretta per v2.x
        const checker = new Nspell(afxText, dicText)
        setSpellChecker(checker)
      } catch (error) {
        console.warn('Errore nell\'inizializzazione dello spell checker:', error)
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

    return <>{elements}</>
  }

  if (isLoading) {
    return (
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap opacity-60">
        {text}
      </div>
    )
  }

  return (
    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
      {getSpellCheckedContent()}
    </div>
  )
}
