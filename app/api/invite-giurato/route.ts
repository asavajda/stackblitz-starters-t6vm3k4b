import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { email, nome, cognome, tipo_giurato } = await req.json()

    if (!email || !nome || !cognome) {
      return NextResponse.json(
        { error: 'Email, nome e cognome sono obbligatori' },
        { status: 400 }
      )
    }

    // Crea utente con password temporanea, senza mandare email
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'TOHorror2025!',
      email_confirm: true, // niente email di conferma
    })

    if (error) {
      const errorMessages: Record<string, string> = {
        'A user with this email address has already been registered':
          'Un utente con questa email è già registrato',
        'Unable to validate email address: invalid format':
          'Formato email non valido',
      }
      return NextResponse.json(
        { error: errorMessages[error.message] ?? `Errore: ${error.message}` },
        { status: 400 }
      )
    }

    await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      nome,
      cognome,
      email,
      ruolo: 'giurato',
      tipo_giurato: tipo_giurato || 'lettore',
      must_change_password: true,
    })

    return NextResponse.json({ success: true, user: data.user })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Errore interno del server' },
      { status: 500 }
    )
  }
}
