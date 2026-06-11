export interface TaskList {
  id: string
  name: string
  createdAt: number
  archived?: boolean
}

export interface Subtask {
  id: string
  name: string
  iterations: number
  completed: boolean
}

export type RecurrenceUnit = 'days' | 'weeks' | 'months'

export interface RecurrenceSettings {
  enabled: boolean
  interval: number
  unit: RecurrenceUnit
  lastCompletedAt?: number
}

export interface Task {
  id: string
  name: string
  iterations: number
  subtasks: Subtask[]
  completed: boolean
  collapsed: boolean
  completedIterations?: number
  isHighPriority?: boolean
  recurrence?: RecurrenceSettings
  templateId?: string
}

export type TimerPhase = 'work' | 'break' | 'longBreak' | 'idle'

export interface TimerState {
  phase: TimerPhase
  remainingSeconds: number
  isRunning: boolean
  currentTaskId: string | null
  completedIterations: number
  needsAcknowledgment: boolean
  isLongBreakNext: boolean
}

export interface CompletedTaskRecord {
  taskName: string
  completedIterations: number
  completedAt: number
}

export interface Statistics {
  totalCompletedTasks: number
  totalCompletedIterations: number
  totalFocusTimeMinutes: number
  tasksCompletedToday: number
  focusTimeToday: number
  completedTaskHistory: CompletedTaskRecord[]
}