import { supabaseAdmin } from './supabaseAdmin'

// Un racconto passa a 'valutato' solo quando TUTTI i giurati assegnati hanno
// CONFERMATO il proprio blocco, non quando hanno semplicemente salvato la
// valutazione: fino alla conferma criteri e bonus restano modificabili, quindi
// il punteggio non e' ancora definitivo.
//
// Da usare solo lato server: gira con la service role key e ignora le RLS,
// perche' deve leggere i blocchi di tutti i giurati, non solo del chiamante.
export async function aggiornaStatoRacconti(racconto_ids: string[]) {
  // Deduplica senza spread su Set: il target TS del progetto e' sotto ES2015
  const ids = racconto_ids.filter((id, i, arr) => Boolean(id) && arr.indexOf(id) === i)
  if (ids.length === 0) return

  const { data: assegnazioni } = await supabaseAdmin
    .from('assegnazioni')
    .select('id, racconto_id, giurato_id, blocco_id, completata')
    .in('racconto_id', ids)

  const bloccoIds = (assegnazioni || [])
    .map(a => a.blocco_id)
    .filter((id, i, arr) => Boolean(id) && arr.indexOf(id) === i)

  const { data: blocchiGiurato } = bloccoIds.length > 0
    ? await supabaseAdmin
        .from('blocchi_giurato')
        .select('blocco_id, giurato_id, completato')
        .in('blocco_id', bloccoIds as string[])
    : { data: [] as any[] }

  const confermati = new Set(
    (blocchiGiurato || [])
      .filter(bg => bg.completato === true)
      .map(bg => `${bg.blocco_id}|${bg.giurato_id}`)
  )

  for (const racconto_id of ids) {
    const proprie = (assegnazioni || []).filter(a => a.racconto_id === racconto_id)
    if (proprie.length < 2) continue

    // Le assegnazioni senza blocco_id sono storiche (precedenti al sistema a
    // blocchi): per quelle vale il vecchio criterio, cioe' la valutazione salvata.
    const tutteConfermate = proprie.every(a =>
      a.blocco_id
        ? confermati.has(`${a.blocco_id}|${a.giurato_id}`)
        : a.completata === true
    )

    if (tutteConfermate) {
      await supabaseAdmin.from('racconti').update({ stato: 'valutato' }).eq('id', racconto_id)
    }
  }
}
