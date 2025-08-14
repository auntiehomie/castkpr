'use client'

import { useState, useEffect } from 'react'

interface IntelligenceDashboardProps {
  userId?: string
}

export default function IntelligenceDashboard({ userId = 'demo-user' }: IntelligenceDashboardProps) {
  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
      <div className="text-center">
        <div className="text-6xl mb-4">🧠</div>
        <h3 className="text-xl font-semibold text-white mb-2">Intelligence Dashboard</h3>
        <p className="text-gray-400">Coming soon...</p>
      </div>
    </div>
  )
}