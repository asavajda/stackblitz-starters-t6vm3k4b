import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Serve un PDF dello storage Supabase passando dal nostro dominio.
 *
 * Motivo: aprendo il signed URL di Supabase direttamente, il browser mostra
 * come nome della scheda l'hostname del progetto (xxxx.supabase.co) e una
 * favicon generica, perche' e' un file grezzo su un dominio esterno.
 *
 * Forma dell'URL:
 *   /api/racconto-file/<signed url in base64url>/<Nome del racconto>.pdf
 *
 * Il signed URL sta nel percorso e non in una query string, e il nome del
 * racconto e' l'ultimo segmento, perche' Safari per i PDF inline ignora
 * l'header Content-Disposition. Tentativi precedenti, entrambi falliti su iOS:
 *   1. Content-Disposition con filename           -> mostrava l'hostname
 *   2. nome nel percorso ma con ?src=... in coda  -> mostrava l'hostname
 * Questa versione elimina la query string: e' l'ultima ipotesi rimasta, cioe'
 * che fosse la coda ?src=... a impedire a Safari di leggere il nome file.
 *
 * Il segmento [nome] e' puramente decorativo: il file servito dipende solo da
 * [src], che viene validato sotto.
 *
 * Autenticazione: la route non ha una sessione propria (il client Supabase
 * tiene il token in localStorage, non nei cookie). La credenziale e' il signed
 * URL stesso, generato lato client sotto RLS e valido a tempo: chi lo possiede
 * puo' gia' leggere il file direttamente, quindi il proxy non amplia l'accesso.
 */

function nomeFileSicuro(nome: string): string {
  // Rimuove i caratteri che romperebbero l'header HTTP o il filesystem.
  // Nota: params arriva gia' decodificato da Next, non va decodificato di nuovo
  // (un titolo tipo "100% puro" farebbe fallire decodeURIComponent).
  const pulito = nome
    .replace(/[\r\n"\\/\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const base = pulito || 'Racconto.pdf'
  return (base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`).slice(0, 100)
}

function decodificaSrc(segmento: string): string | null {
  try {
    const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/')
    const decodificato = Buffer.from(base64, 'base64').toString('utf8')
    return decodificato || null
  } catch {
    return null
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { src: string; nome: string } }
) {
  const src = decodificaSrc(params.src || '')

  if (!src) {
    return new Response('Percorso file non valido', { status: 400 })
  }

  let target: URL
  try {
    target = new URL(src)
  } catch {
    return new Response('Percorso file non valido', { status: 400 })
  }

  // Whitelist obbligatoria: senza questo controllo la route diventerebbe un
  // proxy aperto, utilizzabile per far scaricare al nostro server URL arbitrari.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return new Response('Configurazione mancante', { status: 500 })
  }
  const consentito =
    target.protocol === 'https:' &&
    target.host === new URL(supabaseUrl).host &&
    target.pathname.startsWith('/storage/v1/object/sign/racconti-files/')

  if (!consentito) {
    return new Response('Percorso file non consentito', { status: 403 })
  }

  // I visualizzatori PDF chiedono spesso porzioni del file invece di scaricarlo
  // tutto: inoltrare il Range e' cio' che tiene lo scorrimento fluido.
  const range = req.headers.get('range')
  let upstream: Response
  try {
    upstream = await fetch(target.toString(), {
      headers: range ? { Range: range } : {},
      cache: 'no-store',
    })
  } catch {
    return new Response('File non raggiungibile', { status: 502 })
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response('File non disponibile', { status: upstream.status })
  }

  const nome = nomeFileSicuro(params.nome || 'Racconto.pdf')
  const headers = new Headers()
  headers.set('Content-Type', 'application/pdf')
  headers.set(
    'Content-Disposition',
    `inline; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nome)}`
  )
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'private, no-store')

  for (const header of ['content-length', 'content-range', 'etag']) {
    const valore = upstream.headers.get(header)
    if (valore) headers.set(header, valore)
  }

  return new Response(upstream.body, { status: upstream.status, headers })
}
