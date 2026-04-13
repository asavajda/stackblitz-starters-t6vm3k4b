import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  console.log('completa-valutazione chiamata')
  
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json()
  console.log('body ricevuto:', body)

  const { assegnazione_id, racconto_id } = body

  const { error: errUpdate } = await supabaseAdmin
    .from('assegnazioni')
    .update({ completata: true })
    .eq('id', assegnazione_id)

  console.log('errore update:', errUpdate)

  const { data: tutteAssegnazioni, error: errSelect } = await supabaseAdmin
    .from('assegnazioni')
    .select('id, completata')
    .eq('racconto_id', racconto_id)

  console.log('tutteAssegnazioni:', tutteAssegnazioni)
  console.log('errore select:', errSelect)

  const totale = tutteAssegnazioni?.length ?? 0
  const completate = tutteAssegnazioni?.filter(a => a.completata === true).length ?? 0

  console.log(`completate: ${completate} / ${totale}`)

  if (totale >= 2 && completate === totale) {
    const { error: errStato } = await supabaseAdmin
      .from('racconti')
      .update({ stato: 'valutato' })
      .eq('id', racconto_id)
    console.log('errore update stato:', errStato)
  }

return NextResponse.json({ 
  success: true, 
  completate, 
  totale,
  tutteAssegnazioni,
  errUpdate: errUpdate?.message ?? null,
  errSelect: errSelect?.message ?? null,
})}
