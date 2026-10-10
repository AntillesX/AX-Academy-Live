'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const CARIBBEAN_COUNTRIES = [
  'Antigua and Barbuda',
  'Bahamas',
  'Barbados',
  'Dominica',
  'Grenada',
  'Jamaica',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Trinidad and Tobago',
  'Other / International'
]

export default function OnboardingPage() {
  const [fullName, setFullName] = useState('')
  const [country, setCountry] = useState(CARIBBEAN_COUNTRIES[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('No active user found. Please log in again.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        country: country,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold mb-2">Welcome to AntillesX! 🎓</h1>
        <p className="text-gray-400 text-sm mb-6">
          Please complete your profile to access your student dashboard and courses.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Marcus Garvey"
              className="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500 text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
              Country / Region
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500 text-white"
            >
              {CARIBBEAN_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving Profile...' : 'Continue to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
