import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { assegnazione_id, racconto_id } = body

  await supabaseAdmin
    .from('assegnazioni')
    .update({ completata: true })
    .eq('id', assegnazione_id)

  await new Promise(resolve => setTimeout(resolve, 500))

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

  return NextResponse.json({ success: true })
}
