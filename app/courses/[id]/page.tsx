'use client'

import { useState } from 'react'

export default function CourseViewerPage() {
  const [completed, setCompleted] = useState(false)

  const handleMarkComplete = () => {
    setCompleted(true)
    // Here you would write progress increment logic to Supabase
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row">
      {/* Sidebar Course Chapters */}
      <aside className="w-full md:w-80 bg-gray-900 border-r border-gray-800 p-6 space-y-4">
        <h2 className="font-bold text-lg">Course Curriculum</h2>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="p-3 bg-emerald-950 border border-emerald-800 rounded-lg text-emerald-300 font-medium cursor-pointer">
            1. Introduction to AntillesX Ecosystem
          </li>
          <li className="p-3 bg-gray-950 border border-gray-800 rounded-lg hover:border-gray-700 cursor-pointer">
            2. Setting up Cloud Infrastructures
          </li>
          <li className="p-3 bg-gray-950 border border-gray-800 rounded-lg hover:border-gray-700 cursor-pointer">
            3. Automated Deployment Pipelines
          </li>
        </ul>
      </aside>

      {/* Main Lesson Player Area */}
      <main className="flex-1 p-8 space-y-6">
        <div className="aspect-video bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-2xl">
          <div className="text-center space-y-2">
            <span className="text-4xl">🎥</span>
            <p className="text-gray-400 text-sm">Secure Video Stream Player (Supabase Storage)</p>
          </div>
        </div>

        <div className="flex justify-between items-center bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <div>
            <h1 className="text-2xl font-bold">Introduction to AntillesX Ecosystem</h1>
            <p className="text-gray-400 text-sm mt-1">Module 1 • Lesson 1 of 3</p>
          </div>
          <button
            onClick={handleMarkComplete}
            className={`px-6 py-3 font-semibold rounded-xl transition-colors ${
              completed 
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {completed ? '✓ Lesson Completed' : 'Mark as Complete'}
          </button>
        </div>
      </main>
    </div>
  )
}
