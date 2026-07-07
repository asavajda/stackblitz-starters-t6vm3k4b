import { NextRequest, NextResponse } from 'next/server'

// Proxy verso l'API pubblica di LanguageTool (open source, gratuita).
// Elabora ortografia, grammatica e stile lato server: il browser del
// giurato non deve scaricare/elaborare nessun dizionario, evitando i
// problemi di memoria di un correttore ortografico interamente client-side.
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Testo mancante' }, { status: 400 })
    }

    // Limite prudenziale: l'API pubblica di LanguageTool accetta fino a
    // circa 20.000 caratteri per richiesta anonima
    const testoLimitato = text.slice(0, 19000)

    const params = new URLSearchParams({
      text: testoLimitato,
      language: 'it',
    })

    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      return NextResponse.json(
        { error: `LanguageTool ha risposto con errore ${response.status}`, dettagli: bodyText.slice(0, 300) },
        { status: 502 }
      )
    }

    const data = await response.json()
    return NextResponse.json({
      matches: data.matches || [],
      testoAnalizzato: testoLimitato,
      troncato: text.length > testoLimitato.length,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Errore sconosciuto'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
