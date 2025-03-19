// app/page.tsx
'use client'
import { useState } from 'react'

type LogEntry = {
  type: 'info' | 'success' | 'error'
  message: string
  timestamp: Date
}

export default function NetworkTester() {
  const [discoveredIp, setDiscoveredIp] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isTesting, setIsTesting] = useState(false)

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: new Date() }])
  }

  const handleMdnsDiscovery = async () => {
    setIsTesting(true)
    addLog('info', '开始mDNS服务发现...')

    try {
      const response = await fetch('/api/mdns')
      const data = await response.json()

      if (data.success && data.ip) {
        setDiscoveredIp(data.ip)
        addLog('success', `mDNS测试成功！发现服务地址: ${data.ip}`)
      } else {
        addLog('error', 'mDNS测试失败：未发现服务')
      }
    } catch (err) {
      addLog('error', `mDNS发现异常: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setIsTesting(false)
    }
  }

  const testWebSocket = async () => {
    if (!discoveredIp) {
      addLog('error', '未发现服务，无法进行WebSocket测试')
      return
    }

    setIsTesting(true)
    addLog('info', '开始WebSocket测试...')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const ws = new WebSocket(`ws://${discoveredIp}:37521`)

      ws.onopen = () => {
        const message = JSON.stringify({
          text: "这是测试通知",
          type: "success",
          promise: ""
        })
        ws.send(message)
        addLog('success', 'WebSocket通知测试成功！消息已发送')
      }

      ws.onmessage = (event) => {
        addLog('info', `收到服务端响应: ${event.data}`)
      }

      ws.onerror = (error) => {
        addLog('error', `WebSocket测试失败: ${error}`)
        setIsTesting(false)
      }

      ws.onclose = () => {
        clearTimeout(timeout)
        setIsTesting(false)
      }
    } catch (err) {
      addLog('error', `WebSocket连接异常: ${err instanceof Error ? err.message : '未知错误'}`)
      setIsTesting(false)
    }
  }

  const testHttp = async () => {
    if (!discoveredIp) {
      addLog('error', '未发现服务，无法进行HTTP测试')
      return
    }

    setIsTesting(true)
    addLog('info', `开始HTTP测试...目标IP: ${discoveredIp}`)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`http://${discoveredIp}:37520/backend/ip`, {
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (response.ok) {
        const data = await response.json()
        const ips = data.ips?.join(', ') || '无可用IP'
        addLog('success', `HTTP测试成功！可用IP地址: ${ips}`)
      } else {
        addLog('error', `HTTP测试失败，状态码: ${response.status}`)
      }
    } catch (err) {
      addLog('error', `HTTP测试异常: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setIsTesting(false)
    }
  }

  return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">网络测试工具</h1>

        <div className="flex gap-4 mb-6">
          <button
              onClick={handleMdnsDiscovery}
              disabled={isTesting}
              className="btn btn-primary"
          >
            发现服务
          </button>
          <button
              onClick={testWebSocket}
              disabled={!discoveredIp || isTesting}
              className="btn btn-secondary"
          >
            测试WebSocket
          </button>
          <button
              onClick={testHttp}
              disabled={!discoveredIp || isTesting}
              className="btn btn-accent"
          >
            测试HTTP
          </button>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">日志</h2>
          <div className="space-y-2">
            {logs.map((log, index) => (
                <div
                    key={index}
                    className={`p-2 rounded ${
                        log.type === 'error' ? 'bg-red-100' :
                            log.type === 'success' ? 'bg-green-100' : 'bg-blue-100'
                    }`}
                >
                  [{log.timestamp.toLocaleTimeString()}] {log.message}
                </div>
            ))}
          </div>
        </div>
      </div>
  )
}