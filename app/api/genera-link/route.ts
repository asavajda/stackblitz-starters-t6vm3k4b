import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email obbligatoria' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
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
