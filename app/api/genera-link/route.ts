import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Non generiamo piu' subito il vero magic link Supabase: se il link finale
// viene mandato via WhatsApp, l'anteprima del messaggio scarica la pagina
// e consuma il token (monouso) prima ancora che l'utente clicchi, causando
// l'errore "otp_expired". Generiamo invece un token ponte nostro: il vero
// magic link viene creato solo quando l'utente clicca "Accedi" sulla pagina
// /link-giurato/[token], che e' innocua per i crawler di anteprima.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email obbligatoria' }, { status: 400 })
    }

    const { data: profilo, error: erroreProfilo } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (erroreProfilo || !profilo) {
      return NextResponse.json({ error: 'Giurato non trovato' }, { status: 404 })
    }

    const token = randomUUID()
    const scadenza = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 ora

    const { error: erroreUpdate } = await supabaseAdmin
      .from('profiles')
      .update({ link_token: token, link_token_scade: scadenza })
      .eq('id', profilo.id)

    if (erroreUpdate) {
      return NextResponse.json({ error: erroreUpdate.message }, { status: 400 })
    }

    const linkPonte = `${process.env.NEXT_PUBLIC_SITE_URL}/link-giurato/${token}`

    return NextResponse.json({ link: linkPonte })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Errore interno' },
      { status: 500 }
    )
  }
}
