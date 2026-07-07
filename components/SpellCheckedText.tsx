'use client'

import { useEffect, useState } from 'react'

interface SpellCheckedTextProps {
  text: string
}

interface LTMatch {
  message: string
  shortMessage?: string
  offset: number
  length: number
  replacements: { value: string }[]
  rule: {
    id: string
    issueType?: string
    category: { id: string; name: string }
  }
}

// Determina lo stile visivo in base al tipo di problema rilevato da LanguageTool
function stileErrore(match: LTMatch): string {
  const categoria = match.rule.category?.id || ''
  if (categoria === 'TYPOS' || match.rule.issueType === 'misspelling') {
    // Ortografia: sottolineatura rossa
    return 'underline decoration-red-500 decoration-wavy text-red-700'
  }
  if (categoria === 'STYLE' || categoria === 'REDUNDANCY') {
    // Stile: sottolineatura blu
    return 'underline decoration-blue-400 decoration-wavy text-blue-700'
  }
  // Grammatica e tutto il resto: sottolineatura ambra
  return 'underline decoration-amber-500 decoration-wavy text-amber-700'
}

export function SpellCheckedText({ text }: SpellCheckedTextProps) {
  const [matches, setMatches] = useState<LTMatch[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)

  useEffect(() => {
    let annullato = false

    async function analizza() {
      try {
        const response = await fetch('/api/controllo-ortografico', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || `Errore HTTP ${response.status}`)
        }

        if (!annullato) {
          setMatches(data.matches || [])
        }
      } catch (error) {
        if (!annullato) {
          const msg = error instanceof Error ? error.message : 'Errore sconosciuto'
          setLoadingError(msg)
        }
      } finally {
        if (!annullato) setIsLoading(false)
      }
    }

    if (text && text.trim().length > 0) {
      analizza()
    } else {
      setIsLoading(false)
    }

    return () => { annullato = true }
  }, [text])

  const renderTestoEvidenziato = () => {
    if (!matches || matches.length === 0) {
      return <>{text}</>
    }

    // Ordino i match per offset e rimuovo eventuali sovrapposizioni
    const ordinati = [...matches].sort((a, b) => a.offset - b.offset)
    const elements: React.ReactNode[] = []
    let cursore = 0

    ordinati.forEach((match, i) => {
      if (match.offset < cursore) return // sovrapposizione, salto

      if (match.offset > cursore) {
        elements.push(text.slice(cursore, match.offset))
      }

      const porzione = text.slice(match.offset, match.offset + match.length)
      const suggerimento = match.replacements?.[0]?.value
      const titolo = suggerimento
        ? `${match.shortMessage || match.message} → "${suggerimento}"`
        : (match.shortMessage || match.message)

      elements.push(
        <span
          key={`err-${i}-${match.offset}`}
          className={`${stileErrore(match)} cursor-help`}
          title={titolo}
        >
          {porzione}
        </span>
      )

      cursore = match.offset + match.length
    })

    if (cursore < text.length) {
      elements.push(text.slice(cursore))
    }

    return <>{elements}</>
  }

  if (isLoading) {
    return (
      <div>
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap opacity-60">
          {text}
        </div>
        <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-100 rounded">
          ⏳ Analisi ortografica e grammaticale in corso...
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
          ⚠️ Controllo non disponibile al momento: {loadingError}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {renderTestoEvidenziato()}
      </div>
      <div className="flex gap-4 mt-4 text-xs text-gray-400 border-t border-gray-100 pt-3">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-red-500 inline-block"></span> Ortografia
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-amber-500 inline-block"></span> Grammatica
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-blue-400 inline-block"></span> Stile
        </span>
        {matches && (
          <span className="ml-auto">{matches.length} {matches.length === 1 ? 'segnalazione' : 'segnalazioni'}</span>
        )}
      </div>
    </div>
  )
}
