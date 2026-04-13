import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json()
  const { assegnazione_id, racconto_id } = body

  // Aggiorna assegnazione corrente
  const { error: errUpdate } = await supabaseAdmin
    .from('assegnazioni')
    .update({ completata: true })
    .eq('id', assegnazione_id)

  // Piccolo ritardo per assicurarsi che l'update sia propagato
  await new Promise(resolve => setTimeout(resolve, 500))

  // Legge tutte le assegnazioni del racconto
  const { data: tutteAssegnazioni, error: errSelect } = await supabaseAdmin
    .from('assegnazioni')
    .select('id, completata')
    .eq('racconto_id', racconto_id)

  const totale = tutteAssegnazioni?.length ?? 0
  const completate = tutteAssegnazioni?.filter(a => a.completata === true).length ?? 0

  let errStato = null
  let dataStato = null

  if (totale >= 2 && completate === totale) {
    const { error, data } = await supabaseAdmin
      .from('racconti')
      .update({ stato: 'valutato' })
      .eq('id', racconto_id)
      .select()

    errStato = error?.message ?? null
    dataStato = data
  }

  return NextResponse.json({ 
    success: true, 
    completate, 
    totale,
    tutteAssegnazioni,
    errUpdate: errUpdate?.message ?? null,
    errSelect: errSelect?.message ?? null,
    errStato,
    dataStato,
    racconto_id,
  })
}
