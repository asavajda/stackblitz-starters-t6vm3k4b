'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(false)

  async function handleLogin() {
    setCaricamento(true)
    setErrore('')

    // Ripulisce eventuali sessioni precedenti corrotte/scadute rimaste nel
    // browser (es. da vecchi test o da un primo accesso via link magico):
    // senza questo passaggio, un token non più valido può bloccare il
    // login anche con credenziali corrette, in modo silenzioso.
    await supabase.auth.signOut().catch(() => {})

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setErrore('Email o password non corretti.')
      setCaricamento(false)
      return
    }

    const { data: profilo } = await supabase
      .from('profiles')
     .select('ruolo, is_admin, must_change_password')
      .eq('id', data.user.id)
      .single()

    if (profilo?.must_change_password) {
      window.location.href = '/set-password?required=1'
      return
    }

    if (profilo?.is_admin) window.location.href = '/dashboard'
    else if (profilo?.ruolo === 'giurato') window.location.href = '/giurato'
    else window.location.href = '/invio'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="w-24 h-24 rounded-full bg-black flex items-center justify-center mb-6">
          <img
            src="/logo_gatto_luna.png"
            alt="I Racconti del Gatto Nero"
            className="w-14 h-auto"
            style={{ filter: 'invert(1)' }}
          />
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full">
          <h1 className="text-2xl font-semibold text-gray-800 mb-6">Accedi</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Password</label>
              <input type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            {errore && <p className="text-sm text-red-500">{errore}</p>}
            <button onClick={handleLogin} disabled={caricamento}
              className="w-full bg-gray-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
              {caricamento ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
