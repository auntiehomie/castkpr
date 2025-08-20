'use client'

import { useState, useEffect } from 'react'
import CstkprIntelligenceDashboard from './CstkprIntelligenceDashboard'

interface IntelligenceDashboardProps {
  userId?: string
}

export default function IntelligenceDashboard({ userId = 'demo-user' }: IntelligenceDashboardProps) {
  return (
    <div className="max-w-6xl mx-auto">
      <CstkprIntelligenceDashboard className="w-full" />
    </div>
  )
}