import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {profile?.full_name || 'Student'}! 👋</h1>
            <p className="text-gray-400 text-sm mt-1">Region: {profile?.country || 'Eastern Caribbean'}</p>
          </div>
          <div className="px-4 py-2 bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-semibold rounded-lg uppercase tracking-wider">
            {profile?.role || 'student'}
          </div>
        </div>

        {/* Enrolled Courses Section */}
        <div>
          <h2 className="text-xl font-bold mb-4">Your Enrolled Courses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-md">Active</span>
                <h3 className="text-lg font-bold mt-3">Caribbean Tech & Business Fundamentals</h3>
                <p className="text-gray-400 text-sm mt-1">Master modern web apps, cloud infrastructure, and automated scaling.</p>
              </div>
              <div className="mt-6">
                <Link 
                  href="/courses/caribbean-tech-fundamentals"
                  className="inline-block w-full text-center py-2.5 bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-lg transition-colors text-sm"
                >
                  Continue Learning →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
