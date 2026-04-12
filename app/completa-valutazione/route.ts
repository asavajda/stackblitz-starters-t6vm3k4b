import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { assegnazione_id, racconto_id } = await req.json()

  // Aggiorna assegnazione come completata
  await supabaseAdmin
    .from('assegnazioni')
    .update({ completata: true })
    .eq('id', assegnazione_id)

  // Controlla tutte le assegnazioni del racconto (bypassa RLS)
  const { data: tutteAssegnazioni } = await supabaseAdmin
    .from('assegnazioni')
    .select('id, completata')
    .eq('racconto_id', racconto_id)

  const totale = tutteAssegnazioni?.length ?? 0
  const completate = tutteAssegnazioni?.filter(a => a.completata === true).length ?? 0

  if (totale >= 2 && completate === totale) {
    await supabaseAdmin
      .from('racconti')
      .update({ stato: 'valutato' })
      .eq('id', racconto_id)
  }

  return NextResponse.json({ success: true, completate, totale })
}
