'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(false)

  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetInviato, setResetInviato] = useState(false)
  const [mostraReset, setMostraReset] = useState(false)

  async function handleLogin() {
    setCaricamento(true)
    setErrore('')
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      setErrore('Email o password non corretti.')
      setCaricamento(false)
      return
    }
    const { data: profilo } = await supabase
      .from('profiles')
      .select('ruolo')
      .eq('id', data.user.id)
      .single()
    if (profilo?.ruolo === 'admin') router.push('/dashboard')
    else if (profilo?.ruolo === 'giurato') router.push('/giurato')
    else router.push('/invio')
  }

async function handleResetPassword() {
  if (!resetEmail) {
    setErrore('Inserisci la tua email per reimpostare la password')
    return
  }
  setResetLoading(true)
  setErrore('')
  const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/set-password`,
  })
  setResetLoading(false)
  if (error) {
    setErrore(`Errore: ${error.message}`)  // <-- messaggio preciso
    return
  }
  setResetInviato(true)
}

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-gray-800 mb-6">Accedi</h1>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          {errore && (
            <p className="text-sm text-red-500">{errore}</p>
          )}
          <button
            onClick={handleLogin}
            disabled={caricamento}
            className="w-full bg-gray-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {caricamento ? 'Accesso in corso...' : 'Accedi'}
          </button>

          {/* Sezione reset password */}
          <div className="border-t border-gray-100 pt-4">
            {!mostraReset ? (
              <button
                onClick={() => setMostraReset(true)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 text-center"
              >
                Password dimenticata?
              </button>
            ) : !resetInviato ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 text-center">
                  Inserisci la tua email per ricevere il link di reset
                </p>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="La tua email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setMostraReset(false)}
                    className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-2 text-sm hover:bg-gray-50"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                    className="flex-1 bg-gray-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                  >
                    {resetLoading ? 'Invio...' : 'Invia link'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-green-600 text-center">
                ✓ Email inviata — controlla la tua casella di posta
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
