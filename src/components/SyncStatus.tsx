'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { 
  Wifi, 
  WifiOff, 
  Clock, 
  Signal, 
  Users, 
  Zap,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react'

interface LatencyInfo {
  averageLatency: number
  currentLatency: number
  jitter: number
  isStable: boolean
  measurements: Array<{
    latency: number
    timestamp: number
    jitter: number
  }>
}

interface SyncStatusProps {
  isConnected: boolean
  lastSyncTime: number
  latencyInfo: LatencyInfo
  syncErrors: string[]
  memberCount?: number
  isOwner: boolean
  onManualSync: () => void
  onClearErrors: () => void
}

export default function SyncStatus({
  isConnected,
  lastSyncTime,
  latencyInfo,
  syncErrors,
  memberCount = 1,
  isOwner,
  onManualSync,
  onClearErrors
}: SyncStatusProps) {
  const timeSinceLastSync = Date.now() - lastSyncTime
  const isRecentSync = timeSinceLastSync < 5000 // 5 seconds
  
  const getConnectionStatus = () => {
    if (!isConnected) return { color: 'destructive', icon: WifiOff, text: 'Disconnected' }
    if (!isRecentSync && lastSyncTime > 0) return { color: 'warning', icon: AlertTriangle, text: 'Sync Delayed' }
    if (latencyInfo.isStable) return { color: 'success', icon: CheckCircle, text: 'Excellent' }
    return { color: 'secondary', icon: Wifi, text: 'Connected' }
  }

  const getLatencyColor = () => {
    if (latencyInfo.currentLatency < 50) return 'text-green-600'
    if (latencyInfo.currentLatency < 100) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getJitterColor = () => {
    if (latencyInfo.jitter < 10) return 'text-green-600'
    if (latencyInfo.jitter < 25) return 'text-yellow-600'
    return 'text-red-600'
  }

  const status = getConnectionStatus()
  const StatusIcon = status.icon

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Signal className="h-4 w-4" />
            Sync Status
          </span>
          <div className="flex items-center gap-2">
            <Badge 
              variant={status.color as any}
              className="flex items-center gap-1"
            >
              <StatusIcon className="h-3 w-3" />
              {status.text}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Connection Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              <span className="text-gray-600">Members</span>
            </div>
            <div className="font-medium">{memberCount}</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3" />
              <span className="text-gray-600">Role</span>
            </div>
            <div className="font-medium">
              {isOwner ? 'Owner' : 'Member'}
            </div>
          </div>
        </div>

        {/* Latency Stats */}
        {isConnected && latencyInfo.measurements.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span className="text-gray-600">Latency</span>
                </div>
                <div className={`font-medium ${getLatencyColor()}`}>
                  {latencyInfo.currentLatency.toFixed(1)}ms
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Signal className="h-3 w-3" />
                  <span className="text-gray-600">Jitter</span>
                </div>
                <div className={`font-medium ${getJitterColor()}`}>
                  {latencyInfo.jitter.toFixed(1)}ms
                </div>
              </div>
            </div>

            {/* Latency Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Connection Quality</span>
                <span>
                  {latencyInfo.isStable ? 'Stable' : 'Unstable'}
                </span>
              </div>
              <Progress 
                value={Math.max(0, 100 - (latencyInfo.currentLatency / 2))} 
                className="h-2"
              />
            </div>

            {/* Average Latency */}
            <div className="text-xs text-gray-600">
              Average: {latencyInfo.averageLatency.toFixed(1)}ms over {latencyInfo.measurements.length} samples
            </div>
          </div>
        )}

        {/* Last Sync Time */}
        {lastSyncTime > 0 && (
          <div className="text-xs text-gray-600">
            Last sync: {isRecentSync ? 'Just now' : `${Math.round(timeSinceLastSync / 1000)}s ago`}
          </div>
        )}

        {/* Sync Errors */}
        {syncErrors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-600">
                Sync Issues ({syncErrors.length})
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClearErrors}
                className="text-xs"
              >
                Clear
              </Button>
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {syncErrors.slice(-3).map((error, index) => (
                <div key={index} className="text-xs text-red-600 bg-red-50 p-1 rounded">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Sync Button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onManualSync}
          className="w-full flex items-center gap-2"
          disabled={!isConnected}
        >
          <RefreshCw className="h-3 w-3" />
          Manual Sync
        </Button>
      </CardContent>
    </Card>
  )
}