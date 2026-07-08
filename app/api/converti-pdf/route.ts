import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Converte un file di qualsiasi formato in PDF usando CloudConvert, poi lo
// carica su Supabase Storage nello stesso bucket/percorso già usato per gli
// upload diretti, così il resto della piattaforma non deve sapere che è
// avvenuta una conversione.
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.CLOUDCONVERT_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Conversione non configurata (manca CLOUDCONVERT_API_KEY)' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Nessun file ricevuto' }, { status: 400 })
    }

    const nomeOriginale = file.name
    const estensione = nomeOriginale.split('.').pop()?.toLowerCase() || ''

    // Se è già un PDF non serve convertire: carichiamo direttamente
    if (estensione === 'pdf') {
      const path = `pubblico/${Date.now()}.pdf`
      const { error: uploadError } = await supabaseAdmin.storage
        .from('racconti-files')
        .upload(path, file)
      if (uploadError) {
        return NextResponse.json({ error: 'Errore nel caricamento del PDF: ' + uploadError.message }, { status: 500 })
      }
      return NextResponse.json({ path })
    }

    // 1. Creo il job CloudConvert: importa il file, lo converte in PDF, lo esporta
    const jobRes = await fetch('https://api.cloudconvert.com/v2/jobs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks: {
          'import-file': { operation: 'import/upload' },
          'convert-file': {
            operation: 'convert',
            input: 'import-file',
            output_format: 'pdf',
          },
          'export-file': { operation: 'export/url', input: 'convert-file' },
        },
      }),
    })

    if (!jobRes.ok) {
      const dettagli = await jobRes.text().catch(() => '')
      return NextResponse.json({ error: `Errore nella creazione del job CloudConvert: ${jobRes.status}`, dettagli }, { status: 502 })
    }

    const job = await jobRes.json()
    const importTask = job.data.tasks.find((t: any) => t.name === 'import-file')

    // 2. Carico il file grezzo sull'URL fornito da CloudConvert (multipart/form-data)
    const uploadForm = new FormData()
    Object.entries(importTask.result.form.parameters).forEach(([k, v]) => {
      uploadForm.append(k, v as string)
    })
    uploadForm.append('file', file, nomeOriginale)

    const uploadRes = await fetch(importTask.result.form.url, {
      method: 'POST',
      body: uploadForm,
    })
    if (!uploadRes.ok) {
      return NextResponse.json({ error: `Errore nel caricamento del file su CloudConvert: ${uploadRes.status}` }, { status: 502 })
    }

    // 3. Aspetto che il job finisca (CloudConvert offre un endpoint sincrono apposito)
    const waitRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${job.data.id}/wait`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!waitRes.ok) {
      return NextResponse.json({ error: `Errore in attesa della conversione: ${waitRes.status}` }, { status: 502 })
    }
    const jobFinito = await waitRes.json()

    if (jobFinito.data.status !== 'finished') {
      return NextResponse.json({ error: 'La conversione non è andata a buon fine', dettagli: jobFinito.data.tasks }, { status: 502 })
    }

    const exportTask = jobFinito.data.tasks.find((t: any) => t.name === 'export-file')
    const downloadUrl = exportTask?.result?.files?.[0]?.url
    if (!downloadUrl) {
      return NextResponse.json({ error: 'Nessun file convertito restituito da CloudConvert' }, { status: 502 })
    }

    // 4. Scarico il PDF convertito e lo carico su Supabase Storage
    const pdfRes = await fetch(downloadUrl)
    if (!pdfRes.ok) {
      return NextResponse.json({ error: 'Errore nello scaricare il PDF convertito' }, { status: 502 })
    }
    const pdfBuffer = await pdfRes.arrayBuffer()

    const path = `pubblico/${Date.now()}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('racconti-files')
      .upload(path, pdfBuffer, { contentType: 'application/pdf' })

    if (uploadError) {
      return NextResponse.json({ error: 'Errore nel caricamento del PDF convertito: ' + uploadError.message }, { status: 500 })
    }

    return NextResponse.json({ path, convertitoDa: estensione })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Errore sconosciuto'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
