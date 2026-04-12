'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export default function SetPasswordPage() {
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')
  const [sessioneOk, setSessioneOk] = useState(false)

  useEffect(() => {
    // Supabase legge automaticamente il token dall'hash dell'URL
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setSessioneOk(true)
      }
    })
  }, [])

  const handleSubmit = async () => {
    setErrore('')

    if (password.length < 8) {
      setErrore('La password deve essere di almeno 8 caratteri')
      return
    }
    if (password !== conferma) {
      setErrore('Le password non coincidono')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setErrore('Errore durante il salvataggio della password')
      setLoading(false)
      return
    }

    // Reindirizza in base al ruolo
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('ruolo')
      .eq('id', user?.id)
      .single()

    if (profile?.ruolo === 'admin') {
      router.push('/dashboard')
    } else {
      router.push('/giurato')
    }
  }

  if (!sessioneOk) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.attesa}>Verifica del link in corso...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.titolo}>☠</div>
        <h1 style={styles.h1}>Imposta la tua password</h1>
        <p style={styles.sottotitolo}>
          Scegli una password per accedere al portale TOHorror
        </p>

        <div style={styles.campo}>
          <label style={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Minimo 8 caratteri"
            style={styles.input}
          />
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Conferma password</label>
          <input
            type="password"
            value={conferma}
            onChange={e => setConferma(e.target.value)}
            placeholder="Ripeti la password"
            style={styles.input}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {errore && <p style={styles.errore}>{errore}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={loading ? { ...styles.bottone, opacity: 0.6 } : styles.bottone}
        >
          {loading ? 'Salvataggio...' : 'Salva password e accedi'}
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
  titolo: {
    fontSize: '2.5rem',
    textAlign: 'center',
    marginBottom: '0.5rem',
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
  campo: {
    marginBottom: '1.2rem',
  },
  label: {
    display: 'block',
    color: '#999',
    fontSize: '0.8rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '0.4rem',
  },
  input: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '3px',
    color: '#e8e8e8',
    padding: '0.7rem 0.9rem',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
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
  attesa: {
    color: '#666',
    textAlign: 'center',
    fontSize: '0.9rem',
  },
}
