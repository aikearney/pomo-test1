import { useState, useEffect, useRef } from 'react'
import type React from 'react'
// import { useKV } from '@github/spark/hooks'
import { Task, TimerState, Statistics, TaskList } from '@/lib/types'
import {
  calculateTotalIterations,
  calculateTotalTime,
  formatTimeDisplay,
  startContinuousBeeping,
  stopContinuousBeeping,
  getWorkDuration,
  getShortBreakDuration,
  getLongBreakDuration,
  ITERATIONS_BEFORE_LONG_BREAK,
  shouldReactivateRecurringTask,
} from '@/lib/timer-utils'
import { TimerDisplay } from '@/components/TimerDisplay'
import { TaskItem } from '@/components/TaskItem'
import { StatisticsDialog } from '@/components/StatisticsDialog'
import { TaskListSelector } from '@/components/TaskListSelector'
import { TaskTemplatesDialog } from '@/components/TaskTemplatesDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Play,
  Pause,
  Plus,
  BellSlash,
  Bell,
  ListDashes,
  SquaresFour,
  Stop,
  CaretDown,
  TrashSimple,
  Books,
} from '@phosphor-icons/react'
import { toast, Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Request failed: ${res.status} ${res.statusText}${
        text ? ` - ${text}` : ''
      }`
    )
  }

  if (res.status === 204) {
    // No content
    return undefined as T
  }

  return (await res.json()) as T
}

function App() {
  // --- LISTS + TASKS (REST-backed) ---

  const [taskLists, setTaskLists] = useState<TaskList[]>([])
  const [currentTaskListId, setCurrentTaskListId] = useState<string | null>(
    null
  )
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksByListId, setTasksByListId] = useState<Record<string, Task[]>>({})
  const [isLoadingLists, setIsLoadingLists] = useState(false)
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [isAnonymousMode, setIsAnonymousMode] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authDisplayName, setAuthDisplayName] = useState<string | null>(null)
  const [showLoginOverlay, setShowLoginOverlay] = useState(false)

  const AUTH_PROVIDER = (import.meta.env.VITE_AUTH_PROVIDER || 'aad').trim()
  const LOGIN_PROVIDERS = ['google', 'facebook'] as const

  const LOCAL_LISTS_KEY = 'pomodoro-local-lists'

  const isLocalListId = (listId: string | null | undefined) =>
    !!listId && (listId === 'personal' || listId.startsWith('local-'))

  const getLocalTasksStorageKey = (listId: string) =>
    listId === 'personal' ? 'personalTasks' : `pomodoro-local-tasks:${listId}`

  const readLocalLists = (): TaskList[] => {
    const raw = localStorage.getItem(LOCAL_LISTS_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as TaskList[]
      if (!Array.isArray(parsed)) return []
      return parsed.filter((list) => !!list?.id && !!list?.name)
    } catch {
      return []
    }
  }

  const writeLocalLists = (lists: TaskList[]) => {
    localStorage.setItem(LOCAL_LISTS_KEY, JSON.stringify(lists))
  }

  const persistTasksForList = (listId: string, nextTasks: Task[]) => {
    localStorage.setItem(getLocalTasksStorageKey(listId), JSON.stringify(nextTasks))
  }

  const redirectToLogin = (provider = AUTH_PROVIDER) => {
    const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
    window.location.assign(`/.auth/login/${provider}?post_login_redirect_uri=${redirect}`)
  }

  const redirectToLogout = () => {
    const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
    window.location.assign(`/.auth/logout?post_logout_redirect_uri=${redirect}`)
  }

  const handleLoginClick = () => {
    if (isAuthenticated) {
      redirectToLogout()
      return
    }
    setShowLoginOverlay(true)
  }

  useEffect(() => {
    let cancelled = false

    const loadAuthState = async () => {
      try {
        const res = await fetch('/.auth/me', { credentials: 'include' })
        if (!res.ok) {
          if (!cancelled) {
            setIsAuthenticated(false)
            setAuthDisplayName(null)
          }
          return
        }

        const authInfo = await res.json()
        const principal = Array.isArray(authInfo) ? authInfo[0] : undefined
        const claims = Array.isArray(principal?.user_claims)
          ? principal.user_claims
          : []

        const nameClaim =
          claims.find((claim: any) => claim?.typ === 'name')?.val ||
          claims.find((claim: any) => claim?.typ === 'preferred_username')?.val ||
          claims.find((claim: any) => String(claim?.typ || '').includes('/name'))?.val ||
          null

        if (!cancelled) {
          setIsAuthenticated(Boolean(principal?.user_id))
          setAuthDisplayName(nameClaim)
        }
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false)
          setAuthDisplayName(null)
        }
      }
    }

    loadAuthState()
    return () => {
      cancelled = true
    }
  }, [AUTH_PROVIDER])

  // Load lists on mount
  useEffect(() => {
    let cancelled = false

    const loadLists = async () => {
      try {
        setIsLoadingLists(true)

        const lists = await apiFetch<TaskList[]>('/api/lists')
        if (cancelled) return

        const savedListId = localStorage.getItem('pomodoro-current-list-id') || null

        // Logged-out user -> API returns synthetic personal list; keep all CRUD local.
        if (lists.length === 1 && lists[0].id === 'personal') {
          setIsAnonymousMode(true)
          const localLists = readLocalLists()
          const mergedLists = [lists[0], ...localLists]
          setTaskLists(mergedLists)

          const exists = mergedLists.some((l) => l.id === savedListId)
          setCurrentTaskListId(exists ? savedListId : mergedLists[0].id)
          return
        }

        setIsAnonymousMode(false)

        // Logged-in user with no lists -> create a default personal list in API.
        if (lists.length === 0) {
          const personal = await apiFetch<TaskList>('/api/lists', {
            method: 'POST',
            body: JSON.stringify({ name: 'Personal' }),
          })

          setTaskLists([personal])
          setCurrentTaskListId(personal.id)
          return
        }

        setTaskLists(lists)

        const exists = lists.some((l) => l.id === savedListId)
        setCurrentTaskListId(exists ? savedListId : lists[0].id)
      } catch (err: any) {
        console.error('Error loading lists', err)
        toast.error('Failed to load lists', {
          description: err?.message || 'Please try again.',
        })
      } finally {
        if (!cancelled) setIsLoadingLists(false)
      }
    }

    loadLists()
    return () => {
      cancelled = true
    }
  }, [])

  // Persist current list id locally (for UX)
  useEffect(() => {
    if (currentTaskListId) {
      localStorage.setItem('pomodoro-current-list-id', currentTaskListId)
    }
  }, [currentTaskListId])

  // Keep a per-list task cache so timer task info remains visible after list switching.
  useEffect(() => {
    if (!currentTaskListId) return
    setTasksByListId((prev) => ({
      ...prev,
      [currentTaskListId]: tasks || [],
    }))
  }, [currentTaskListId, tasks])

  // Load tasks when current list changes
  useEffect(() => {
    let cancelled = false

    const loadTasks = async () => {
      if (!currentTaskListId) {
        setTasks([])
        return
      }

      if (isAnonymousMode || isLocalListId(currentTaskListId)) {
        const raw = localStorage.getItem(getLocalTasksStorageKey(currentTaskListId))
        const nextTasks = raw ? (JSON.parse(raw) as Task[]) : []
        setTasks(Array.isArray(nextTasks) ? nextTasks : [])
        return
      }

      try {
        setIsLoadingTasks(true)
        const listTasks = await apiFetch<Task[]>(
          `/api/lists/${encodeURIComponent(currentTaskListId)}/tasks`
        )
        if (cancelled) return
        setTasks(listTasks || [])
      } catch (err: any) {
        console.error('Error loading tasks', err)
        toast.error('Failed to load tasks', {
          description: err?.message || 'Please try again.',
        })
      } finally {
        if (!cancelled) setIsLoadingTasks(false)
      }
    }

    loadTasks()
    return () => {
      cancelled = true
    }
  }, [currentTaskListId, isAnonymousMode])


  const currentTaskList =
    (taskLists || []).find((list) => list.id === currentTaskListId) || null

  // --- OTHER LOCAL SETTINGS (still localStorage-backed) ---

  // const [isMuted, setIsMuted] = useKV<boolean>('pomodoro-muted', false)
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('pomodoro-muted')
    return saved ? saved === 'true' : false
  })
  useEffect(() => {
    localStorage.setItem('pomodoro-muted', String(isMuted))
  }, [isMuted])

  // const [isCompact, setIsCompact] = useKV<boolean>('pomodoro-compact', false)
  const [isCompact, setIsCompact] = useState(() => {
    const saved = localStorage.getItem('pomodoro-compact')
    return saved ? saved === 'true' : false
  })
  useEffect(() => {
    localStorage.setItem('pomodoro-compact', String(isCompact))
  }, [isCompact])

  // const [backgroundImage, setBackgroundImage] = useKV<string | null>('pomodoro-background', null)
  const [backgroundImage, setBackgroundImage] = useState<string | null>(() => {
    return localStorage.getItem('pomodoro-background')
  })
  useEffect(() => {
    if (backgroundImage === null) {
      localStorage.removeItem('pomodoro-background')
    } else {
      localStorage.setItem('pomodoro-background', backgroundImage)
    }
  }, [backgroundImage])

  // const [backgroundOpacity, setBackgroundOpacity] = useKV<number>('pomodoro-background-opacity', 0.8)
  const [backgroundOpacity, setBackgroundOpacity] = useState(() => {
    const saved = localStorage.getItem('pomodoro-background-opacity')
    return saved ? Number(saved) : 0.8
  })
  useEffect(() => {
    localStorage.setItem(
      'pomodoro-background-opacity',
      backgroundOpacity.toString()
    )
  }, [backgroundOpacity])

  // const [statistics, setStatistics] = useKV<Statistics>('pomodoro-statistics', {...})
  const [statistics, setStatistics] = useState<Statistics>(() => {
    const saved = localStorage.getItem('pomodoro-statistics')
    return saved
      ? JSON.parse(saved)
      : {
          totalCompletedTasks: 0,
          totalCompletedIterations: 0,
          totalFocusTimeMinutes: 0,
          tasksCompletedToday: 0,
          focusTimeToday: 0,
          completedTaskHistory: [],
        }
  })
  useEffect(() => {
    localStorage.setItem('pomodoro-statistics', JSON.stringify(statistics))
  }, [statistics])

  const [allTasksCollapsed, setAllTasksCollapsed] = useState(false)
  const [showStatistics, setShowStatistics] = useState(false)

  // const [completedTasksCollapsed, setCompletedTasksCollapsed] = useKV<boolean>('pomodoro-completed-collapsed', true)
  const [completedTasksCollapsed, setCompletedTasksCollapsed] = useState(
    () => {
      const saved = localStorage.getItem('pomodoro-completed-collapsed')
      return saved ? saved === 'true' : true
    }
  )
  useEffect(() => {
    localStorage.setItem(
      'pomodoro-completed-collapsed',
      String(completedTasksCollapsed)
    )
  }, [completedTasksCollapsed])

  const timerRef = useRef<number | null>(null)
  const beepingRef = useRef<number | null>(null)
  const addTaskInputRef = useRef<HTMLInputElement>(null)

  const [timerState, setTimerState] = useState<TimerState>({
    phase: 'idle',
    remainingSeconds: getWorkDuration(),
    isRunning: false,
    currentTaskId: null,
    completedIterations: 0,
    needsAcknowledgment: false,
    isLongBreakNext: false,
  })

  const [currentTaskListIdForTimer, setCurrentTaskListIdForTimer] = useState<
    string | null
  >(null)

  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskIterations, setNewTaskIterations] = useState('1')
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [showStopDialog, setShowStopDialog] = useState(false)
  const [showAcknowledgmentDialog, setShowAcknowledgmentDialog] =
    useState(false)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false)

  // --- TIMER EFFECTS ---

  useEffect(() => {
    if (timerState.needsAcknowledgment) {
      setShowAcknowledgmentDialog(true)
      const beepId = startContinuousBeeping(
        isMuted || false,
        timerState.isLongBreakNext
      )
      beepingRef.current = beepId
    }

    return () => {
      if (beepingRef.current) {
        stopContinuousBeeping(beepingRef.current)
        beepingRef.current = null
      }
    }
  }, [timerState.needsAcknowledgment, timerState.isLongBreakNext, isMuted])

  useEffect(() => {
    if (timerState.isRunning && !timerState.needsAcknowledgment) {
      timerRef.current = window.setInterval(() => {
        setTimerState((prev) => {
          if (prev.remainingSeconds <= 1) {
            if (prev.phase === 'work') {
              const newCompletedIterations = prev.completedIterations + 1
              const isLongBreak =
                newCompletedIterations % ITERATIONS_BEFORE_LONG_BREAK === 0

              if (prev.currentTaskId) {
                setTasks((currentTasks) => {
                  return (currentTasks || []).map((task) => {
                    if (task.id === prev.currentTaskId) {
                      const taskCompletedIterations =
                        (task.completedIterations || 0) + 1
                      if (taskCompletedIterations > task.iterations) {
                        toast.success('Task iterations increased!', {
                          description: `${task.name} now has ${taskCompletedIterations} iterations`,
                        })
                        return {
                          ...task,
                          iterations: taskCompletedIterations,
                          completedIterations: taskCompletedIterations,
                        }
                      }
                      return {
                        ...task,
                        completedIterations: taskCompletedIterations,
                      }
                    }
                    return task
                  })
                })
              }

              setStatistics((currentStats) => {
                if (!currentStats)
                  return {
                    totalCompletedTasks: 0,
                    totalCompletedIterations: 1,
                    totalFocusTimeMinutes: 25,
                    tasksCompletedToday: 0,
                    focusTimeToday: 25,
                    completedTaskHistory: [],
                  }
                return {
                  ...currentStats,
                  totalCompletedIterations:
                    currentStats.totalCompletedIterations + 1,
                  totalFocusTimeMinutes:
                    currentStats.totalFocusTimeMinutes + 25,
                  focusTimeToday: currentStats.focusTimeToday + 25,
                }
              })

              return {
                ...prev,
                phase: prev.phase,
                remainingSeconds: 0,
                isRunning: false,
                completedIterations: newCompletedIterations,
                needsAcknowledgment: true,
                isLongBreakNext: isLongBreak,
              }
            } else {
              return {
                ...prev,
                remainingSeconds: 0,
                isRunning: false,
                needsAcknowledgment: true,
                isLongBreakNext: false,
              }
            }
          }

          return {
            ...prev,
            remainingSeconds: prev.remainingSeconds - 1,
          }
        })
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [timerState.isRunning, timerState.needsAcknowledgment, tasks, isMuted])

  useEffect(() => {
    const now = new Date()
    const lastResetDate = localStorage.getItem('pomodoro-last-reset-date')
    const today = now.toDateString()

    if (lastResetDate !== today) {
      setStatistics((currentStats) => {
        if (!currentStats)
          return {
            totalCompletedTasks: 0,
            totalCompletedIterations: 0,
            totalFocusTimeMinutes: 0,
            tasksCompletedToday: 0,
            focusTimeToday: 0,
            completedTaskHistory: [],
          }
        return {
          ...currentStats,
          tasksCompletedToday: 0,
          focusTimeToday: 0,
        }
      })
      localStorage.setItem('pomodoro-last-reset-date', today)
    }
  }, [])

  useEffect(() => {
    const checkRecurringTasks = () => {
      setTasks((currentTasks) => {
        const tasks = currentTasks || []
        let hasChanges = false

        const updatedTasks = tasks.map((task) => {
          if (shouldReactivateRecurringTask(task)) {
            hasChanges = true
            toast.success('Recurring task reactivated', {
              description: `${task.name} is ready to do again!`,
            })
            return {
              ...task,
              completed: false,
              completedIterations: 0,
            }
          }
          return task
        })

        if (hasChanges) {
          const incompleteTasks = updatedTasks.filter((t) => !t.completed)
          const completedTasks = updatedTasks.filter((t) => t.completed)
          const highPriorityTasks = incompleteTasks.filter(
            (t) => t.isHighPriority
          )
          const normalPriorityTasks = incompleteTasks.filter(
            (t) => !t.isHighPriority
          )
          return [...highPriorityTasks, ...normalPriorityTasks, ...completedTasks]
        }

        return tasks
      })
    }

    checkRecurringTasks()
    const interval = setInterval(checkRecurringTasks, 60000)
    return () => clearInterval(interval)
  }, [])

  // --- HELPERS ---

  const findNextTask = () => {
    return (tasks || []).find((task) => !task.completed)
  }

  const startTimer = () => {
    if (timerState.phase === 'idle') {
      const selectedTask = timerState.currentTaskId
        ? (tasks || []).find(
            (t) => t.id === timerState.currentTaskId && !t.completed
          )
        : null
      const nextTask = selectedTask || findNextTask()

      if (nextTask) {
        setTasks((currentTasks) => {
          const tasks = currentTasks || []
          const updatedTasks = tasks.map((t) =>
            t.id === nextTask.id ? { ...t, completedIterations: 0 } : t
          )
          const taskIndex = updatedTasks.findIndex((t) => t.id === nextTask.id)
          if (taskIndex > 0) {
            const [taskToMove] = updatedTasks.splice(taskIndex, 1)
            const incompleteTasks = updatedTasks.filter((t) => !t.completed)
            const completedTasks = updatedTasks.filter((t) => t.completed)
            return [taskToMove, ...incompleteTasks, ...completedTasks]
          }
          return updatedTasks
        })
      }

      setTimerState({
        phase: 'work',
        remainingSeconds: getWorkDuration(),
        isRunning: true,
        currentTaskId: nextTask?.id || null,
        completedIterations: 0,
        needsAcknowledgment: false,
        isLongBreakNext: false,
      })
      setCurrentTaskListIdForTimer(currentTaskListId || null)
    } else {
      setTimerState((prev) => ({ ...prev, isRunning: true }))
    }
  }

  const pauseTimer = () => {
    setTimerState((prev) => ({ ...prev, isRunning: false }))
  }

  const stopTimer = () => {
    setShowStopDialog(true)
  }

  const confirmStopTimer = () => {
    if (beepingRef.current) {
      stopContinuousBeeping(beepingRef.current)
      beepingRef.current = null
    }

    setTimerState({
      phase: 'idle',
      remainingSeconds: getWorkDuration(),
      isRunning: false,
      currentTaskId: null,
      completedIterations: 0,
      needsAcknowledgment: false,
      isLongBreakNext: false,
    })
    setCurrentTaskListIdForTimer(null)
    setShowStopDialog(false)
    setShowAcknowledgmentDialog(false)
    toast.info('Timer stopped')
  }

  const handleStartBreak = () => {
    if (beepingRef.current) {
      stopContinuousBeeping(beepingRef.current)
      beepingRef.current = null
    }

    const isLongBreak = timerState.isLongBreakNext

    setTimerState((prev) => ({
      ...prev,
      phase: isLongBreak ? 'longBreak' : 'break',
      remainingSeconds: isLongBreak
        ? getLongBreakDuration()
        : getShortBreakDuration(),
      isRunning: true,
      needsAcknowledgment: false,
      isLongBreakNext: false,
    }))
    setShowAcknowledgmentDialog(false)

    toast.success('Break started', {
      description: isLongBreak
        ? 'Enjoy your long break!'
        : 'Enjoy your short break!',
    })
  }

  const handleSkipBreak = () => {
    if (beepingRef.current) {
      stopContinuousBeeping(beepingRef.current)
      beepingRef.current = null
    }

    const nextTask = findNextTask()

    if (nextTask) {
      setTasks((currentTasks) =>
        (currentTasks || []).map((t) =>
          t.id === nextTask.id ? { ...t, completedIterations: 0 } : t
        )
      )
    }

    setTimerState({
      phase: 'work',
      remainingSeconds: getWorkDuration(),
      isRunning: true,
      currentTaskId: nextTask?.id || null,
      completedIterations: timerState.completedIterations,
      needsAcknowledgment: false,
      isLongBreakNext: false,
    })
    setCurrentTaskListIdForTimer(currentTaskListId || null)
    setShowAcknowledgmentDialog(false)

    if (nextTask) {
      toast.success('Break skipped', {
        description: `Starting: ${nextTask.name}`,
      })
    } else {
      toast.success('Break skipped', {
        description: 'Continuing work session',
      })
    }
  }

  // --- REST-backed TASK CRUD ---

  const addTask = async () => {
    if (!newTaskName.trim()) return
    if (!currentTaskListId) {
      toast.error('No list selected')
      return
    }

    const iterations = parseInt(newTaskIterations) || 1
    if (iterations < 1) {
      toast.error('Invalid iteration count')
      return
    }

    const newTask: Task = {
      id: `temp-${Date.now()}`,
      name: newTaskName.trim(),
      iterations,
      subtasks: [],
      completed: false,
      collapsed: false,
      // @ts-expect-error: listId may not exist yet in your Task type, but backend expects it
      listId: currentTaskListId,
    }

    if (isAnonymousMode || isLocalListId(currentTaskListId)) {
      const localTask: Task = {
        ...newTask,
        id: `local-task-${Date.now()}`,
      }
      setTasks((currentTasks) => {
        const nextTasks = [...(currentTasks || []), localTask]
        persistTasksForList(currentTaskListId, nextTasks)
        return nextTasks
      })
      setNewTaskName('')
      setNewTaskIterations('1')
      setIsAddingTask(false)
      toast.success('Task added')
      return
    }

    try {
      const created = await apiFetch<Task>(
        `/api/lists/${encodeURIComponent(currentTaskListId)}/tasks`,
        {
          method: 'POST',
          body: JSON.stringify(newTask),
        }
      )

      setTasks((currentTasks) => [...(currentTasks || []), created])
      setNewTaskName('')
      setNewTaskIterations('1')
      setIsAddingTask(false)
      toast.success('Task added')
    } catch (err: any) {
      console.error('Error creating task', err)
      toast.error('Failed to create task', {
        description: err?.message || 'Please try again.',
      })
    }
  }

  const addTaskFromTemplate = async (task: Task) => {
    if (!currentTaskListId) {
      toast.error('No list selected')
      return
    }

    const payload: Task = {
      ...task,
      id: `temp-${Date.now()}`,
      // @ts-expect-error: listId may not exist yet in your Task type, but backend expects it
      listId: currentTaskListId,
    }

    if (isAnonymousMode || isLocalListId(currentTaskListId)) {
      const created: Task = {
        ...payload,
        id: `local-task-${Date.now()}`,
      }
      setTasks((currentTasks) => {
        const nextTasks = [...(currentTasks || []), created]
        persistTasksForList(currentTaskListId, nextTasks)
        return nextTasks
      })
      toast.success('Template added', {
        description: `${created.name} will repeat ${
          created.recurrence ? `every ${created.recurrence.interval} ${created.recurrence.unit}` : ''
        }`,
      })
      return
    }

    try {
      const created = await apiFetch<Task>(
        `/api/lists/${encodeURIComponent(currentTaskListId)}/tasks`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )
      setTasks((currentTasks) => [...(currentTasks || []), created])
      toast.success('Template added', {
        description: `${
          created.name
        } will repeat ${
          // @ts-expect-error: recurrence may be optional
          created.recurrence ? `every ${created.recurrence.interval} ${created.recurrence.unit}` : ''
        }`,
      })
    } catch (err: any) {
      console.error('Error adding template task', err)
      toast.error('Failed to add template task', {
        description: err?.message || 'Please try again.',
      })
    }
  }

  const updateTask = async (taskId: string, updatedTask: Task) => {
    const oldTask = (tasks || []).find((t) => t.id === taskId)

    // optimistic UI update
    setTasks((currentTasks) => {
      const tasks = currentTasks || []
      let nextUpdatedTask = updatedTask

      if (oldTask && !oldTask.completed && updatedTask.completed) {
        const completedIterations =
          updatedTask.completedIterations || updatedTask.iterations

        if (updatedTask.recurrence?.enabled) {
          nextUpdatedTask = {
            ...updatedTask,
            recurrence: {
              ...updatedTask.recurrence,
              lastCompletedAt: Date.now(),
            },
          }
        }

        setStatistics((currentStats) => {
          if (!currentStats)
            return {
              totalCompletedTasks: 1,
              totalCompletedIterations: 0,
              totalFocusTimeMinutes: 0,
              tasksCompletedToday: 1,
              focusTimeToday: 0,
              completedTaskHistory: [
                {
                  taskName: updatedTask.name,
                  completedIterations,
                  completedAt: Date.now(),
                },
              ],
            }

          return {
            ...currentStats,
            totalCompletedTasks: currentStats.totalCompletedTasks + 1,
            tasksCompletedToday: currentStats.tasksCompletedToday + 1,
            completedTaskHistory: [
              {
                taskName: updatedTask.name,
                completedIterations,
                completedAt: Date.now(),
              },
              ...currentStats.completedTaskHistory,
            ],
          }
        })

        if (
          timerState.currentTaskId === taskId &&
          timerState.phase === 'work'
        ) {
          const nextTask = (currentTasks || []).find(
            (t) => t.id !== taskId && !t.completed
          )
          if (nextTask) {
            setTimerState((prev) => ({
              ...prev,
              currentTaskId: nextTask.id,
            }))
            toast.success('Task completed!', {
              description: `Moving to: ${nextTask.name}`,
              action: {
                label: 'Undo',
                onClick: () => {
                  updateTask(taskId, { ...updatedTask, completed: false })
                  setStatistics((currentStats) => {
                    if (!currentStats)
                      return {
                        totalCompletedTasks: 0,
                        totalCompletedIterations: 0,
                        totalFocusTimeMinutes: 0,
                        tasksCompletedToday: 0,
                        focusTimeToday: 0,
                        completedTaskHistory: [],
                      }
                    return {
                      ...currentStats,
                      totalCompletedTasks: Math.max(
                        0,
                        currentStats.totalCompletedTasks - 1
                      ),
                      tasksCompletedToday: Math.max(
                        0,
                        currentStats.tasksCompletedToday - 1
                      ),
                      completedTaskHistory:
                        currentStats.completedTaskHistory.filter(
                          (h) =>
                            h.taskName !== updatedTask.name ||
                            h.completedAt !==
                              currentStats.completedTaskHistory[0]
                                ?.completedAt
                        ),
                    }
                  })
                  toast.info('Task unmarked')
                },
              },
            })
          } else {
            toast.success('Task completed!', {
              description: 'No more tasks remaining',
              action: {
                label: 'Undo',
                onClick: () => {
                  updateTask(taskId, { ...updatedTask, completed: false })
                  setStatistics((currentStats) => {
                    if (!currentStats)
                      return {
                        totalCompletedTasks: 0,
                        totalCompletedIterations: 0,
                        totalFocusTimeMinutes: 0,
                        tasksCompletedToday: 0,
                        focusTimeToday: 0,
                        completedTaskHistory: [],
                      }
                    return {
                      ...currentStats,
                      totalCompletedTasks: Math.max(
                        0,
                        currentStats.totalCompletedTasks - 1
                      ),
                      tasksCompletedToday: Math.max(
                        0,
                        currentStats.tasksCompletedToday - 1
                      ),
                      completedTaskHistory:
                        currentStats.completedTaskHistory.filter(
                          (h) =>
                            h.taskName !== updatedTask.name ||
                            h.completedAt !==
                              currentStats.completedTaskHistory[0]
                                ?.completedAt
                        ),
                    }
                  })
                  toast.info('Task unmarked')
                },
              },
            })
          }
        } else {
          toast.success('Task completed!', {
            description: `${updatedTask.name} marked as complete`,
            action: {
              label: 'Undo',
              onClick: () => {
                updateTask(taskId, { ...updatedTask, completed: false })
                setStatistics((currentStats) => {
                  if (!currentStats)
                    return {
                      totalCompletedTasks: 0,
                      totalCompletedIterations: 0,
                      totalFocusTimeMinutes: 0,
                      tasksCompletedToday: 0,
                      focusTimeToday: 0,
                      completedTaskHistory: [],
                    }
                  return {
                    ...currentStats,
                    totalCompletedTasks: Math.max(
                      0,
                      currentStats.totalCompletedTasks - 1
                    ),
                    tasksCompletedToday: Math.max(
                      0,
                      currentStats.tasksCompletedToday - 1
                    ),
                    completedTaskHistory:
                      currentStats.completedTaskHistory.filter(
                        (h) =>
                          h.taskName !== updatedTask.name ||
                          h.completedAt !==
                            currentStats.completedTaskHistory[0]?.completedAt
                      ),
                  }
                })
                toast.info('Task unmarked')
              },
            },
          })
        }
      }

      if (
        oldTask &&
        oldTask.isHighPriority !== updatedTask.isHighPriority &&
        updatedTask.isHighPriority &&
        !updatedTask.completed
      ) {
        toast.success('High priority set', {
          description: `${updatedTask.name} moved to top`,
        })
      }

      const updatedTasks = tasks.map((t) =>
        t.id === taskId ? updatedTask : t
      )
      const incompleteTasks = updatedTasks.filter((t) => !t.completed)
      const completedTasks = updatedTasks.filter((t) => t.completed)
      const highPriorityTasks = incompleteTasks.filter((t) => t.isHighPriority)
      const normalPriorityTasks = incompleteTasks.filter(
        (t) => !t.isHighPriority
      )
      return [...highPriorityTasks, ...normalPriorityTasks, ...completedTasks]
    })

    if ((isAnonymousMode || isLocalListId(currentTaskListId)) && currentTaskListId) {
      const nextTasks = (tasks || []).map((t) =>
        t.id === taskId ? updatedTask : t
      )
      persistTasksForList(currentTaskListId, nextTasks)
      return
    }

    // Persist to backend
    try {
      await apiFetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        body: JSON.stringify(updatedTask),
      })
    } catch (err: any) {
      console.error('Error updating task', err)
      toast.error('Failed to update task', {
        description: err?.message || 'Changes may not be saved.',
      })
    }
  }

  const selectTask = (taskId: string) => {
    const task = (tasks || []).find((t) => t.id === taskId)
    if (!task || task.completed) return

    const wasRunning = timerState.isRunning

    if (timerState.phase === 'work') {
      setTimerState((prev) => ({
        ...prev,
        currentTaskId: taskId,
        isRunning: wasRunning,
      }))
      toast.success('Task changed', {
        description: `Now working on: ${task.name}`,
      })
    } else if (timerState.phase !== 'idle') {
      toast.info('Cannot change task', {
        description: 'You can only change tasks during work sessions',
      })
    } else {
      setTimerState((prev) => ({ ...prev, currentTaskId: taskId }))
    }
  }

  const deleteTask = async (taskId: string) => {
    const task = (tasks || []).find((t) => t.id === taskId)
    if (!task?.completed && timerState.currentTaskId === taskId && timerState.isRunning) {
      toast.error('Cannot delete', {
        description: 'Cannot delete the current running task',
      })
      return
    }

    // optimistic
    const nextTasks = (tasks || []).filter((t) => t.id !== taskId)
    setTasks(nextTasks)
    if ((isAnonymousMode || isLocalListId(currentTaskListId)) && currentTaskListId) {
      persistTasksForList(currentTaskListId, nextTasks)
    }
    toast.success('Task deleted')

    if (isAnonymousMode || isLocalListId(currentTaskListId)) {
      return
    }

    try {
      await apiFetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
      })
    } catch (err: any) {
      console.error('Error deleting task', err)
      toast.error('Failed to delete task from server', {
        description: err?.message || 'It may reappear on reload.',
      })
    }
  }

  const bulkDeleteCompletedTasks = async () => {
    const completedTasks = (tasks || []).filter((t) => t.completed)
    if (completedTasks.length === 0) {
      toast.info('No completed tasks to delete')
      return
    }

    // optimistic
    const nextTasks = (tasks || []).filter((t) => !t.completed)
    setTasks(nextTasks)
    if ((isAnonymousMode || isLocalListId(currentTaskListId)) && currentTaskListId) {
      persistTasksForList(currentTaskListId, nextTasks)
    }
    setShowBulkDeleteDialog(false)
    toast.success(
      `Deleted ${completedTasks.length} completed ${
        completedTasks.length === 1 ? 'task' : 'tasks'
      }`
    )

    if (isAnonymousMode || isLocalListId(currentTaskListId)) {
      return
    }

    // naive per-task delete; you can later add a bulk endpoint
    try {
      await Promise.all(
        completedTasks.map((t) =>
          apiFetch(`/api/tasks/${encodeURIComponent(t.id)}`, {
            method: 'DELETE',
          })
        )
      )
    } catch (err: any) {
      console.error('Error bulk deleting tasks', err)
      toast.error('Some tasks may not have been deleted on the server', {
        description: err?.message || 'Check after reload.',
      })
    }
  }

  // --- LIST CRUD (REST-backed) ---

  const createTaskList = async (name: string) => {
    if (isAnonymousMode) {
      const newList: TaskList = {
        id: `local-${Date.now()}`,
        name,
        createdAt: Date.now(),
      }
      setTaskLists((currentLists) => {
        const nextLists = [...(currentLists || []), newList]
        writeLocalLists(nextLists.filter((list) => list.id !== 'personal'))
        return nextLists
      })
      setCurrentTaskListId(newList.id)
      persistTasksForList(newList.id, [])
      toast.success('List created')
      return
    }

    try {
      const newList = await apiFetch<TaskList>('/api/lists', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      setTaskLists((currentLists) => [...(currentLists || []), newList])
      setCurrentTaskListId(newList.id)
      toast.success('List created')
    } catch (err: any) {
      console.error('Error creating list', err)
      toast.error('Failed to create list', {
        description: err?.message || 'Please try again.',
      })
    }
  }

  const renameTaskList = async (listId: string, newName: string) => {
    if (isAnonymousMode || isLocalListId(listId)) {
      setTaskLists((currentLists) => {
        const nextLists = (currentLists || []).map((list) =>
          list.id === listId ? { ...list, name: newName } : list
        )
        writeLocalLists(nextLists.filter((list) => list.id !== 'personal'))
        return nextLists
      })
      toast.success('List renamed')
      return
    }

    try {
      const updated = await apiFetch<TaskList>(
        `/api/lists/${encodeURIComponent(listId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: newName }),
        }
      )
      setTaskLists((currentLists) =>
        (currentLists || []).map((list) =>
          list.id === listId ? updated : list
        )
      )
      toast.success('List renamed')
    } catch (err: any) {
      console.error('Error renaming list', err)
      toast.error('Failed to rename list', {
        description: err?.message || 'Please try again.',
      })
    }
  }

  const deleteTaskList = async (listId: string) => {
    const lists = taskLists || []
    if (lists.length <= 1) {
      toast.error('Cannot delete the last list')
      return
    }

    // optimistic
    setTaskLists((currentLists) => {
      const updatedLists = (currentLists || []).filter(
        (list) => list.id !== listId
      )
      if (currentTaskListId === listId && updatedLists.length > 0) {
        setCurrentTaskListId(updatedLists[0].id)
      }
      if (isAnonymousMode || isLocalListId(listId)) {
        writeLocalLists(updatedLists.filter((list) => list.id !== 'personal'))
      }
      return updatedLists
    })

    if (isAnonymousMode || isLocalListId(listId)) {
      localStorage.removeItem(getLocalTasksStorageKey(listId))
      toast.success('List deleted')
      return
    }

    try {
      await apiFetch(`/api/lists/${encodeURIComponent(listId)}`, {
        method: 'DELETE',
      })
      toast.success('List deleted')
    } catch (err: any) {
      console.error('Error deleting list', err)
      toast.error('Failed to delete list from server', {
        description: err?.message || 'It may reappear on reload.',
      })
    }
  }

  const duplicateTaskList = async (listId: string) => {
    const listToDuplicate = (taskLists || []).find((list) => list.id === listId)
    if (!listToDuplicate) return

    if (isAnonymousMode || isLocalListId(listId)) {
      const duplicatedList: TaskList = {
        id: `local-${Date.now()}`,
        name: `${listToDuplicate.name} (Copy)`,
        createdAt: Date.now(),
      }
      const sourceTasksRaw = localStorage.getItem(getLocalTasksStorageKey(listId))
      const sourceTasks = sourceTasksRaw ? (JSON.parse(sourceTasksRaw) as Task[]) : []
      const duplicatedTasks = sourceTasks.map((task) => ({
        ...task,
        id: `local-task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      }))

      setTaskLists((currentLists) => {
        const nextLists = [...(currentLists || []), duplicatedList]
        writeLocalLists(nextLists.filter((list) => list.id !== 'personal'))
        return nextLists
      })
      persistTasksForList(duplicatedList.id, duplicatedTasks)
      setCurrentTaskListId(duplicatedList.id)
      toast.success('Task list duplicated')
      return
    }

    // For now, duplicate as empty list; you can later add server-side cloning
    try {
      const newList = await apiFetch<TaskList>('/api/lists', {
        method: 'POST',
        body: JSON.stringify({ name: `${listToDuplicate.name} (Copy)` }),
      })
      setTaskLists((currentLists) => [...(currentLists || []), newList])
      setCurrentTaskListId(newList.id)
      toast.success('Task list duplicated')
    } catch (err: any) {
      console.error('Error duplicating list', err)
      toast.error('Failed to duplicate list', {
        description: err?.message || 'Please try again.',
      })
    }
  }

  // --- UI helpers ---

  const toggleAllTasksCollapse = () => {
    const newCollapsedState = !allTasksCollapsed
    setTasks((currentTasks) =>
      (currentTasks || []).map((t) => ({ ...t, collapsed: newCollapsedState }))
    )
    setAllTasksCollapsed(newCollapsedState)
  }

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId)
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault()
    if (draggedTaskId && draggedTaskId !== taskId) {
      setDragOverTaskId(taskId)
    }
  }

  const handleDrop = (targetTaskId: string) => {
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      return
    }

    setTasks((currentTasks) => {
      const tasks = currentTasks || []
      const draggedIndex = tasks.findIndex((t) => t.id === draggedTaskId)
      const targetIndex = tasks.findIndex((t) => t.id === targetTaskId)

      if (draggedIndex === -1 || targetIndex === -1) {
        return tasks
      }

      const newTasks = [...tasks]
      const [draggedTask] = newTasks.splice(draggedIndex, 1)
      newTasks.splice(targetIndex, 0, draggedTask)

      const incompleteTasks = newTasks.filter((t) => !t.completed)
      const completedTasks = newTasks.filter((t) => t.completed)
      return [...incompleteTasks, ...completedTasks]
    })

    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  const handleTouchReorder = (
    taskId: string,
    direction: 'up' | 'down'
  ) => {
    let didMove = false

    setTasks((currentTasks) => {
      const tasks = currentTasks || []
      const taskToMove = tasks.find((t) => t.id === taskId)
      if (!taskToMove) return tasks

      const incomplete = tasks.filter((t) => !t.completed)
      const completed = tasks.filter((t) => t.completed)
      const targetGroup = taskToMove.completed ? completed : incomplete

      const taskIndex = targetGroup.findIndex((t) => t.id === taskId)
      if (taskIndex === -1) return tasks

      const newIndex = direction === 'up' ? taskIndex - 1 : taskIndex + 1
      if (newIndex < 0 || newIndex >= targetGroup.length) return tasks

      didMove = true
      const reorderedGroup = [...targetGroup]
      const [movedTask] = reorderedGroup.splice(taskIndex, 1)
      reorderedGroup.splice(newIndex, 0, movedTask)

      return taskToMove.completed
        ? [...incomplete, ...reorderedGroup]
        : [...reorderedGroup, ...completed]
    })

    if (didMove) {
      toast.success(`Task moved ${direction}`)
    }
  }

  const handleBackgroundUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result
      if (typeof result === 'string') {
        setBackgroundImage(result)
        toast.success('Background image uploaded')
      }
    }
    reader.readAsDataURL(file)
  }

  const PRESET_BACKGROUNDS = [
    {
      id: 'gradient-1',
      name: 'Purple Wave',
      url: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      id: 'gradient-2',
      name: 'Ocean Blue',
      url: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
    {
      id: 'gradient-3',
      name: 'Sunset',
      url: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    },
    {
      id: 'gradient-4',
      name: 'Forest',
      url: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)',
    },
    {
      id: 'gradient-5',
      name: 'Midnight',
      url: 'linear-gradient(135deg, #2e3192 0%, #1bffff 100%)',
    },
    {
      id: 'gradient-6',
      name: 'Rose Gold',
      url: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
    },
    {
      id: 'pattern-1',
      name: 'Dots',
      url: 'radial-gradient(circle, oklch(0.45 0.15 260) 1px, transparent 1px)',
      style: { backgroundSize: '20px 20px' },
    },
    {
      id: 'pattern-2',
      name: 'Grid',
      url: 'linear-gradient(oklch(0.45 0.15 260 / 0.1) 1px, transparent 1px), linear-gradient(90deg, oklch(0.45 0.15 260 / 0.1) 1px, transparent 1px)',
      style: { backgroundSize: '30px 30px' },
    },
    {
      id: 'pattern-3',
      name: 'Diagonal',
      url: 'repeating-linear-gradient(45deg, transparent, transparent 10px, oklch(0.45 0.15 260 / 0.05) 10px, oklch(0.45 0.15 260 / 0.05) 20px)',
      style: {},
    },
    {
      id: 'mesh-1',
      name: 'Purple Mesh',
      url: 'radial-gradient(at 0% 0%, oklch(0.45 0.15 260) 0px, transparent 50%), radial-gradient(at 100% 0%, oklch(0.55 0.20 300) 0px, transparent 50%), radial-gradient(at 100% 100%, oklch(0.50 0.18 280) 0px, transparent 50%), radial-gradient(at 0% 100%, oklch(0.60 0.15 250) 0px, transparent 50%)',
      style: { backgroundColor: 'oklch(0.98 0.002 240)' },
    },
    {
      id: 'mesh-2',
      name: 'Blue Mesh',
      url: 'radial-gradient(at 0% 0%, oklch(0.60 0.20 220) 0px, transparent 50%), radial-gradient(at 100% 0%, oklch(0.55 0.18 200) 0px, transparent 50%), radial-gradient(at 100% 100%, oklch(0.65 0.15 240) 0px, transparent 50%), radial-gradient(at 0% 100%, oklch(0.50 0.22 210) 0px, transparent 50%)',
      style: { backgroundColor: 'oklch(0.98 0.002 240)' },
    },
    {
      id: 'mesh-3',
      name: 'Warm Mesh',
      url: 'radial-gradient(at 0% 0%, oklch(0.70 0.15 60) 0px, transparent 50%), radial-gradient(at 100% 0%, oklch(0.65 0.18 40) 0px, transparent 50%), radial-gradient(at 100% 100%, oklch(0.60 0.20 20) 0px, transparent 50%), radial-gradient(at 0% 100%, oklch(0.75 0.12 80) 0px, transparent 50%)',
      style: { backgroundColor: 'oklch(0.98 0.002 240)' },
    },
  ]

  const getBackgroundStyle = () => {
    if (!backgroundImage) return undefined

    const isPreset = !backgroundImage.startsWith('data:')
    if (isPreset) {
      const preset = PRESET_BACKGROUNDS.find((p) => p.id === backgroundImage)
      if (preset) {
        return {
          backgroundImage: preset.url,
          ...(preset.style || {}),
        }
      }
    }

    return {
      backgroundImage: `url(${backgroundImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
    }
  }

  const tasksList = tasks || []
  const totalIterations = calculateTotalIterations(tasksList)
  const totalTime = calculateTotalTime(totalIterations)

  const currentTask = (() => {
    if (!timerState.currentTaskId) return null

    if (currentTaskListIdForTimer === currentTaskListId) {
      return tasksList.find((t) => t.id === timerState.currentTaskId)
    }

    if (!currentTaskListIdForTimer) return null

    const timerListTasks = tasksByListId[currentTaskListIdForTimer] || []
    return timerListTasks.find((t) => t.id === timerState.currentTaskId) || null
  })()

  const currentTaskListName = (() => {
    if (!currentTaskListIdForTimer) return null
    return (taskLists || []).find(
      (list) => list.id === currentTaskListIdForTimer
    )?.name
  })()

  const incompleteTasks = tasksList.filter((t) => !t.completed)
  const completedTasks = tasksList.filter((t) => t.completed)
  const completedTasksCount = completedTasks.length

  return (
    <>
      <Toaster position="top-center" duration={3000} closeButton />
      <div
        className="min-h-screen bg-background p-3 sm:p-4 relative"
        style={getBackgroundStyle()}
      >
        {backgroundImage && (
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{
              backgroundColor: `oklch(from var(--background) l c h / ${
                1 - (backgroundOpacity || 0.8)
              })`,
            }}
          />
        )}

        <div
          className={`mx-auto ${
            isCompact ? 'max-w-sm' : 'max-w-2xl'
          } space-y-4 relative z-10`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TaskListSelector
              taskLists={taskLists || []}
              currentTaskListId={currentTaskListId || 'default'}
              onSelectTaskList={setCurrentTaskListId}
              onCreateTaskList={createTaskList}
              onRenameTaskList={renameTaskList}
              onDeleteTaskList={deleteTaskList}
              onDuplicateTaskList={duplicateTaskList}
              onShowStatistics={() => setShowStatistics(true)}
              backgroundImage={backgroundImage || null}
              backgroundOpacity={backgroundOpacity || 0.8}
              onBackgroundChange={setBackgroundImage}
              onOpacityChange={setBackgroundOpacity}
              onUpload={handleBackgroundUpload}
              isAuthenticated={isAuthenticated}
              onLogin={() => setShowLoginOverlay(true)}
              onLogout={redirectToLogout}
            />
            {!isCompact && (
              <h1 className="hidden md:block font-display text-2xl font-bold text-foreground absolute left-1/2 -translate-x-1/2">
                Pomodoro Timer
              </h1>
            )}

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoginClick}
                title={isAuthenticated ? 'Logout' : 'Login'}
              >
                {isAuthenticated ? 'Logout' : 'Login'}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCompact((c) => !c)}
                title={isCompact ? 'Expand view' : 'Compact view'}
              >
                {isCompact ? <SquaresFour size={20} /> : <ListDashes size={20} />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsMuted((m) => {
                    const newMutedState = !m
                    if (newMutedState) {
                      toast.warning('Sound muted', {
                        description:
                          'You will not hear alerts when sessions complete',
                      })
                    } else {
                      toast.success('Sound enabled', {
                        description:
                          'You will hear alerts when sessions complete',
                      })
                    }
                    return newMutedState
                  })
                }}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <BellSlash size={20} /> : <Bell size={20} />}
              </Button>
            </div>
          </div>

          {isAuthenticated && authDisplayName && (
            <p className="text-xs text-muted-foreground text-right -mt-2">
              Signed in as {authDisplayName}
            </p>
          )}

          <TimerDisplay
            phase={timerState.phase}
            remainingSeconds={timerState.remainingSeconds}
            completedIterations={timerState.completedIterations}
            isCompact={isCompact}
            isRunning={timerState.isRunning}
            isMuted={isMuted}
          />

          {timerState.phase !== 'idle' && (
            <Card
              className={`p-3 bg-accent/10 border-accent ${
                isCompact ? 'p-2' : 'p-3'
              }`}
            >
              <p
                className={`text-muted-foreground ${
                  isCompact ? 'text-xs' : 'text-sm'
                }`}
              >
                Current Task
                {currentTaskListName && (
                  <span className="ml-2 text-xs opacity-70">
                    ({currentTaskListName})
                  </span>
                )}
              </p>
              <p
                className={`font-medium ${
                  isCompact ? 'text-sm' : ''
                }`}
              >
                {currentTask
                  ? currentTask.name
                  : 'Focus Session (No task selected)'}
              </p>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            {!timerState.isRunning ? (
              <Button onClick={startTimer} className="flex-1" size="lg">
                <Play size={20} className="mr-2" />
                {timerState.phase === 'idle' ? 'Start' : 'Resume'}
              </Button>
            ) : (
              <Button
                onClick={pauseTimer}
                variant="secondary"
                className="flex-1"
                size="lg"
              >
                <Pause size={20} className="mr-2" />
                Pause
              </Button>
            )}

            {timerState.phase !== 'idle' && (
              <Button onClick={stopTimer} variant="outline" size="lg">
                <Stop size={20} />
              </Button>
            )}
          </div>

          {!isCompact && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-medium">Tasks</h2>
                    {totalIterations > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {totalIterations} iterations ·{' '}
                        {formatTimeDisplay(
                          totalTime.days,
                          totalTime.hours,
                          totalTime.minutes
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap justify-end">
                    {tasksList.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleAllTasksCollapse}
                      >
                        {allTasksCollapsed ? 'Expand All' : 'Collapse All'}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplatesDialog(true)}
                      title="Browse recurring task templates"
                    >
                      <Books size={16} className="mr-1" />
                      Templates
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => setIsAddingTask(true)}
                      data-add-task-button
                    >
                      <Plus size={16} className="mr-1" />
                      Add Task
                    </Button>
                  </div>
                </div>

                {isAddingTask && (
                  <Card className="p-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex gap-2 flex-1">
                        <Input
                          ref={addTaskInputRef}
                          id="task-name"
                          placeholder="Task name"
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void addTask()
                              setIsAddingTask(true)
                              setTimeout(
                                () => addTaskInputRef.current?.focus(),
                                50
                              )
                            }
                          }}
                          className="flex-1 min-w-0"
                          autoFocus
                        />
                        <Input
                          id="task-iterations"
                          type="number"
                          min="1"
                          value={newTaskIterations}
                          placeholder="Iter"
                          onChange={(e) =>
                            setNewTaskIterations(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void addTask()
                              setIsAddingTask(true)
                              setTimeout(
                                () => addTaskInputRef.current?.focus(),
                                50
                              )
                            }
                          }}
                          className="w-16 sm:w-20"
                        />
                      </div>

                      <div className="flex gap-2 sm:gap-2">
                        <Button
                          onClick={() => {
                            void addTask()
                            setIsAddingTask(true)
                            setTimeout(
                              () => addTaskInputRef.current?.focus(),
                              50
                            )
                          }}
                          className="flex-1 sm:flex-none"
                        >
                          Add
                        </Button>
                        <Button
                          onClick={() => {
                            setIsAddingTask(false)
                          }}
                          variant="outline"
                          className="flex-1 sm:flex-none"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                <ScrollArea className="h-[55vh] sm:h-[400px]">
                  <div className="space-y-2">
                    <AnimatePresence>
                      {isLoadingTasks ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-center py-12 text-muted-foreground"
                        >
                          Loading tasks...
                        </motion.div>
                      ) : tasksList.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-center py-12 text-muted-foreground"
                        >
                          <p>No tasks yet</p>
                        </motion.div>
                      ) : (
                        <>
                          {incompleteTasks.map((task) => (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -100 }}
                            >
                              <TaskItem
                                task={task}
                                onUpdate={(updatedTask) =>
                                  void updateTask(task.id, updatedTask)
                                }
                                onDelete={() => void deleteTask(task.id)}
                                isActive={task.id === timerState.currentTaskId}
                                onDragStart={() => handleDragStart(task.id)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => handleDragOver(e, task.id)}
                                onDrop={() => handleDrop(task.id)}
                                isDragging={draggedTaskId === task.id}
                                isDragOver={dragOverTaskId === task.id}
                                onSelect={() => selectTask(task.id)}
                                onTouchReorder={(direction) =>
                                  handleTouchReorder(task.id, direction)
                                }
                                onMoveUp={() => handleTouchReorder(task.id, 'up')}
                                onMoveDown={() => handleTouchReorder(task.id, 'down')}
                                canMoveUp={incompleteTasks.findIndex((t) => t.id === task.id) > 0}
                                canMoveDown={incompleteTasks.findIndex((t) => t.id === task.id) < incompleteTasks.length - 1}
                              />
                            </motion.div>
                          ))}

                          {completedTasks.length > 0 && (
                            <Collapsible
                              open={!completedTasksCollapsed}
                              onOpenChange={(open) =>
                                setCompletedTasksCollapsed(!open)
                              }
                            >
                              <div className="flex items-center justify-between mt-4 mb-2">
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1"
                                  >
                                    <span className="text-muted-foreground">
                                      Completed ({completedTasksCount})
                                    </span>
                                    <CaretDown
                                      size={16}
                                      className={`transition-transform ${
                                        completedTasksCollapsed
                                          ? ''
                                          : 'rotate-180'
                                      }`}
                                    />
                                  </Button>
                                </CollapsibleTrigger>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setShowBulkDeleteDialog(true)
                                  }
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Delete all completed tasks"
                                >
                                  <TrashSimple
                                    size={16}
                                    className="mr-1"
                                  />
                                  Delete All
                                </Button>
                              </div>

                              <CollapsibleContent className="space-y-2 mt-2">
                                {completedTasks.map((task) => (
                                  <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                  >
                                    <TaskItem
                                      task={task}
                                      onUpdate={(updatedTask) =>
                                        void updateTask(task.id, updatedTask)
                                      }
                                      onDelete={() =>
                                        void deleteTask(task.id)
                                      }
                                      isActive={
                                        task.id === timerState.currentTaskId
                                      }
                                      onDragStart={() =>
                                        handleDragStart(task.id)
                                      }
                                      onDragEnd={handleDragEnd}
                                      onDragOver={(e) =>
                                        handleDragOver(e, task.id)
                                      }
                                      onDrop={() => handleDrop(task.id)}
                                      isDragging={draggedTaskId === task.id}
                                      isDragOver={dragOverTaskId === task.id}
                                      onSelect={() => selectTask(task.id)}
                                      onTouchReorder={(direction) =>
                                        handleTouchReorder(task.id, direction)
                                      }
                                      onMoveUp={() => handleTouchReorder(task.id, 'up')}
                                      onMoveDown={() => handleTouchReorder(task.id, 'down')}
                                      canMoveUp={completedTasks.findIndex((t) => t.id === task.id) > 0}
                                      canMoveDown={completedTasks.findIndex((t) => t.id === task.id) < completedTasks.length - 1}
                                    />
                                  </motion.div>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>
      </div>

      {showLoginOverlay && !isAuthenticated && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
          <div className="min-h-screen flex items-center justify-center p-6">
            <Card className="w-full max-w-md p-6 space-y-4 border shadow-xl">
              <div className="space-y-1 text-center">
                <h2 className="text-2xl font-semibold">Sign in</h2>
                <p className="text-sm text-muted-foreground">
                  Choose a provider to continue.
                </p>
              </div>

              <div className="space-y-3">
                {LOGIN_PROVIDERS.map((provider) => (
                  <Button
                    key={provider}
                    className="w-full"
                    size="lg"
                    onClick={() => redirectToLogin(provider)}
                  >
                    {provider === 'google' ? 'Login with Google' : 'Login with Facebook'}
                  </Button>
                ))}
              </div>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowLoginOverlay(false)}
              >
                Continue without login
              </Button>
            </Card>
          </div>
        </div>
      )}

      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Timer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop the timer? Your progress will be
              reset and you&apos;ll need to start over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStopTimer}>
              Stop Timer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showAcknowledgmentDialog}
        onOpenChange={(open) => !open && setShowAcknowledgmentDialog(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {timerState.phase === 'work'
                ? 'Work Session Complete!'
                : 'Break Complete!'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {timerState.phase === 'work'
                ? timerState.isLongBreakNext
                  ? 'Great work! Time for a long break.'
                  : 'Great work! Time for a short break.'
                : 'Ready to get back to work?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {timerState.phase === 'work' ? (
              <>
                <AlertDialogCancel onClick={handleSkipBreak}>
                  Skip Break
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleStartBreak}>
                  Start Break
                </AlertDialogAction>
              </>
            ) : (
              <>
                <AlertDialogCancel onClick={handleSkipBreak}>
                  Skip to Next Task
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleSkipBreak}>
                  Continue
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StatisticsDialog
        open={showStatistics}
        onOpenChange={setShowStatistics}
        statistics={
          statistics || {
            totalCompletedTasks: 0,
            totalCompletedIterations: 0,
            totalFocusTimeMinutes: 0,
            tasksCompletedToday: 0,
            focusTimeToday: 0,
            completedTaskHistory: [],
          }
        }
      />

      <AlertDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Completed Tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {completedTasksCount}{' '}
              completed{' '}
              {completedTasksCount === 1 ? 'task' : 'tasks'}? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void bulkDeleteCompletedTasks()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskTemplatesDialog
        open={showTemplatesDialog}
        onOpenChange={setShowTemplatesDialog}
        onAddTask={(task) => void addTaskFromTemplate(task)}
        existingTasks={tasks}
      />
    </>
  )
}

export default App




// import { useState, useEffect, useRef } from 'react'
// //import { useKV } from '@github/spark/hooks'
// import { Task, TimerState, Statistics, TaskList } from '@/lib/types'
// import {
//   calculateTotalIterations,
//   calculateTotalTime,
//   formatTimeDisplay,
//   startContinuousBeeping,
//   stopContinuousBeeping,
//   getWorkDuration,
//   getShortBreakDuration,
//   getLongBreakDuration,
//   ITERATIONS_BEFORE_LONG_BREAK,
//   shouldReactivateRecurringTask
// } from '@/lib/timer-utils'
// import { TimerDisplay } from '@/components/TimerDisplay'
// import { TaskItem } from '@/components/TaskItem'
// import { StatisticsDialog } from '@/components/StatisticsDialog'
// //import TaskListSelector from '@/components/TaskListSelector'
// import { TaskTemplatesDialog } from '@/components/TaskTemplatesDialog'
// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import { Card } from '@/components/ui/card'
// import { ScrollArea } from '@/components/ui/scroll-area'
// import { Separator } from '@/components/ui/separator'
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
// } from '@/components/ui/alert-dialog'
// import {
//   Collapsible,
//   CollapsibleContent,
//   CollapsibleTrigger,
// } from '@/components/ui/collapsible'
// import { Play, Pause, Plus, BellSlash, Bell, ListDashes, SquaresFour, Stop, CaretDown, TrashSimple, Books } from '@phosphor-icons/react'
// import { toast, Toaster } from 'sonner'
// import { motion, AnimatePresence } from 'framer-motion'

// function App() {
//   // `const [taskLists, setTaskLists] = useKV<TaskList[]>('pomodoro-task-lists', [
//   //   {
//   //     id: 'default',
//   //     name: 'Personal',
//   //     tasks: [],
//   //     createdAt: Date.now()
//   //   }
//   // ])`
  
//   const [taskLists, setTaskLists] = useState<TaskList[]>(() => {
//     const saved = localStorage.getItem("pomodoro-task-lists")
//     return saved
//       ? JSON.parse(saved)
//       : [
//           {
//             id: "default",
//             name: "Personal",
//             tasks: [],
//             createdAt: Date.now()
//           }
//         ]
//   })

//   useEffect(() => {
//     localStorage.setItem("pomodoro-task-lists", JSON.stringify(taskLists))
//   }, [taskLists])

//   //const [currentTaskListId, setCurrentTaskListId] = useKV<string>('pomodoro-current-list-id', 'default')
//   const [currentTaskListId, setCurrentTaskListId] = useState(() => {
//     return localStorage.getItem("pomodoro-current-list-id") || "default"
//   })

//   useEffect(() => {
//     localStorage.setItem("pomodoro-current-list-id", currentTaskListId)
//   }, [currentTaskListId])

//   //const [isMuted, setIsMuted] = useKV<boolean>('pomodoro-muted', false)
//   const [isMuted, setIsMuted] = useState(() => {
//     const saved = localStorage.getItem("pomodoro-muted")
//     return saved ? saved === "true" : false
//   })

//   useEffect(() => {
//     localStorage.setItem("pomodoro-muted", String(isMuted))
//   }, [isMuted])

//   //const [isCompact, setIsCompact] = useKV<boolean>('pomodoro-compact', false)
//   const [isCompact, setIsCompact] = useState(() => {
//     const saved = localStorage.getItem("pomodoro-compact")
//     return saved ? saved === "true" : false
//   })

//   useEffect(() => {
//     localStorage.setItem("pomodoro-compact", String(isCompact))
//   }, [isCompact])

//  // const [backgroundImage, setBackgroundImage] = useKV<string | null>('pomodoro-background', null)
//   const [backgroundImage, setBackgroundImage] = useState<string | null>(() => {
//     return localStorage.getItem("pomodoro-background")
//   })

//   useEffect(() => {
//     if (backgroundImage === null) {
//       localStorage.removeItem("pomodoro-background")
//     } else {
//       localStorage.setItem("pomodoro-background", backgroundImage)
//     }
//   }, [backgroundImage])

//   //const [backgroundOpacity, setBackgroundOpacity] = useKV<number>('pomodoro-background-opacity', 0.8)
//   const [backgroundOpacity, setBackgroundOpacity] = useState(() => {
//     const saved = localStorage.getItem("pomodoro-background-opacity")
//     return saved ? Number(saved) : 0.8
//   })

//   useEffect(() => {
//     localStorage.setItem("pomodoro-background-opacity", backgroundOpacity.toString())
//   }, [backgroundOpacity])
  
//   // const [statistics, setStatistics] = useKV<Statistics>('pomodoro-statistics', {
//   //   totalCompletedTasks: 0,
//   //   totalCompletedIterations: 0,
//   //   totalFocusTimeMinutes: 0,
//   //   tasksCompletedToday: 0,
//   //   focusTimeToday: 0,
//   //   completedTaskHistory: []
//   // })

//   const [statistics, setStatistics] = useState<Statistics>(() => {
//     const saved = localStorage.getItem("pomodoro-statistics")
//     return saved
//       ? JSON.parse(saved)
//       : {
//           totalCompletedTasks: 0,
//           totalCompletedIterations: 0,
//           totalFocusTimeMinutes: 0,
//           tasksCompletedToday: 0,
//           focusTimeToday: 0,
//           completedTaskHistory: []
//         }
//   })

//   useEffect(() => {
//     localStorage.setItem("pomodoro-statistics", JSON.stringify(statistics))
//   }, [statistics])

//   const [allTasksCollapsed, setAllTasksCollapsed] = useState(false)
//   const [showStatistics, setShowStatistics] = useState(false)
//   //const [completedTasksCollapsed, setCompletedTasksCollapsed] = useKV<boolean>('pomodoro-completed-collapsed', true)
//   const [completedTasksCollapsed, setCompletedTasksCollapsed] = useState(() => {
//     const saved = localStorage.getItem("pomodoro-completed-collapsed")
//     return saved ? saved === "true" : true
//   })

//   useEffect(() => {
//     localStorage.setItem("pomodoro-completed-collapsed", String(completedTasksCollapsed))
//   }, [completedTasksCollapsed])

  
//   const currentTaskList = (taskLists || []).find(list => list.id === currentTaskListId)
//   const tasks = currentTaskList?.tasks || []
  
//   const currentTaskListIdRef = useRef(currentTaskListId)
//   currentTaskListIdRef.current = currentTaskListId
  
//   const setTasks = (updater: Task[] | ((current: Task[]) => Task[])) => {
//     setTaskLists(currentLists => {
//       const lists = currentLists || []
//       const targetListId = currentTaskListIdRef.current
//       return lists.map(list => {
//         if (list.id === targetListId) {
//           const newTasks = typeof updater === 'function' ? updater(list.tasks) : updater
//           return { ...list, tasks: newTasks }
//         }
//         return list
//       })
//     })
//   }
  
//   const [timerState, setTimerState] = useState<TimerState>({
//     phase: 'idle',
//     remainingSeconds: getWorkDuration(),
//     isRunning: false,
//     currentTaskId: null,
//     completedIterations: 0,
//     needsAcknowledgment: false,
//     isLongBreakNext: false
//   })
//   const [currentTaskListIdForTimer, setCurrentTaskListIdForTimer] = useState<string | null>(null)

//   const [isAddingTask, setIsAddingTask] = useState(false)
//   const [newTaskName, setNewTaskName] = useState('')
//   const [newTaskIterations, setNewTaskIterations] = useState('1')
  
//   const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
//   const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  
//   const [showStopDialog, setShowStopDialog] = useState(false)
//   const [showAcknowledgmentDialog, setShowAcknowledgmentDialog] = useState(false)
//   const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
//   const [showTemplatesDialog, setShowTemplatesDialog] = useState(false)
  
//   const timerRef = useRef<number | null>(null)
//   const beepingRef = useRef<number | null>(null)
//   const addTaskInputRef = useRef<HTMLInputElement>(null)

//   useEffect(() => {
//     if (timerState.needsAcknowledgment) {
//       setShowAcknowledgmentDialog(true)
//       const beepId = startContinuousBeeping(isMuted || false, timerState.isLongBreakNext)
//       beepingRef.current = beepId
//     }
    
//     return () => {
//       if (beepingRef.current) {
//         stopContinuousBeeping(beepingRef.current)
//         beepingRef.current = null
//       }
//     }
//   }, [timerState.needsAcknowledgment, timerState.isLongBreakNext, isMuted])

//   useEffect(() => {
//     if (timerState.isRunning && !timerState.needsAcknowledgment) {
//       timerRef.current = window.setInterval(() => {
//         setTimerState(prev => {
//           if (prev.remainingSeconds <= 1) {
//             if (prev.phase === 'work') {
//               const newCompletedIterations = prev.completedIterations + 1
//               const isLongBreak = newCompletedIterations % ITERATIONS_BEFORE_LONG_BREAK === 0
              
//               if (prev.currentTaskId) {
//                 setTasks(currentTasks => {
//                   return (currentTasks || []).map(task => {
//                     if (task.id === prev.currentTaskId) {
//                       const taskCompletedIterations = (task.completedIterations || 0) + 1
                      
//                       if (taskCompletedIterations > task.iterations) {
//                         toast.success('Task iterations increased!', {
//                           description: `${task.name} now has ${taskCompletedIterations} iterations`
//                         })
//                         return {
//                           ...task,
//                           iterations: taskCompletedIterations,
//                           completedIterations: taskCompletedIterations
//                         }
//                       }
                      
//                       return {
//                         ...task,
//                         completedIterations: taskCompletedIterations
//                       }
//                     }
//                     return task
//                   })
//                 })
//               }

//               setStatistics(currentStats => {
//                 if (!currentStats) return {
//                   totalCompletedTasks: 0,
//                   totalCompletedIterations: 1,
//                   totalFocusTimeMinutes: 25,
//                   tasksCompletedToday: 0,
//                   focusTimeToday: 25,
//                   completedTaskHistory: []
//                 }
                
//                 return {
//                   ...currentStats,
//                   totalCompletedIterations: currentStats.totalCompletedIterations + 1,
//                   totalFocusTimeMinutes: currentStats.totalFocusTimeMinutes + 25,
//                   focusTimeToday: currentStats.focusTimeToday + 25
//                 }
//               })
              
//               return {
//                 ...prev,
//                 phase: prev.phase,
//                 remainingSeconds: 0,
//                 isRunning: false,
//                 completedIterations: newCompletedIterations,
//                 needsAcknowledgment: true,
//                 isLongBreakNext: isLongBreak
//               }
//             } else {
//               return {
//                 ...prev,
//                 remainingSeconds: 0,
//                 isRunning: false,
//                 needsAcknowledgment: true,
//                 isLongBreakNext: false
//               }
//             }
//           }
//           return { ...prev, remainingSeconds: prev.remainingSeconds - 1 }
//         })
//       }, 1000)
//     } else {
//       if (timerRef.current) {
//         clearInterval(timerRef.current)
//         timerRef.current = null
//       }
//     }

//     return () => {
//       if (timerRef.current) {
//         clearInterval(timerRef.current)
//       }
//     }
//   }, [timerState.isRunning, timerState.needsAcknowledgment, tasks, isMuted, setTasks, setStatistics])

//   useEffect(() => {
//     const now = new Date()
//     const lastResetDate = localStorage.getItem('pomodoro-last-reset-date')
//     const today = now.toDateString()

//     if (lastResetDate !== today) {
//       setStatistics(currentStats => {
//         if (!currentStats) return {
//           totalCompletedTasks: 0,
//           totalCompletedIterations: 0,
//           totalFocusTimeMinutes: 0,
//           tasksCompletedToday: 0,
//           focusTimeToday: 0,
//           completedTaskHistory: []
//         }
        
//         return {
//           ...currentStats,
//           tasksCompletedToday: 0,
//           focusTimeToday: 0
//         }
//       })
//       localStorage.setItem('pomodoro-last-reset-date', today)
//     }
//   }, [setStatistics])

//   useEffect(() => {
//     const checkRecurringTasks = () => {
//       setTasks(currentTasks => {
//         const tasks = currentTasks || []
//         let hasChanges = false
        
//         const updatedTasks = tasks.map(task => {
//           if (shouldReactivateRecurringTask(task)) {
//             hasChanges = true
//             toast.success('Recurring task reactivated', {
//               description: `${task.name} is ready to do again!`
//             })
//             return {
//               ...task,
//               completed: false,
//               completedIterations: 0
//             }
//           }
//           return task
//         })
        
//         if (hasChanges) {
//           const incompleteTasks = updatedTasks.filter(t => !t.completed)
//           const completedTasks = updatedTasks.filter(t => t.completed)
//           const highPriorityTasks = incompleteTasks.filter(t => t.isHighPriority)
//           const normalPriorityTasks = incompleteTasks.filter(t => !t.isHighPriority)
          
//           return [...highPriorityTasks, ...normalPriorityTasks, ...completedTasks]
//         }
        
//         return tasks
//       })
//     }
    
//     checkRecurringTasks()
//     const interval = setInterval(checkRecurringTasks, 60000)
    
//     return () => clearInterval(interval)
//   }, [])

//   const findNextTask = () => {
//     return (tasks || []).find(task => !task.completed)
//   }

//   const startTimer = () => {
//     if (timerState.phase === 'idle') {
//       const selectedTask = timerState.currentTaskId 
//         ? (tasks || []).find(t => t.id === timerState.currentTaskId && !t.completed)
//         : null
      
//       const nextTask = selectedTask || findNextTask()
      
//       if (nextTask) {
//         setTasks(currentTasks => {
//           const tasks = currentTasks || []
//           const updatedTasks = tasks.map(t => 
//             t.id === nextTask.id ? { ...t, completedIterations: 0 } : t
//           )
          
//           const taskIndex = updatedTasks.findIndex(t => t.id === nextTask.id)
//           if (taskIndex > 0) {
//             const [taskToMove] = updatedTasks.splice(taskIndex, 1)
//             const incompleteTasks = updatedTasks.filter(t => !t.completed)
//             const completedTasks = updatedTasks.filter(t => t.completed)
//             return [taskToMove, ...incompleteTasks, ...completedTasks]
//           }
          
//           return updatedTasks
//         })
//       }
      
//       setTimerState({
//         phase: 'work',
//         remainingSeconds: getWorkDuration(),
//         isRunning: true,
//         currentTaskId: nextTask?.id || null,
//         completedIterations: 0,
//         needsAcknowledgment: false,
//         isLongBreakNext: false
//       })
//       setCurrentTaskListIdForTimer(currentTaskListId || null)
//     } else {
//       setTimerState(prev => ({ ...prev, isRunning: true }))
//     }
//   }

//   const pauseTimer = () => {
//     setTimerState(prev => ({ ...prev, isRunning: false }))
//   }

//   const stopTimer = () => {
//     setShowStopDialog(true)
//   }

//   const confirmStopTimer = () => {
//     if (beepingRef.current) {
//       stopContinuousBeeping(beepingRef.current)
//       beepingRef.current = null
//     }
    
//     setTimerState({
//       phase: 'idle',
//       remainingSeconds: getWorkDuration(),
//       isRunning: false,
//       currentTaskId: null,
//       completedIterations: 0,
//       needsAcknowledgment: false,
//       isLongBreakNext: false
//     })
//     setCurrentTaskListIdForTimer(null)
//     setShowStopDialog(false)
//     setShowAcknowledgmentDialog(false)
//     toast.info('Timer stopped')
//   }

//   const handleStartBreak = () => {
//     if (beepingRef.current) {
//       stopContinuousBeeping(beepingRef.current)
//       beepingRef.current = null
//     }
    
//     const isLongBreak = timerState.isLongBreakNext
    
//     setTimerState(prev => ({
//       ...prev,
//       phase: isLongBreak ? 'longBreak' : 'break',
//       remainingSeconds: isLongBreak ? getLongBreakDuration() : getShortBreakDuration(),
//       isRunning: true,
//       needsAcknowledgment: false,
//       isLongBreakNext: false
//     }))
    
//     setShowAcknowledgmentDialog(false)
    
//     toast.success('Break started', {
//       description: isLongBreak ? 'Enjoy your long break!' : 'Enjoy your short break!'
//     })
//   }

//   const handleSkipBreak = () => {
//     if (beepingRef.current) {
//       stopContinuousBeeping(beepingRef.current)
//       beepingRef.current = null
//     }
    
//     const nextTask = findNextTask()
    
//     if (nextTask) {
//       setTasks(currentTasks => 
//         (currentTasks || []).map(t => 
//           t.id === nextTask.id ? { ...t, completedIterations: 0 } : t
//         )
//       )
//     }
    
//     setTimerState({
//       phase: 'work',
//       remainingSeconds: getWorkDuration(),
//       isRunning: true,
//       currentTaskId: nextTask?.id || null,
//       completedIterations: timerState.completedIterations,
//       needsAcknowledgment: false,
//       isLongBreakNext: false
//     })
//     setCurrentTaskListIdForTimer(currentTaskListId || null)
    
//     setShowAcknowledgmentDialog(false)
    
//     if (nextTask) {
//       toast.success('Break skipped', {
//         description: `Starting: ${nextTask.name}`
//       })
//     } else {
//       toast.success('Break skipped', {
//         description: 'Continuing work session'
//       })
//     }
//   }

//   const addTask = () => {
//     if (!newTaskName.trim()) return
    
//     const iterations = parseInt(newTaskIterations) || 1
//     if (iterations < 1) {
//       toast.error('Invalid iteration count')
//       return
//     }

//     const newTask: Task = {
//       id: `task-${Date.now()}`,
//       name: newTaskName.trim(),
//       iterations,
//       subtasks: [],
//       completed: false,
//       collapsed: false
//     }

//     setTasks(currentTasks => [...(currentTasks || []), newTask])
//     setNewTaskName('')
//     setNewTaskIterations('1')
//     setIsAddingTask(false)
    
//     toast.success('Task added')
//   }

//   const addTaskFromTemplate = (task: Task) => {
//     setTasks(currentTasks => [...(currentTasks || []), task])
//     toast.success('Template added', {
//       description: `${task.name} will repeat ${task.recurrence ? `every ${task.recurrence.interval} ${task.recurrence.unit}` : ''}`
//     })
//   }

//   const updateTask = (taskId: string, updatedTask: Task) => {
//     setTasks(currentTasks => {
//       const tasks = currentTasks || []
//       const oldTask = tasks.find(t => t.id === taskId)
      
//       if (oldTask && !oldTask.completed && updatedTask.completed) {
//         const completedIterations = updatedTask.completedIterations || updatedTask.iterations
        
//         if (updatedTask.recurrence?.enabled) {
//           updatedTask = {
//             ...updatedTask,
//             recurrence: {
//               ...updatedTask.recurrence,
//               lastCompletedAt: Date.now()
//             }
//           }
//         }
        
//         setStatistics(currentStats => {
//           if (!currentStats) return {
//             totalCompletedTasks: 1,
//             totalCompletedIterations: 0,
//             totalFocusTimeMinutes: 0,
//             tasksCompletedToday: 1,
//             focusTimeToday: 0,
//             completedTaskHistory: [{
//               taskName: updatedTask.name,
//               completedIterations,
//               completedAt: Date.now()
//             }]
//           }
          
//           return {
//             ...currentStats,
//             totalCompletedTasks: currentStats.totalCompletedTasks + 1,
//             tasksCompletedToday: currentStats.tasksCompletedToday + 1,
//             completedTaskHistory: [
//               {
//                 taskName: updatedTask.name,
//                 completedIterations,
//                 completedAt: Date.now()
//               },
//               ...currentStats.completedTaskHistory
//             ]
//           }
//         })
        
//         if (timerState.currentTaskId === taskId && timerState.phase === 'work') {
//           const nextTask = (currentTasks || []).find(t => t.id !== taskId && !t.completed)
          
//           if (nextTask) {
//             setTimerState(prev => ({
//               ...prev,
//               currentTaskId: nextTask.id
//             }))
            
//             toast.success('Task completed!', {
//               description: `Moving to: ${nextTask.name}`,
//               action: {
//                 label: 'Undo',
//                 onClick: () => {
//                   updateTask(taskId, { ...updatedTask, completed: false })
//                   setStatistics(currentStats => {
//                     if (!currentStats) return {
//                       totalCompletedTasks: 0,
//                       totalCompletedIterations: 0,
//                       totalFocusTimeMinutes: 0,
//                       tasksCompletedToday: 0,
//                       focusTimeToday: 0,
//                       completedTaskHistory: []
//                     }
//                     return {
//                       ...currentStats,
//                       totalCompletedTasks: Math.max(0, currentStats.totalCompletedTasks - 1),
//                       tasksCompletedToday: Math.max(0, currentStats.tasksCompletedToday - 1),
//                       completedTaskHistory: currentStats.completedTaskHistory.filter(
//                         h => h.taskName !== updatedTask.name || h.completedAt !== currentStats.completedTaskHistory[0]?.completedAt
//                       )
//                     }
//                   })
//                   toast.info('Task unmarked')
//                 }
//               }
//             })
//           } else {
//             toast.success('Task completed!', {
//               description: 'No more tasks remaining',
//               action: {
//                 label: 'Undo',
//                 onClick: () => {
//                   updateTask(taskId, { ...updatedTask, completed: false })
//                   setStatistics(currentStats => {
//                     if (!currentStats) return {
//                       totalCompletedTasks: 0,
//                       totalCompletedIterations: 0,
//                       totalFocusTimeMinutes: 0,
//                       tasksCompletedToday: 0,
//                       focusTimeToday: 0,
//                       completedTaskHistory: []
//                     }
//                     return {
//                       ...currentStats,
//                       totalCompletedTasks: Math.max(0, currentStats.totalCompletedTasks - 1),
//                       tasksCompletedToday: Math.max(0, currentStats.tasksCompletedToday - 1),
//                       completedTaskHistory: currentStats.completedTaskHistory.filter(
//                         h => h.taskName !== updatedTask.name || h.completedAt !== currentStats.completedTaskHistory[0]?.completedAt
//                       )
//                     }
//                   })
//                   toast.info('Task unmarked')
//                 }
//               }
//             })
//           }
//         } else {
//           toast.success('Task completed!', {
//             description: `${updatedTask.name} marked as complete`,
//             action: {
//               label: 'Undo',
//               onClick: () => {
//                 updateTask(taskId, { ...updatedTask, completed: false })
//                 setStatistics(currentStats => {
//                   if (!currentStats) return {
//                     totalCompletedTasks: 0,
//                     totalCompletedIterations: 0,
//                     totalFocusTimeMinutes: 0,
//                     tasksCompletedToday: 0,
//                     focusTimeToday: 0,
//                     completedTaskHistory: []
//                   }
//                   return {
//                     ...currentStats,
//                     totalCompletedTasks: Math.max(0, currentStats.totalCompletedTasks - 1),
//                     tasksCompletedToday: Math.max(0, currentStats.tasksCompletedToday - 1),
//                     completedTaskHistory: currentStats.completedTaskHistory.filter(
//                       h => h.taskName !== updatedTask.name || h.completedAt !== currentStats.completedTaskHistory[0]?.completedAt
//                     )
//                   }
//                 })
//                 toast.info('Task unmarked')
//               }
//             }
//           })
//         }
//       }
      
//       if (oldTask && oldTask.isHighPriority !== updatedTask.isHighPriority && updatedTask.isHighPriority && !updatedTask.completed) {
//         toast.success('High priority set', {
//           description: `${updatedTask.name} moved to top`
//         })
//       }
      
//       const updatedTasks = tasks.map(t => t.id === taskId ? updatedTask : t)
//       const incompleteTasks = updatedTasks.filter(t => !t.completed)
//       const completedTasks = updatedTasks.filter(t => t.completed)
      
//       const highPriorityTasks = incompleteTasks.filter(t => t.isHighPriority)
//       const normalPriorityTasks = incompleteTasks.filter(t => !t.isHighPriority)
      
//       return [...highPriorityTasks, ...normalPriorityTasks, ...completedTasks]
//     })
//   }

//   const selectTask = (taskId: string) => {
//     const task = (tasks || []).find(t => t.id === taskId)
//     if (!task || task.completed) return
    
//     const wasRunning = timerState.isRunning
    
//     if (timerState.phase === 'work') {
//       setTimerState(prev => ({
//         ...prev,
//         currentTaskId: taskId,
//         isRunning: wasRunning
//       }))
      
//       toast.success('Task changed', {
//         description: `Now working on: ${task.name}`
//       })
//     } else if (timerState.phase !== 'idle') {
//       toast.info('Cannot change task', {
//         description: 'You can only change tasks during work sessions'
//       })
//     } else {
//       setTimerState(prev => ({
//         ...prev,
//         currentTaskId: taskId
//       }))
//     }
//   }

//   const deleteTask = (taskId: string) => {
//     const task = (tasks || []).find(t => t.id === taskId)
    
//     if (!task?.completed && timerState.currentTaskId === taskId && timerState.isRunning) {
//       toast.error('Cannot delete', {
//         description: 'Cannot delete the current running task'
//       })
//       return
//     }
    
//     setTasks(currentTasks => (currentTasks || []).filter(t => t.id !== taskId))
//     toast.success('Task deleted')
//   }

//   const bulkDeleteCompletedTasks = () => {
//     const completedTasks = (tasks || []).filter(t => t.completed)
    
//     if (completedTasks.length === 0) {
//       toast.info('No completed tasks to delete')
//       return
//     }
    
//     setTasks(currentTasks => (currentTasks || []).filter(t => !t.completed))
//     setShowBulkDeleteDialog(false)
//     toast.success(`Deleted ${completedTasks.length} completed ${completedTasks.length === 1 ? 'task' : 'tasks'}`)
//   }

//   const createTaskList = (name: string) => {
//     const newList: TaskList = {
//       id: `list-${Date.now()}`,
//       name,
//       tasks: [],
//       createdAt: Date.now()
//     }
//     setTaskLists(currentLists => [...(currentLists || []), newList])
//     setCurrentTaskListId(newList.id)
//   }

//   const renameTaskList = (listId: string, newName: string) => {
//     setTaskLists(currentLists => 
//       (currentLists || []).map(list => 
//         list.id === listId ? { ...list, name: newName } : list
//       )
//     )
//   }

//   const deleteTaskList = (listId: string) => {
//     const lists = taskLists || []
//     if (lists.length <= 1) {
//       toast.error('Cannot delete the last list')
//       return
//     }
    
//     setTaskLists(currentLists => {
//       const updatedLists = (currentLists || []).filter(list => list.id !== listId)
//       if (currentTaskListId === listId && updatedLists.length > 0) {
//         setCurrentTaskListId(updatedLists[0].id)
//       }
//       return updatedLists
//     })
//   }

//   const duplicateTaskList = (listId: string) => {
//     const listToDuplicate = (taskLists || []).find(list => list.id === listId)
//     if (!listToDuplicate) return
    
//     const duplicatedTasks = listToDuplicate.tasks.map(task => ({
//       ...task,
//       id: `task-${Date.now()}-${Math.random()}`,
//       subtasks: task.subtasks?.map(subtask => ({
//         ...subtask,
//         id: `subtask-${Date.now()}-${Math.random()}`
//       })) || []
//     }))
    
//     const newList: TaskList = {
//       id: `list-${Date.now()}`,
//       name: `${listToDuplicate.name} (Copy)`,
//       tasks: duplicatedTasks,
//       createdAt: Date.now()
//     }
    
//     setTaskLists(currentLists => [...(currentLists || []), newList])
//     setCurrentTaskListId(newList.id)
//     toast.success('Task list duplicated')
//   }

//   const toggleAllTasksCollapse = () => {
//     const newCollapsedState = !allTasksCollapsed
//     setTasks(currentTasks => (currentTasks || []).map(t => ({ ...t, collapsed: newCollapsedState })))
//     setAllTasksCollapsed(newCollapsedState)
//   }

//   const handleDragStart = (taskId: string) => {
//     setDraggedTaskId(taskId)
//   }

//   const handleDragEnd = () => {
//     setDraggedTaskId(null)
//     setDragOverTaskId(null)
//   }

//   const handleDragOver = (e: React.DragEvent, taskId: string) => {
//     e.preventDefault()
//     if (draggedTaskId && draggedTaskId !== taskId) {
//       setDragOverTaskId(taskId)
//     }
//   }

//   const handleDrop = (targetTaskId: string) => {
//     if (!draggedTaskId || draggedTaskId === targetTaskId) {
//       return
//     }

//     setTasks(currentTasks => {
//       const tasks = currentTasks || []
//       const draggedIndex = tasks.findIndex(t => t.id === draggedTaskId)
//       const targetIndex = tasks.findIndex(t => t.id === targetTaskId)

//       if (draggedIndex === -1 || targetIndex === -1) {
//         return tasks
//       }

//       const newTasks = [...tasks]
//       const [draggedTask] = newTasks.splice(draggedIndex, 1)
//       newTasks.splice(targetIndex, 0, draggedTask)

//       const incompleteTasks = newTasks.filter(t => !t.completed)
//       const completedTasks = newTasks.filter(t => t.completed)
      
//       return [...incompleteTasks, ...completedTasks]
//     })

//     setDraggedTaskId(null)
//     setDragOverTaskId(null)
//   }

//   const handleTouchReorder = (taskId: string, direction: 'up' | 'down') => {
//     setTasks(currentTasks => {
//       const tasks = currentTasks || []
//       const taskIndex = tasks.findIndex(t => t.id === taskId)
      
//       if (taskIndex === -1) return tasks
      
//       const newIndex = direction === 'up' ? taskIndex - 1 : taskIndex + 1
//       if (newIndex < 0 || newIndex >= tasks.length) return tasks
      
//       const newTasks = [...tasks]
//       const [movedTask] = newTasks.splice(taskIndex, 1)
//       newTasks.splice(newIndex, 0, movedTask)
      
//       const incompleteTasks = newTasks.filter(t => !t.completed)
//       const completedTasks = newTasks.filter(t => t.completed)
      
//       return [...incompleteTasks, ...completedTasks]
//     })
    
//     toast.success(`Task moved ${direction}`)
//   }

//   const handleBackgroundUpload = (file: File) => {
//     const reader = new FileReader()
//     reader.onload = (event) => {
//       const result = event.target?.result
//       if (typeof result === 'string') {
//         setBackgroundImage(result)
//         toast.success('Background image uploaded')
//       }
//     }
//     reader.readAsDataURL(file)
//   }

//   const PRESET_BACKGROUNDS = [
//     {
//       id: 'gradient-1',
//       name: 'Purple Wave',
//       url: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
//     },
//     {
//       id: 'gradient-2',
//       name: 'Ocean Blue',
//       url: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
//     },
//     {
//       id: 'gradient-3',
//       name: 'Sunset',
//       url: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
//     },
//     {
//       id: 'gradient-4',
//       name: 'Forest',
//       url: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)'
//     },
//     {
//       id: 'gradient-5',
//       name: 'Midnight',
//       url: 'linear-gradient(135deg, #2e3192 0%, #1bffff 100%)'
//     },
//     {
//       id: 'gradient-6',
//       name: 'Rose Gold',
//       url: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)'
//     },
//     {
//       id: 'pattern-1',
//       name: 'Dots',
//       url: 'radial-gradient(circle, oklch(0.45 0.15 260) 1px, transparent 1px)',
//       style: { backgroundSize: '20px 20px' }
//     },
//     {
//       id: 'pattern-2',
//       name: 'Grid',
//       url: 'linear-gradient(oklch(0.45 0.15 260 / 0.1) 1px, transparent 1px), linear-gradient(90deg, oklch(0.45 0.15 260 / 0.1) 1px, transparent 1px)',
//       style: { backgroundSize: '30px 30px' }
//     },
//     {
//       id: 'pattern-3',
//       name: 'Diagonal',
//       url: 'repeating-linear-gradient(45deg, transparent, transparent 10px, oklch(0.45 0.15 260 / 0.05) 10px, oklch(0.45 0.15 260 / 0.05) 20px)',
//       style: {}
//     },
//     {
//       id: 'mesh-1',
//       name: 'Purple Mesh',
//       url: 'radial-gradient(at 0% 0%, oklch(0.45 0.15 260) 0px, transparent 50%), radial-gradient(at 100% 0%, oklch(0.55 0.20 300) 0px, transparent 50%), radial-gradient(at 100% 100%, oklch(0.50 0.18 280) 0px, transparent 50%), radial-gradient(at 0% 100%, oklch(0.60 0.15 250) 0px, transparent 50%)',
//       style: { backgroundColor: 'oklch(0.98 0.002 240)' }
//     },
//     {
//       id: 'mesh-2',
//       name: 'Blue Mesh',
//       url: 'radial-gradient(at 0% 0%, oklch(0.60 0.20 220) 0px, transparent 50%), radial-gradient(at 100% 0%, oklch(0.55 0.18 200) 0px, transparent 50%), radial-gradient(at 100% 100%, oklch(0.65 0.15 240) 0px, transparent 50%), radial-gradient(at 0% 100%, oklch(0.50 0.22 210) 0px, transparent 50%)',
//       style: { backgroundColor: 'oklch(0.98 0.002 240)' }
//     },
//     {
//       id: 'mesh-3',
//       name: 'Warm Mesh',
//       url: 'radial-gradient(at 0% 0%, oklch(0.70 0.15 60) 0px, transparent 50%), radial-gradient(at 100% 0%, oklch(0.65 0.18 40) 0px, transparent 50%), radial-gradient(at 100% 100%, oklch(0.60 0.20 20) 0px, transparent 50%), radial-gradient(at 0% 100%, oklch(0.75 0.12 80) 0px, transparent 50%)',
//       style: { backgroundColor: 'oklch(0.98 0.002 240)' }
//     }
//   ]

//   const getBackgroundStyle = () => {
//     if (!backgroundImage) return undefined
    
//     const isPreset = !backgroundImage.startsWith('data:')
//     if (isPreset) {
//       const preset = PRESET_BACKGROUNDS.find(p => p.id === backgroundImage)
//       if (preset) {
//         return {
//           backgroundImage: preset.url,
//           ...preset.style
//         }
//       }
//     }
    
//     return {
//       backgroundImage: `url(${backgroundImage})`,
//       backgroundSize: 'cover',
//       backgroundPosition: 'center',
//       backgroundAttachment: 'fixed'
//     }
//   }

//   const tasksList = tasks || []
//   const totalIterations = calculateTotalIterations(tasksList)
//   const totalTime = calculateTotalTime(totalIterations)
  
//   const currentTask = (() => {
//     if (!timerState.currentTaskId) return null
//     if (currentTaskListIdForTimer === currentTaskListId) {
//       return tasksList.find(t => t.id === timerState.currentTaskId)
//     }
//     const timerTaskList = (taskLists || []).find(list => list.id === currentTaskListIdForTimer)
//     return timerTaskList?.tasks.find(t => t.id === timerState.currentTaskId)
//   })()
  
//   const currentTaskListName = (() => {
//     if (!currentTaskListIdForTimer) return null
//     return (taskLists || []).find(list => list.id === currentTaskListIdForTimer)?.name
//   })()
  
//   const incompleteTasks = tasksList.filter(t => !t.completed)
//   const completedTasks = tasksList.filter(t => t.completed)
//   const completedTasksCount = completedTasks.length

//   return (
//     <>
//       <Toaster position="top-center" duration={3000} closeButton />
//       <div 
//         className="min-h-screen bg-background p-4 relative"
//         style={getBackgroundStyle()}
//       >
//         {backgroundImage && (
//           <div 
//             className="absolute inset-0 backdrop-blur-sm" 
//             style={{ backgroundColor: `oklch(from var(--background) l c h / ${1 - (backgroundOpacity || 0.8)})` }}
//           />
//         )}
//       <div className={`mx-auto ${isCompact ? 'max-w-sm' : 'max-w-2xl'} space-y-4 relative z-10`}>
//         <div className="flex items-center justify-between">
//           {/* <TaskListSelector
//             taskLists={taskLists || []}
//             currentTaskListId={currentTaskListId || 'default'}
//             onSelectTaskList={setCurrentTaskListId}
//             onCreateTaskList={createTaskList}
//             onRenameTaskList={renameTaskList}
//             onDeleteTaskList={deleteTaskList}
//             onDuplicateTaskList={duplicateTaskList}
//             onShowStatistics={() => setShowStatistics(true)}
//             backgroundImage={backgroundImage || null}
//             backgroundOpacity={backgroundOpacity || 0.8}
//             onBackgroundChange={setBackgroundImage}
//             onOpacityChange={setBackgroundOpacity}
//             onUpload={handleBackgroundUpload}
//           /> */}
//           {!isCompact && (
//             <h1 className="font-display text-2xl font-bold text-foreground absolute left-1/2 -translate-x-1/2">Pomodoro Timer</h1>
//           )}
//           <div className="flex gap-2">
//             <Button
//               variant="ghost"
//               size="icon"
//               onClick={() => setIsCompact(c => !c)}
//               title={isCompact ? 'Expand view' : 'Compact view'}
//             >
//               {isCompact ? <SquaresFour size={20} /> : <ListDashes size={20} />}
//             </Button>
//             <Button
//               variant="ghost"
//               size="icon"
//               onClick={() => {
//                 setIsMuted(m => {
//                   const newMutedState = !m
//                   if (newMutedState) {
//                     toast.warning('Sound muted', {
//                       description: 'You will not hear alerts when sessions complete'
//                     })
//                   } else {
//                     toast.success('Sound enabled', {
//                       description: 'You will hear alerts when sessions complete'
//                     })
//                   }
//                   return newMutedState
//                 })
//               }}
//               title={isMuted ? 'Unmute' : 'Mute'}
//             >
//               {isMuted ? <BellSlash size={20} /> : <Bell size={20} />}
//             </Button>
//           </div>
//         </div>

//         <TimerDisplay
//           phase={timerState.phase}
//           remainingSeconds={timerState.remainingSeconds}
//           completedIterations={timerState.completedIterations}
//           isCompact={isCompact}
//           isRunning={timerState.isRunning}
//           isMuted={isMuted}
//         />

//         {timerState.phase !== 'idle' && (
//           <Card className={`p-3 bg-accent/10 border-accent ${isCompact ? 'p-2' : 'p-3'}`}>
//             <p className={`text-muted-foreground ${isCompact ? 'text-xs' : 'text-sm'}`}>
//               Current Task
//               {currentTaskListName && (
//                 <span className="ml-2 text-xs opacity-70">({currentTaskListName})</span>
//               )}
//             </p>
//             <p className={`font-medium ${isCompact ? 'text-sm' : ''}`}>
//               {currentTask ? currentTask.name : 'Focus Session (No task selected)'}
//             </p>
//           </Card>
//         )}

//         <div className="flex gap-2">
//           {!timerState.isRunning ? (
//             <Button
//               onClick={startTimer}
//               className="flex-1"
//               size="lg"
//             >
//               <Play size={20} className="mr-2" />
//               {timerState.phase === 'idle' ? 'Start' : 'Resume'}
//             </Button>
//           ) : (
//             <Button
//               onClick={pauseTimer}
//               variant="secondary"
//               className="flex-1"
//               size="lg"
//             >
//               <Pause size={20} className="mr-2" />
//               Pause
//             </Button>
//           )}
//           {timerState.phase !== 'idle' && (
//             <Button
//               onClick={stopTimer}
//               variant="outline"
//               size="lg"
//             >
//               <Stop size={20} />
//             </Button>
//           )}
//         </div>

//         {!isCompact && (
//           <>
//             <Separator />

//             <div className="space-y-3">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <h2 className="font-medium">Tasks</h2>
//                   {totalIterations > 0 && (
//                     <p className="text-sm text-muted-foreground">
//                       {totalIterations} iterations · {formatTimeDisplay(totalTime.days, totalTime.hours, totalTime.minutes)}
//                     </p>
//                   )}
//                 </div>
//                 <div className="flex gap-2">
//                   {tasksList.length > 0 && (
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       onClick={toggleAllTasksCollapse}
//                     >
//                       {allTasksCollapsed ? 'Expand All' : 'Collapse All'}
//                     </Button>
//                   )}
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => setShowTemplatesDialog(true)}
//                     title="Browse recurring task templates"
//                   >
//                     <Books size={16} className="mr-1" />
//                     Templates
//                   </Button>
//                   <Button
//                     size="sm"
//                     onClick={() => setIsAddingTask(true)}
//                     data-add-task-button
//                   >
//                     <Plus size={16} className="mr-1" />
//                     Add Task
//                   </Button>
//                 </div>
//               </div>

//               {isAddingTask && (
//                 <Card className="p-3">
//                   <div className="flex flex-col sm:flex-row gap-2">
//                     <div className="flex gap-2 flex-1">
//                       <Input
//                         ref={addTaskInputRef}
//                         id="task-name"
//                         placeholder="Task name"
//                         value={newTaskName}
//                         onChange={(e) => setNewTaskName(e.target.value)}
//                         onKeyDown={(e) => {
//                           if (e.key === 'Enter') {
//                             addTask()
//                             setIsAddingTask(true)
//                             setTimeout(() => addTaskInputRef.current?.focus(), 50)
//                           }
//                         }}
//                         className="flex-1 min-w-0"
//                         autoFocus
//                       />
//                       <Input
//                         id="task-iterations"
//                         type="number"
//                         min="1"
//                         value={newTaskIterations}
//                         placeholder="Iter"
//                         onChange={(e) => setNewTaskIterations(e.target.value)}
//                         onKeyDown={(e) => {
//                           if (e.key === 'Enter') {
//                             addTask()
//                             setIsAddingTask(true)
//                             setTimeout(() => addTaskInputRef.current?.focus(), 50)
//                           }
//                         }}
//                         className="w-16 sm:w-20"
//                       />
//                     </div>
//                     <div className="flex gap-2 sm:gap-2">
//                       <Button 
//                         onClick={() => {
//                           addTask()
//                           setIsAddingTask(true)
//                           setTimeout(() => addTaskInputRef.current?.focus(), 50)
//                         }}
//                         className="flex-1 sm:flex-none"
//                       >
//                         Add
//                       </Button>
//                       <Button 
//                         onClick={() => {
//                           setIsAddingTask(false)
//                         }} 
//                         variant="outline"
//                         className="flex-1 sm:flex-none"
//                       >
//                         Cancel
//                       </Button>
//                     </div>
//                   </div>
//                 </Card>
//               )}
//               <ScrollArea className="h-[400px]">
//                 <div className="space-y-2">
//                   <AnimatePresence>
//                     {tasksList.length === 0 ? (
//                       <motion.div
//                         initial={{ opacity: 0 }}
//                         animate={{ opacity: 1 }}
//                         className="text-center py-12 text-muted-foreground"
//                       >
//                         <p>No tasks yet</p>
//                       </motion.div>
//                     ) : (
//                       <>
//                         {incompleteTasks.map(task => (
//                           <motion.div
//                             key={task.id}
//                             initial={{ opacity: 0, y: -10 }}
//                             animate={{ opacity: 1, y: 0 }}
//                             exit={{ opacity: 0, x: -100 }}
//                           >
//                             <TaskItem
//                               task={task}
//                               onUpdate={(updatedTask) => updateTask(task.id, updatedTask)}
//                               onDelete={() => deleteTask(task.id)}
//                               isActive={task.id === timerState.currentTaskId}
//                               onDragStart={() => handleDragStart(task.id)}
//                               onDragEnd={handleDragEnd}
//                               onDragOver={(e) => handleDragOver(e, task.id)}
//                               onDrop={() => handleDrop(task.id)}
//                               isDragging={draggedTaskId === task.id}
//                               isDragOver={dragOverTaskId === task.id}
//                               onSelect={() => selectTask(task.id)}
//                               onTouchReorder={(direction) => handleTouchReorder(task.id, direction)}
//                             />
//                           </motion.div>
//                         ))}
                        
//                         {completedTasks.length > 0 && (
//                           <Collapsible
//                             open={!completedTasksCollapsed}
//                             onOpenChange={(open) => setCompletedTasksCollapsed(!open)}
//                           >
//                             <div className="flex items-center justify-between mt-4 mb-2">
//                               <CollapsibleTrigger asChild>
//                                 <Button
//                                   variant="ghost"
//                                   size="sm"
//                                   className="gap-1"
//                                 >
//                                   <span className="text-muted-foreground">
//                                     Completed ({completedTasksCount})
//                                   </span>
//                                   <CaretDown
//                                     size={16}
//                                     className={`transition-transform ${
//                                       completedTasksCollapsed ? '' : 'rotate-180'
//                                     }`}
//                                   />
//                                 </Button>
//                               </CollapsibleTrigger>
//                               <Button
//                                 variant="ghost"
//                                 size="sm"
//                                 onClick={() => setShowBulkDeleteDialog(true)}
//                                 className="text-destructive hover:text-destructive hover:bg-destructive/10"
//                                 title="Delete all completed tasks"
//                               >
//                                 <TrashSimple size={16} className="mr-1" />
//                                 Delete All
//                               </Button>
//                             </div>
//                             <CollapsibleContent className="space-y-2 mt-2">
//                               {completedTasks.map(task => (
//                                 <motion.div
//                                   key={task.id}
//                                   initial={{ opacity: 0, y: -10 }}
//                                   animate={{ opacity: 1, y: 0 }}
//                                   exit={{ opacity: 0, x: -100 }}
//                                 >
//                                   <TaskItem
//                                     task={task}
//                                     onUpdate={(updatedTask) => updateTask(task.id, updatedTask)}
//                                     onDelete={() => deleteTask(task.id)}
//                                     isActive={task.id === timerState.currentTaskId}
//                                     onDragStart={() => handleDragStart(task.id)}
//                                     onDragEnd={handleDragEnd}
//                                     onDragOver={(e) => handleDragOver(e, task.id)}
//                                     onDrop={() => handleDrop(task.id)}
//                                     isDragging={draggedTaskId === task.id}
//                                     isDragOver={dragOverTaskId === task.id}
//                                     onSelect={() => selectTask(task.id)}
//                                     onTouchReorder={(direction) => handleTouchReorder(task.id, direction)}
//                                   />
//                                 </motion.div>
//                               ))}
//                             </CollapsibleContent>
//                           </Collapsible>
//                         )}
//                       </>
//                     )}
//                   </AnimatePresence>
//                 </div>
//               </ScrollArea>
//             </div>
//           </>
//         )}
//       </div>
//       </div>

//       <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle>Stop Timer?</AlertDialogTitle>
//             <AlertDialogDescription>
//               Are you sure you want to stop the timer? Your progress will be reset and you'll need to start over.
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel>Cancel</AlertDialogCancel>
//             <AlertDialogAction onClick={confirmStopTimer}>
//               Stop Timer
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>

//       <AlertDialog open={showAcknowledgmentDialog} onOpenChange={(open) => !open && setShowAcknowledgmentDialog(false)}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle>
//               {timerState.phase === 'work' ? 'Work Session Complete!' : 'Break Complete!'}
//             </AlertDialogTitle>
//             <AlertDialogDescription>
//               {timerState.phase === 'work' 
//                 ? timerState.isLongBreakNext 
//                   ? 'Great work! Time for a long break.'
//                   : 'Great work! Time for a short break.'
//                 : 'Ready to get back to work?'}
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             {timerState.phase === 'work' ? (
//               <>
//                 <AlertDialogCancel onClick={handleSkipBreak}>Skip Break</AlertDialogCancel>
//                 <AlertDialogAction onClick={handleStartBreak}>
//                   Start Break
//                 </AlertDialogAction>
//               </>
//             ) : (
//               <>
//                 <AlertDialogCancel onClick={handleSkipBreak}>Skip to Next Task</AlertDialogCancel>
//                 <AlertDialogAction onClick={handleSkipBreak}>
//                   Continue
//                 </AlertDialogAction>
//               </>
//             )}
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>

//       <StatisticsDialog
//         open={showStatistics}
//         onOpenChange={setShowStatistics}
//         statistics={statistics || {
//           totalCompletedTasks: 0,
//           totalCompletedIterations: 0,
//           totalFocusTimeMinutes: 0,
//           tasksCompletedToday: 0,
//           focusTimeToday: 0,
//           completedTaskHistory: []
//         }}
//       />

//       <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle>Delete All Completed Tasks?</AlertDialogTitle>
//             <AlertDialogDescription>
//               Are you sure you want to delete all {completedTasksCount} completed {completedTasksCount === 1 ? 'task' : 'tasks'}? This action cannot be undone.
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel>Cancel</AlertDialogCancel>
//             <AlertDialogAction onClick={bulkDeleteCompletedTasks} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
//               Delete All
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>

//       <TaskTemplatesDialog
//         open={showTemplatesDialog}
//         onOpenChange={setShowTemplatesDialog}
//         onAddTask={addTaskFromTemplate}
//         existingTasks={tasks}
//       />
//     </>
//   )
// }

// export default App