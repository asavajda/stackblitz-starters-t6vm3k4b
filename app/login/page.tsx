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
    <div className="min-h-screen flex items-center justify-center bg-white px-4 overflow-hidden">
      <div className="w-full max-w-md flex flex-col items-center">
        <img
          src="/logo_gatto_luna.png"
          alt="I Racconti del Gatto Nero"
          className="w-16 h-auto mb-4"
        />
        <p className="text-[11px] tracking-[0.3em] text-black/60 uppercase mb-10">
          I Racconti del Gatto Nero
        </p>

        <div className="relative w-full grid place-items-center">
          <div
            className="hidden sm:block col-start-1 row-start-1 rounded-full border border-black/25"
            style={{ width: 'min(560px, 82vw)', height: 'min(560px, 82vw)' }}
          />

          <div className="col-start-1 row-start-1 bg-white w-full max-w-[340px] px-8 py-10">
            <h1 className="text-xl font-semibold tracking-[0.15em] text-black uppercase mb-8 text-center">
              Accedi
            </h1>
            <div className="space-y-6">
              <div>
                <label className="block text-xs tracking-wide text-black/50 mb-1.5">Email</label>
                <input type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-black/25 px-0 py-2 text-sm text-black focus:outline-none focus:border-black transition-colors" />
              </div>
              <div>
                <label className="block text-xs tracking-wide text-black/50 mb-1.5">Password</label>
                <input type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-transparent border-0 border-b border-black/25 px-0 py-2 text-sm text-black focus:outline-none focus:border-black transition-colors" />
              </div>
              {errore && <p className="text-xs text-black/70">{errore}</p>}
              <button onClick={handleLogin} disabled={caricamento}
                className="w-full bg-black text-white rounded-md py-2.5 text-sm font-medium tracking-wide hover:bg-black/85 transition-colors disabled:opacity-40">
                {caricamento ? 'Accesso in corso...' : 'Accedi'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
