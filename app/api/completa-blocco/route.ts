import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aggiornaStatoRacconti } from '@/lib/statoRacconti'

// Chiamata dopo che un giurato ha confermato un blocco. Il completamento in
// blocchi_giurato viene scritto dal client; qui ricalcoliamo lo stato dei
// racconti coinvolti, perche' e' la conferma del blocco (non il salvataggio
// della singola valutazione) a rendere definitivo il punteggio.
export async function POST(req: NextRequest) {
  const { blocco_id } = await req.json()
  if (!blocco_id) {
    return NextResponse.json({ error: 'blocco_id mancante' }, { status: 400 })
  }

  const { data: assegnazioni } = await supabaseAdmin
    .from('assegnazioni')
    .select('racconto_id')
    .eq('blocco_id', blocco_id)

  await aggiornaStatoRacconti((assegnazioni || []).map(a => a.racconto_id))

  return NextResponse.json({ success: true })
}
