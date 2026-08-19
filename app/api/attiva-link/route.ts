import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Chiamata solo dal click reale dell'utente sulla pagina /link-giurato/[token].
// Genera il vero magic link Supabase al volo e invalida subito il token ponte
// (monouso), cosi' un secondo tentativo con lo stesso link ponte fallisce
// in modo esplicito invece di rigenerare link infiniti.
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Token mancante' }, { status: 400 })
    }

    const { data: profilo, error: erroreProfilo } = await supabaseAdmin
      .from('profiles')
      .select('id, email, link_token, link_token_scade')
      .eq('link_token', token)
      .single()

    if (erroreProfilo || !profilo) {
      return NextResponse.json({ error: 'Link non valido' }, { status: 404 })
    }

    if (!profilo.link_token_scade || new Date(profilo.link_token_scade) < new Date()) {
      return NextResponse.json({ error: 'Link scaduto, chiedi un nuovo link all\'amministratore' }, { status: 410 })
    }

    // Token monouso: lo invalidiamo subito, prima ancora di generare il link vero
    await supabaseAdmin
      .from('profiles')
      .update({ link_token: null, link_token_scade: null })
      .eq('id', profilo.id)

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: profilo.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/set-password?required=1`,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ link: data.properties.action_link })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Errore interno' },
      { status: 500 }
    )
  }
}
