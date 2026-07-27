import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aggiornaStatoRacconti } from '@/lib/statoRacconti'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { assegnazione_id, racconto_id } = body

  await supabaseAdmin
    .from('assegnazioni')
    .update({ completata: true })
    .eq('id', assegnazione_id)

  // Il passaggio a 'valutato' non dipende piu' dal salvataggio della valutazione
  // ma dalla conferma dei blocchi (vedi lib/statoRacconti). Qui la chiamata resta
  // perche' con assegnazioni storiche senza blocco vale ancora il vecchio criterio.
  await aggiornaStatoRacconti([racconto_id])

  return NextResponse.json({ success: true })
}
