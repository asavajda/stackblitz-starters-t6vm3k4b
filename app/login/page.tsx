'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cormorant } from './fonts'

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
    <div className="min-h-screen flex items-center justify-center bg-[#0b0910] relative px-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 15%, rgba(201,162,39,0.08) 0%, rgba(11,9,16,0) 60%), ' +
            'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(122,30,36,0.12) 0%, rgba(11,9,16,0) 60%)',
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div
              className="absolute inset-0 blur-2xl opacity-40"
              style={{ background: 'radial-gradient(circle, #C9A227 0%, transparent 70%)' }}
            />
            <img
              src="/logo_tohorror_dark.png"
              alt="TOHorror Fantastic Film Fest"
              className="relative w-36 h-auto"
              style={{ filter: 'invert(1) brightness(0.92)' }}
            />
          </div>
          <p className={`${cormorant.className} text-[#C9A227] text-sm tracking-[0.25em] uppercase`}>
            I Racconti del Gatto Nero
          </p>
        </div>

        <div className="bg-[#15121a]/80 backdrop-blur-sm border border-[#C9A227]/20 rounded-2xl p-8 shadow-2xl">
          <h1 className={`${cormorant.className} text-3xl font-semibold text-[#EDE8E0] mb-6`}>Accedi</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#8D8797] mb-1">Email</label>
              <input type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#0f0d14] border border-[#3a3442] rounded-lg px-3 py-2 text-sm text-[#EDE8E0] placeholder-[#5c5662] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/50 focus:border-[#C9A227]/50" />
            </div>
            <div>
              <label className="block text-sm text-[#8D8797] mb-1">Password</label>
              <input type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full bg-[#0f0d14] border border-[#3a3442] rounded-lg px-3 py-2 text-sm text-[#EDE8E0] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/50 focus:border-[#C9A227]/50" />
            </div>
            {errore && <p className="text-sm text-[#F0997B]">{errore}</p>}
            <button onClick={handleLogin} disabled={caricamento}
              className="w-full bg-gradient-to-r from-[#7A1E24] to-[#591116] text-[#EDE8E0] rounded-lg py-2.5 text-sm font-medium tracking-wide hover:from-[#8f2530] hover:to-[#6b151b] transition-colors disabled:opacity-50">
              {caricamento ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
