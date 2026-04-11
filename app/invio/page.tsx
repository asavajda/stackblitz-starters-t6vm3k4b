'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://kgxhjcdssbdgolanidzh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneGhqY2Rzc2JkZ29sYW5pZHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjYxMDIsImV4cCI6MjA5MTUwMjEwMn0.oYce_FKMUq4aP3IzIP5Nz4Lquuv2Me5JPOuGrAZKjTU'
)

export default function InvioPage() {
  const [titolo, setTitolo] = useState('')
  const [testo, setTesto] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [tipoInvio, setTipoInvio] = useState<'testo' | 'file'>('testo')
  const [caricamento, setCaricamento] = useState(false)
  const [successo, setSuccesso] = useState(false)
  const [messaggiErrore, setMessaggiErrore] = useState<string[]>([])
  const [edizione, setEdizione] = useState<any>(null)
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [campiErrore, setCampiErrore] = useState<string[]>([])
  const [maggiorenne, setMaggiorenne] = useState(false)
  const [checkboxErrore, setCheckboxErrore] = useState(false)

  useEffect(() => {
    async function caricaEdizione() {
      const { data } = await supabase
        .from('edizioni')
        .select('*')
        .eq('stato', 'aperta')
        .single()
      setEdizione(data)
    }
    caricaEdizione()
  }, [])

  function campoClass(campo: string) {
    return `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
      campiErrore.includes(campo)
        ? 'border-red-400 focus:ring-red-200'
        : 'border-gray-200 focus:ring-gray-300'
    }`
  }

  function capitalizza(val: string) {
    return val.charAt(0).toUpperCase() + val.slice(1)
  }

  async function handleInvio() {
    setCaricamento(true)
    setMessaggiErrore([])
    setCheckboxErrore(false)
    const errori: string[] = []
    const messaggi: string[] = []

    const nomeVuoto = !nome.trim()
    const cognomeVuoto = !cognome.trim()
    const emailVuota = !email.trim()
    const telefonoVuoto = !telefono.trim()

    if (nomeVuoto) errori.push('nome')
    if (cognomeVuoto) errori.push('cognome')

    if (emailVuota) {
      errori.push('email')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errori.push('email')
      messaggi.push('Email non valida.')
    }

    if (telefonoVuoto) {
      errori.push('telefono')
    } else if (!/^[+\d\s\-()]{7,15}$/.test(telefono)) {
      errori.push('telefono')
      messaggi.push('Telefono non valido.')
    }

    if (nomeVuoto || cognomeVuoto || emailVuota || telefonoVuoto) {
      messaggi.unshift('Compila tutti i campi obbligatori.')
    }

    if (!titolo.trim()) {
      errori.push('titolo')
      messaggi.push('Il titolo è obbligatorio.')
    }

    if (tipoInvio === 'testo' && !testo.trim()) {
      errori.push('testo')
      messaggi.push('Il testo è obbligatorio.')
    }

    if (tipoInvio === 'testo' && testo.length > 18000) {
      errori.push('testo')
      messaggi.push('Il testo supera il limite di 18.000 battute.')
    }

    if (tipoInvio === 'file' && !file) {
      errori.push('file')
      messaggi.push('Seleziona un file da caricare.')
    }

    if (!maggiorenne) {
      setCheckboxErrore(true)
      messaggi.push('Devi confermare di avere almeno 18 anni.')
    }

    if (errori.length > 0 || !maggiorenne) {
      setCampiErrore(errori)
      setMessaggiErrore(messaggi)
      setCaricamento(false)
      return
    }

    setCampiErrore([])
    let filePath = null

    if (tipoInvio === 'file' && file) {
      const ext = file.name.split('.').pop()
      const path = `pubblico/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('racconti-files')
        .upload(path, file)
      if (uploadError) {
        setMessaggiErrore(['Errore nel caricamento del file.'])
        setCaricamento(false)
        return
      }
      filePath = path
    }

    const { error } = await supabase.from('racconti').insert({
      edizione_id: edizione.id,
      autore_id: null,
      titolo,
      tipo_invio: tipoInvio,
      testo: tipoInvio === 'testo' ? testo : null,
      file_path: filePath,
      autore_nome: nome,
      autore_cognome: cognome,
      autore_email: email,
      autore_telefono: telefono,
    })

    if (error) {
      setMessaggiErrore(['Errore durante l\'invio. Riprova.'])
      console.error(error)
    } else {
      setSuccesso(true)
    }
    setCaricamento(false)
  }

  if (successo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl border border-gray-200 max-w-md w-full text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Racconto inviato</h2>
          <p className="text-gray-500 text-sm">Grazie per la tua partecipazione. Riceverai aggiornamenti via email.</p>
        </div>
      </div>
    )
  }

  if (!edizione) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Nessuna edizione aperta al momento.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Carica il tuo racconto</h1>
        <p className="text-sm font-medium text-gray-700 mb-2">Contest Letterario "I Racconti del Gatto Nero"</p>
        <p className="text-sm text-gray-500 mb-2">26th ToHorror Fantastic Film Fest</p>
        
        <a
          href="https://www.tohorrorfilmfest.it/wp-content/uploads/2025/04/bando-contest-letterario-2025_TOHorror.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline mb-6 block"
        >
          Leggi il bando completo
        </a>

        <div className="space-y-5">
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dati personali</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => { setNome(capitalizza(e.target.value)); setCampiErrore(p => p.filter(c => c !== 'nome')) }}
                  className={campoClass('nome')}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Cognome</label>
                <input
                  type="text"
                  value={cognome}
                  onChange={e => { setCognome(capitalizza(e.target.value)); setCampiErrore(p => p.filter(c => c !== 'cognome')) }}
                  className={campoClass('cognome')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setCampiErrore(p => p.filter(c => c !== 'email')) }}
                  className={campoClass('email')}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Telefono</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={e => { setTelefono(e.target.value); setCampiErrore(p => p.filter(c => c !== 'telefono')) }}
                  className={campoClass('telefono')}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Titolo</label>
            <input
              type="text"
              value={titolo}
              onChange={e => { setTitolo(e.target.value); setCampiErrore(p => p.filter(c => c !== 'titolo')) }}
              className={campoClass('titolo')}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Modalità di invio</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={tipoInvio === 'testo'}
                  onChange={() => setTipoInvio('testo')}
                />
                Incolla il testo
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={tipoInvio === 'file'}
                  onChange={() => setTipoInvio('file')}
                />
                Carica un file
              </label>
            </div>
          </div>

          {tipoInvio === 'testo' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-gray-600">Testo</label>
                <span className={`text-xs ${testo.length > 18000 ? 'text-red-500' : 'text-gray-400'}`}>
                  {testo.length} / 18.000 battute
                </span>
              </div>
              <textarea
                value={testo}
                onChange={e => { setTesto(e.target.value); setCampiErrore(p => p.filter(c => c !== 'testo')) }}
                rows={12}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${
                  testo.length > 18000 || campiErrore.includes('testo')
                    ? 'border-red-400 focus:ring-red-200'
                    : 'border-gray-200 focus:ring-gray-300'
                }`}
              />
              {testo.length > 18000 && (
                <p className="text-xs text-red-500 mt-1">Il testo supera il limite di 18.000 battute.</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-600 mb-1">File (PDF, Word, odt)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.odt"
                onChange={e => { setFile(e.target.files?.[0] || null); setCampiErrore(p => p.filter(c => c !== 'file')) }}
                className={`w-full text-sm ${campiErrore.includes('file') ? 'text-red-500' : 'text-gray-500'}`}
              />
              <p className="text-xs text-amber-600 mt-1">
                Il racconto non deve superare 18.000 battute (spazi inclusi). La verifica e a carico dell autore.
              </p>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={maggiorenne}
              onChange={e => { setMaggiorenne(e.target.checked); setCheckboxErrore(false) }}
              className="mt-0.5 shrink-0"
              style={{ accentColor: checkboxErrore ? 'red' : undefined, outline: checkboxErrore ? '2px solid red' : undefined, borderRadius: '3px' }}
            />
            <span className={`text-sm ${checkboxErrore ? 'text-red-500' : 'text-gray-600'}`}>
              Dichiaro di avere almeno 18 anni e di aver letto e accettato il regolamento del contest.
            </span>
          </label>

          {messaggiErrore.length > 0 && (
            <div className="space-y-1">
              {messaggiErrore.map((m, i) => (
                <p key={i} className="text-sm text-red-500">{m}</p>
              ))}
            </div>
          )}

          <button
            onClick={handleInvio}
            disabled={caricamento}
            className="w-full bg-gray-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {caricamento ? 'Invio in corso...' : 'Invia racconto'}
          </button>
        </div>
      </div>
    </div>
  )
}