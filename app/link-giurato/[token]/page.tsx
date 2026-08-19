'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

// Pagina ponte: NON fa nulla al caricamento, quindi e' sicura anche se
// un client di messaggistica (WhatsApp, Telegram, ecc.) scarica la pagina
// per generare l'anteprima del link. Il vero magic link Supabase viene
// generato e consumato solo al click reale dell'utente sul bottone.
export default function LinkGiuratoPage() {
  const params = useParams()
  const token = params?.token as string

  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')

  const handleAccedi = async () => {
    setErrore('')
    setLoading(true)

    try {
      const res = await fetch('/api/attiva-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()

      if (!res.ok || !data.link) {
        setErrore(data.error || 'Link non valido o scaduto')
        setLoading(false)
        return
      }

      window.location.href = data.link
    } catch {
      setErrore('Errore di connessione, riprova')
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <img src="/logo_tohorror_dark.png" alt="TOHorror" style={{ height: '60px', margin: '0 auto 1rem', display: 'block', filter: 'invert(1)' }} />
        <h1 style={styles.h1}>Accedi al portale giurati</h1>
        <p style={styles.sottotitolo}>
          Premi il pulsante per accedere e impostare la tua password per il Contest Letterario "I Racconti del Gatto Nero"
        </p>

        {errore && <p style={styles.errore}>{errore}</p>}

        <button
          onClick={handleAccedi}
          disabled={loading}
          style={loading ? { ...styles.bottone, opacity: 0.6 } : styles.bottone}
        >
          {loading ? 'Accesso in corso...' : 'Accedi'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Georgia', serif",
    padding: '1rem',
  },
  card: {
    backgroundColor: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: '4px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 0 40px rgba(180, 0, 0, 0.08)',
  },
  h1: {
    color: '#e8e8e8',
    fontSize: '1.4rem',
    fontWeight: 'normal',
    textAlign: 'center',
    marginBottom: '0.5rem',
  },
  sottotitolo: {
    color: '#666',
    fontSize: '0.85rem',
    textAlign: 'center',
    marginBottom: '2rem',
  },
  errore: {
    color: '#c0392b',
    fontSize: '0.85rem',
    marginBottom: '1rem',
    textAlign: 'center',
  },
  bottone: {
    width: '100%',
    backgroundColor: '#8b0000',
    color: '#e8e8e8',
    border: 'none',
    borderRadius: '3px',
    padding: '0.85rem',
    fontSize: '0.95rem',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    marginTop: '0.5rem',
  },
}
