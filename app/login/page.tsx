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
    <div className="min-h-screen flex flex-col items-center bg-white px-4 pt-8 sm:pt-12 pb-12">
      <div className="w-full max-w-sm flex flex-col items-center">

        <div
          className="relative mb-10 flex items-center justify-center"
          style={{ width: 'min(380px, 82vw)', height: 'min(380px, 82vw)' }}
        >
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
            <circle cx="100" cy="100" r="20" fill="none" stroke="black" strokeWidth="2.5" />
            <circle cx="100" cy="100" r="40" fill="none" stroke="black" strokeWidth="2.5" />
            <circle cx="100" cy="100" r="58" fill="none" stroke="black" strokeWidth="2" />
            <circle cx="100" cy="100" r="74" fill="none" stroke="black" strokeWidth="2" />
            <circle cx="100" cy="100" r="88" fill="none" stroke="black" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="100" fill="none" stroke="black" strokeWidth="1.5" />
          </svg>
          <img
            src="/logo_gatto_luna.png"
            alt="I Racconti del Gatto Nero"
            className="relative w-[24%] h-auto rounded-full"
          />
        </div>

        <h1 className="text-2xl font-semibold tracking-[0.5em] text-black mb-4 pl-[0.5em]">ACCEDI</h1>
        <div className="w-full h-px bg-black mb-10" />

        <div className="w-full space-y-6 mb-2">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-transparent border-0 border-b border-black/70 px-0 py-1.5 text-sm text-black focus:outline-none focus:border-black" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-transparent border-0 border-b border-black/70 px-0 py-1.5 text-sm text-black focus:outline-none focus:border-black" />
          </div>
        </div>

        {errore && <p className="text-sm text-red-600 self-start mt-4">{errore}</p>}

        <button onClick={handleLogin} disabled={caricamento}
          className="w-full bg-black text-white rounded-md py-3 text-sm font-medium tracking-wide mt-8 hover:bg-gray-800 transition-colors disabled:opacity-50">
          {caricamento ? 'Accesso in corso...' : 'Accedi'}
        </button>
      </div>
    </div>
  )
}
