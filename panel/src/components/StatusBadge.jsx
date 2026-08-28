import { statusColor, statusDot } from '../lib/utils'

export default function StatusBadge({ status, label }) {
  const text = label || (status === 'running' ? 'Online' : status === 'stopped' ? 'Offline' : status)
  return (
    <span className={`badge ${statusColor(status)}`}>
      <span className={`w-2 h-2 rounded-full ${statusDot(status)}`} />
      {text}
    </span>
  )
}