import { useState, useEffect, useCallback, useRef } from 'react'

interface LatencyMeasurement {
  latency: number
  timestamp: number
  jitter: number
}

interface SyncState {
  averageLatency: number
  currentLatency: number
  jitter: number
  isStable: boolean
  measurements: LatencyMeasurement[]
}

const PING_INTERVAL = 5000 // 5 seconds
const MAX_MEASUREMENTS = 10
const STABILITY_THRESHOLD = 20 // ms
const JITTER_THRESHOLD = 50 // ms

export function useLatencySync(roomCode: string | null) {
  const [syncState, setSyncState] = useState<SyncState>({
    averageLatency: 0,
    currentLatency: 0,
    jitter: 0,
    isStable: false,
    measurements: []
  })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const measurementsRef = useRef<LatencyMeasurement[]>([])

  const measureLatency = useCallback(async (): Promise<number> => {
    if (!roomCode) return 0

    try {
      const startTime = performance.now()
      
      // Send ping to server
      const response = await fetch(`/api/rooms/sync?code=${roomCode}&action=ping`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      const endTime = performance.now()
      
      if (!response.ok) {
        throw new Error('Ping failed')
      }

      const data = await response.json()
      const roundTripTime = endTime - startTime
      
      // Calculate one-way latency (approximate)
      const oneWayLatency = Math.max(0, roundTripTime / 2)
      
      return oneWayLatency
    } catch (error) {
      console.warn('Latency measurement failed:', error)
      return 0
    }
  }, [roomCode])

  const reportLatency = useCallback(async (latency: number): Promise<void> => {
    if (!roomCode || latency === 0) return

    try {
      const pingTimestamp = Date.now()
      
      await fetch('/api/rooms/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomCode,
          action: 'reportLatency',
          pingTimestamp,
        }),
      })
    } catch (error) {
      console.warn('Failed to report latency:', error)
    }
  }, [roomCode])

  const calculateStats = useCallback((measurements: LatencyMeasurement[]) => {
    if (measurements.length === 0) {
      return {
        averageLatency: 0,
        currentLatency: 0,
        jitter: 0,
        isStable: false
      }
    }

    // Calculate average latency
    const totalLatency = measurements.reduce((sum, m) => sum + m.latency, 0)
    const averageLatency = totalLatency / measurements.length

    // Calculate jitter (standard deviation)
    const variance = measurements.reduce((sum, m) => {
      const diff = m.latency - averageLatency
      return sum + (diff * diff)
    }, 0) / measurements.length
    
    const jitter = Math.sqrt(variance)

    // Current latency is the most recent measurement
    const currentLatency = measurements[measurements.length - 1].latency

    // Check if connection is stable
    const isStable = jitter < JITTER_THRESHOLD && 
                     Math.abs(currentLatency - averageLatency) < STABILITY_THRESHOLD

    return {
      averageLatency: Math.round(averageLatency * 100) / 100,
      currentLatency: Math.round(currentLatency * 100) / 100,
      jitter: Math.round(jitter * 100) / 100,
      isStable
    }
  }, [])

  const addMeasurement = useCallback((latency: number) => {
    const now = Date.now()
    const newMeasurement: LatencyMeasurement = {
      latency,
      timestamp: now,
      jitter: 0 // Will be calculated in stats
    }

    // Update measurements array
    measurementsRef.current = [
      ...measurementsRef.current.slice(-(MAX_MEASUREMENTS - 1)),
      newMeasurement
    ]

    // Calculate new stats
    const newStats = calculateStats(measurementsRef.current)
    
    setSyncState(prevState => ({
      ...prevState,
      ...newStats,
      measurements: [...measurementsRef.current]
    }))

    // Report to server
    reportLatency(latency)
  }, [calculateStats, reportLatency])

  const performLatencyCheck = useCallback(async () => {
    const latency = await measureLatency()
    if (latency > 0) {
      addMeasurement(latency)
    }
  }, [measureLatency, addMeasurement])

  // Start/stop latency monitoring
  useEffect(() => {
    if (!roomCode) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Initial measurement
    performLatencyCheck()

    // Set up interval for continuous monitoring
    intervalRef.current = setInterval(performLatencyCheck, PING_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [roomCode, performLatencyCheck])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    ...syncState,
    measureLatency: performLatencyCheck,
    resetMeasurements: () => {
      measurementsRef.current = []
      setSyncState({
        averageLatency: 0,
        currentLatency: 0,
        jitter: 0,
        isStable: false,
        measurements: []
      })
    }
  }
}