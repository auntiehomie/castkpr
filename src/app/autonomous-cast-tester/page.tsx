'use client'

import { useState, useEffect } from 'react'
import { AutonomousCastScheduler } from '@/lib/autonomous-scheduler'

interface AutonomousCastResult {
  success: boolean
  message: string
  cast?: string
  inspired_by_topics?: string[]
  postedAt?: string
  nextPostAfter?: string
}

interface SchedulerStatus {
  active: boolean
  interval: string | null
  isGoodTimeToPost: boolean
  cronSchedule: string
}

export default function AutonomousCastTester() {
  const [result, setResult] = useState<AutonomousCastResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [testContent, setTestContent] = useState('')
  const [contentValidation, setContentValidation] = useState<{ valid: boolean; reason?: string } | null>(null)
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)

  // Fetch scheduler status on component mount
  useEffect(() => {
    fetchSchedulerStatus()
  }, [])

  const fetchSchedulerStatus = async () => {
    try {
      const response = await fetch('/api/dev-scheduler')
      const data = await response.json()
      if (data.status) {
        setSchedulerStatus(data.status)
      }
    } catch (error) {
      console.error('Error fetching scheduler status:', error)
    }
  }

  const triggerAutonomousCast = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/autonomous-cast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_AUTONOMOUS_CAST_SECRET || 'CSTKPR_AUTO_CAST_SECRET_2024'}`,
        },
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleDevScheduler = async (action: 'start' | 'stop' | 'trigger') => {
    setScheduleLoading(true)
    try {
      const response = await fetch('/api/dev-scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      })

      const data = await response.json()
      console.log('Scheduler action result:', data)
      
      // Refresh status
      await fetchSchedulerStatus()
      
      if (action === 'trigger' && data.cast) {
        setResult(data)
      }
    } catch (error) {
      console.error('Error controlling scheduler:', error)
    } finally {
      setScheduleLoading(false)
    }
  }

  const validateTestContent = () => {
    const validation = AutonomousCastScheduler.validateContent(testContent)
    setContentValidation(validation)
  }

  const isGoodTime = AutonomousCastScheduler.isGoodTimeToPost()
  const recommendedInterval = AutonomousCastScheduler.getRecommendedPostingInterval()
  const cronSchedule = AutonomousCastScheduler.generateCronSchedule()
  const guidelines = AutonomousCastScheduler.getContentGuidelines()
  const optimalTimes = AutonomousCastScheduler.getOptimalPostingTimes()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">
          CastKPR Autonomous Cast Control Center
        </h1>

        {/* Status Panel */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-semibold text-white mb-4">System Status</h2>
          <div className="grid md:grid-cols-2 gap-4 text-gray-300">
            <div>
              <p><strong>Good time to post:</strong> {isGoodTime ? '✅ Yes' : '❌ No'}</p>
              <p><strong>Recommended interval:</strong> {recommendedInterval} hours</p>
              <p><strong>Cron schedule:</strong> <code className="bg-black/30 px-2 py-1 rounded">{cronSchedule}</code></p>
              <p><strong>Dev scheduler:</strong> {schedulerStatus?.active ? '🟢 Running' : '🔴 Stopped'}</p>
            </div>
            <div>
              <p><strong>Current time:</strong> {new Date().toLocaleString()}</p>
              <p><strong>Next optimal times:</strong></p>
              <ul className="text-sm ml-4">
                {optimalTimes.slice(0, 3).map((time, i) => (
                  <li key={i}>• {time.toLocaleTimeString()}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Development Scheduler Control */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-semibold text-white mb-4">Development Scheduler</h2>
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => toggleDevScheduler('start')}
              disabled={scheduleLoading || schedulerStatus?.active}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              {scheduleLoading ? '⏳' : '▶️'} Start Auto-Scheduler
            </button>
            <button
              onClick={() => toggleDevScheduler('stop')}
              disabled={scheduleLoading || !schedulerStatus?.active}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              {scheduleLoading ? '⏳' : '⏹️'} Stop Auto-Scheduler
            </button>
            <button
              onClick={() => toggleDevScheduler('trigger')}
              disabled={scheduleLoading}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              {scheduleLoading ? '⏳' : '⚡'} Force Trigger Now
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            The development scheduler runs locally and will automatically post during optimal times.
            {schedulerStatus?.active && (
              <span className="text-green-400"> Currently checking every {schedulerStatus.interval}.</span>
            )}
          </p>
        </div>

        {/* Manual Trigger Panel */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-semibold text-white mb-4">Manual Trigger</h2>
          <button
            onClick={triggerAutonomousCast}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            {loading ? '🤖 Generating Cast...' : '🚀 Trigger Autonomous Cast'}
          </button>

          {result && (
            <div className={`mt-4 p-4 rounded-lg ${result.success ? 'bg-green-900/50 border border-green-500' : 'bg-red-900/50 border border-red-500'}`}>
              <h3 className="font-semibold text-white mb-2">
                {result.success ? '✅ Success' : '❌ Error'}
              </h3>
              <p className="text-gray-300 mb-2">{result.message}</p>
              
              {result.cast && (
                <div className="bg-black/30 p-3 rounded mt-2">
                  <p className="text-white font-mono text-sm">"{result.cast}"</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Length: {result.cast.length} characters
                    {result.inspired_by_topics && (
                      <span> • Topics: {result.inspired_by_topics.join(', ')}</span>
                    )}
                  </p>
                </div>
              )}
              
              {result.postedAt && (
                <p className="text-gray-400 text-sm mt-2">
                  Posted at: {new Date(result.postedAt).toLocaleString()}
                  {result.nextPostAfter && (
                    <span> • Next post after: {new Date(result.nextPostAfter).toLocaleString()}</span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Content Validator */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-semibold text-white mb-4">Content Validator</h2>
          <textarea
            value={testContent}
            onChange={(e) => setTestContent(e.target.value)}
            placeholder="Enter test content to validate against autonomous cast rules..."
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            rows={3}
          />
          <div className="flex justify-between items-center mt-2">
            <button
              onClick={validateTestContent}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              Validate Content
            </button>
            <span className="text-gray-400 text-sm">
              {testContent.length}/320 characters
            </span>
          </div>

          {contentValidation && (
            <div className={`mt-4 p-3 rounded-lg ${contentValidation.valid ? 'bg-green-900/50 border border-green-500' : 'bg-red-900/50 border border-red-500'}`}>
              <p className="text-white">
                {contentValidation.valid ? '✅ Content is valid' : `❌ ${contentValidation.reason}`}
              </p>
            </div>
          )}
        </div>

        {/* Guidelines */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h2 className="text-2xl font-semibold text-white mb-4">Content Guidelines</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-green-400 mb-2">✅ Do</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                {guidelines.dos.map((item, index) => (
                  <li key={index}>• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-400 mb-2">❌ Don't</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                {guidelines.donts.map((item, index) => (
                  <li key={index}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-purple-400 mb-2">📋 Style Guidelines</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              {guidelines.style.map((item, index) => (
                <li key={index}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-2">🎯 Recommended Topics</h3>
            <div className="flex flex-wrap gap-2">
              {guidelines.topics.map((topic, index) => (
                <span key={index} className="bg-blue-600/30 text-blue-200 px-3 py-1 rounded-full text-sm">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mt-6">
          <h2 className="text-2xl font-semibold text-white mb-4">Setup Instructions</h2>
          <div className="text-gray-300 space-y-4">
            <div>
              <h3 className="font-semibold text-white mb-2">1. Environment Variables</h3>
              <div className="bg-black/30 p-3 rounded text-sm">
                <p>NEYNAR_API_KEY=your_neynar_api_key</p>
                <p>NEYNAR_SIGNER_UUID=your_signer_uuid</p>
                <p>OPENAI_API_KEY=your_openai_api_key</p>
                <p>AUTONOMOUS_CAST_SECRET=your_secret_token</p>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Note: In development mode, authentication is optional for testing
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">2. Cron Job Setup</h3>
              <p>Set up a cron service to POST to:</p>
              <div className="bg-black/30 p-3 rounded text-sm mt-2">
                <p><strong>URL:</strong> https://your-domain.com/api/autonomous-cast</p>
                <p><strong>Method:</strong> POST</p>
                <p><strong>Headers:</strong> Authorization: Bearer your_secret_token</p>
                <p><strong>Schedule:</strong> {cronSchedule}</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">3. Neynar Signer Setup</h3>
              <p>Create a signer for your @cstkpr bot account on the Neynar dashboard to enable posting casts.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
