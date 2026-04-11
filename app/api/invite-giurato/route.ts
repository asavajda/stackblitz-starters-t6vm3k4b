import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, nome, cognome, tipo_giurato } = await req.json()

    if (!email || !nome || !cognome) {
      return NextResponse.json(
        { error: 'Email, nome e cognome sono obbligatori' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/giurato`,
      data: {
        ruolo: 'giurato',
        nome,
        cognome,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      nome,
      cognome,
      email,
      ruolo: 'giurato',
      tipo_giurato: tipo_giurato || 'lettore',
    })

    return NextResponse.json({ success: true, user: data.user })

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Errore interno del server' },
      { status: 500 }
    )
  }
}