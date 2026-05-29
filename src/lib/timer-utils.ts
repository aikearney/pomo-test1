import { Task, RecurrenceUnit } from './types'

export const WORK_DURATION = 25 * 60
export const SHORT_BREAK_DURATION = 5 * 60
export const LONG_BREAK_DURATION = 15 * 60
export const ITERATIONS_BEFORE_LONG_BREAK = 4

export function getWorkDuration(): number {
  return WORK_DURATION
}

export function getShortBreakDuration(): number {
  return SHORT_BREAK_DURATION
}

export function getLongBreakDuration(): number {
  return LONG_BREAK_DURATION
}

export function calculateTaskIterations(task: Task): number {
  if (task.completed) return 0
  
  const subtaskIterations = task.subtasks
    .filter(st => !st.completed)
    .reduce((sum, st) => sum + st.iterations, 0)
  
  if (task.subtasks.length > 0) {
    return subtaskIterations
  }
  
  return task.iterations
}

export function calculateTotalIterations(tasks: Task[]): number {
  return tasks.reduce((sum, task) => sum + calculateTaskIterations(task), 0)
}

export function calculateTotalTime(iterations: number): {
  days: number
  hours: number
  minutes: number
  totalMinutes: number
} {
  let totalMinutes = 0
  
  for (let i = 1; i <= iterations; i++) {
    totalMinutes += 25
    
    if (i < iterations) {
      if (i % ITERATIONS_BEFORE_LONG_BREAK === 0) {
        totalMinutes += 15
      } else {
        totalMinutes += 5
      }
    }
  }
  
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  
  return { days, hours, minutes, totalMinutes }
}

export function formatTimeDisplay(days: number, hours: number, minutes: number): string {
  const parts: string[] = []
  
  if (days > 0) {
    parts.push(`${days}d`)
  }
  if (hours > 0) {
    parts.push(`${hours}h`)
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`)
  }
  
  return parts.join(' ')
}

export function formatTimerDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function playNotificationSound(isMuted: boolean, isLongBreak: boolean = false) {
  if (isMuted) return
  
  const audioContext = new AudioContext()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  
  if (isLongBreak) {
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.15)
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.3)
  } else {
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
  }
  
  oscillator.type = 'sine'
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
  
  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.5)
}

export function startContinuousBeeping(isMuted: boolean, isLongBreak: boolean = false): number | null {
  if (isMuted) return null
  
  playNotificationSound(isMuted, isLongBreak)
  
  return window.setInterval(() => {
    playNotificationSound(isMuted, isLongBreak)
  }, 1500)
}

export function stopContinuousBeeping(intervalId: number | null) {
  if (intervalId !== null) {
    clearInterval(intervalId)
  }
}

export function getMillisecondsForRecurrence(interval: number, unit: RecurrenceUnit): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const MS_PER_WEEK = 7 * MS_PER_DAY
  const MS_PER_MONTH = 30 * MS_PER_DAY
  
  switch (unit) {
    case 'days':
      return interval * MS_PER_DAY
    case 'weeks':
      return interval * MS_PER_WEEK
    case 'months':
      return interval * MS_PER_MONTH
    default:
      return interval * MS_PER_DAY
  }
}

export function shouldReactivateRecurringTask(task: Task): boolean {
  if (!task.recurrence?.enabled || !task.completed || !task.recurrence.lastCompletedAt) {
    return false
  }
  
  const now = Date.now()
  const timeSinceCompletion = now - task.recurrence.lastCompletedAt
  const recurrenceInterval = getMillisecondsForRecurrence(
    task.recurrence.interval,
    task.recurrence.unit
  )
  
  return timeSinceCompletion >= recurrenceInterval
}

export function formatRecurrenceDescription(interval: number, unit: RecurrenceUnit): string {
  if (interval === 1) {
    switch (unit) {
      case 'days':
        return 'Daily'
      case 'weeks':
        return 'Weekly'
      case 'months':
        return 'Monthly'
    }
  }
  
  return `Every ${interval} ${unit}`
}

export function getTimeUntilReactivation(task: Task): string | null {
  if (!task.recurrence?.enabled || !task.completed || !task.recurrence.lastCompletedAt) {
    return null
  }
  
  const now = Date.now()
  const recurrenceInterval = getMillisecondsForRecurrence(
    task.recurrence.interval,
    task.recurrence.unit
  )
  const reactivationTime = task.recurrence.lastCompletedAt + recurrenceInterval
  const timeRemaining = reactivationTime - now
  
  if (timeRemaining <= 0) {
    return 'Ready to reactivate'
  }
  
  const days = Math.floor(timeRemaining / (24 * 60 * 60 * 1000))
  const hours = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  
  if (days > 0) {
    return `${days}d ${hours}h remaining`
  } else if (hours > 0) {
    return `${hours}h remaining`
  } else {
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000))
    return `${minutes}m remaining`
  }
}
