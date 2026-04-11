'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://kgxhjcdssbdgolanidzh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneGhqY2Rzc2JkZ29sYW5pZHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjYxMDIsImV4cCI6MjA5MTUwMjEwMn0.oYce_FKMUq4aP3IzIP5Nz4Lquuv2Me5JPOuGrAZKjTU'
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(false)

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
        </div>
      </div>
    </div>
  )
}