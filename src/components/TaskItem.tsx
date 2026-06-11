import { useEffect, useRef, useState } from 'react'
import { Task, Subtask, RecurrenceSettings } from '@/lib/types'
import { calculateTaskIterations, formatTimeDisplay, calculateTotalTime, formatRecurrenceDescription, getTimeUntilReactivation } from '@/lib/timer-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CaretDown, CaretRight, Plus, Trash, PlayCircle, CaretUp, Star, ArrowClockwise, DotsThree } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { RecurrenceDialog } from '@/components/RecurrenceDialog'

interface TaskItemProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: () => void
  isActive: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop?: () => void
  isDragging?: boolean
  isDragOver?: boolean
  onSelect?: () => void
  onTouchReorder?: (direction: 'up' | 'down') => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  otherTasks?: Task[]
  onMoveSubtaskToTask?: (subtaskId: string, targetTaskId: string) => void
  onCopySubtaskToTask?: (subtaskId: string, targetTaskId: string) => void
}

interface SubtaskItemProps {
  subtask: Subtask
  onUpdate: (subtask: Subtask) => void
  onToggleComplete: () => void
  onDelete: () => void
  onAddNew?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveToTask?: () => void
  canMoveToAnotherTask?: boolean
  onCopyToTask?: () => void
}

function SubtaskItem({
  subtask,
  onUpdate,
  onToggleComplete,
  onDelete,
  onAddNew,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  onMoveToTask,
  canMoveToAnotherTask = false,
  onCopyToTask
}: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(subtask.name)
  const [editIterations, setEditIterations] = useState(subtask.iterations.toString())
  const rowRef = useRef<HTMLDivElement>(null)
  const editNameRef = useRef<HTMLTextAreaElement>(null)
  const [rowWidth, setRowWidth] = useState(0)

  const resizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 144)}px`
  }

  useEffect(() => {
    if (!rowRef.current) return

    const element = rowRef.current
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0
      setRowWidth(nextWidth)
    })

    observer.observe(element)
    setRowWidth(element.getBoundingClientRect().width)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    resizeTextarea(editNameRef.current)
  }, [editName, isEditing])

  const layoutMode = rowWidth >= 440 ? 'comfortable' : rowWidth >= 360 ? 'compact' : rowWidth >= 300 ? 'tight' : 'ultra'
  const showInlineMoveButtons = layoutMode === 'comfortable'
  const showIterationsBadge = layoutMode === 'comfortable' || layoutMode === 'compact'
  const controlButtonClass =
    layoutMode === 'comfortable' ? 'h-7 w-7' : layoutMode === 'compact' ? 'h-6 w-6' : 'h-5 w-5'
  const controlIconSize = layoutMode === 'comfortable' ? 14 : layoutMode === 'compact' ? 12 : 11
  const rowGapClass = layoutMode === 'comfortable' ? 'gap-2' : 'gap-1.5'
  const controlGapClass = layoutMode === 'comfortable' ? 'gap-1' : 'gap-0.5'
  const gridGapClass = layoutMode === 'comfortable' ? 'gap-1' : 'gap-0.5'

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditName(subtask.name)
    setEditIterations(subtask.iterations.toString())
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setEditName(subtask.name)
    setEditIterations(subtask.iterations.toString())
    setIsEditing(false)
  }

  const saveEditing = (triggerNewSubtask = false) => {
    if (!editName.trim()) {
      cancelEditing()
      return
    }
    
    const iterations = parseInt(editIterations) || 1
    if (iterations < 1) {
      cancelEditing()
      return
    }

    onUpdate({
      ...subtask,
      name: editName.trim(),
      iterations
    })

    setIsEditing(false)
    
    if (triggerNewSubtask && onAddNew) {
      onAddNew()
    }
  }

  const handleBlur = () => {
    setTimeout(() => {
      const activeElement = document.activeElement
      const isStillInEditMode = activeElement?.closest('.subtask-edit-container')
      
      if (!isStillInEditMode) {
        saveEditing(false)
      }
    }, 100)
  }

  return (
    <div
      ref={rowRef}
      className={cn(
        'flex w-full max-w-full min-w-0 items-start sm:items-center overflow-hidden text-sm p-1.5 rounded transition-all',
        rowGapClass
      )}
    >
      <Checkbox
        checked={subtask.completed}
        onCheckedChange={onToggleComplete}
        className="h-4 w-4 mt-0.5 sm:mt-0 shrink-0"
      />
      
      {isEditing ? (
        <div className="flex flex-1 min-w-0 items-start gap-2 overflow-hidden subtask-edit-container">
          <Textarea
            ref={editNameRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                saveEditing(true)
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                cancelEditing()
              }
            }}
            onBlur={handleBlur}
            className="min-h-[2.5rem] max-h-36 resize-none overflow-y-auto text-base leading-tight flex-1 min-w-0"
            placeholder="Subtask name"
            autoFocus
          />
          <Input
            type="number"
            min="1"
            value={editIterations}
            onChange={(e) => setEditIterations(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEditing(true)
              if (e.key === 'Escape') cancelEditing()
            }}
            onBlur={handleBlur}
            className="h-10 w-14 sm:w-20 text-base shrink-0"
            placeholder="Iter"
          />
        </div>
      ) : (
        <div className={cn('grid flex-1 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start', gridGapClass)}>
          <div className="min-w-0">
            <span
              onClick={startEditing}
              className={cn(
                'block w-full whitespace-normal break-words text-xs leading-snug cursor-pointer hover:text-accent transition-colors',
                subtask.completed && 'line-through text-muted-foreground'
              )}
            >
              {subtask.name}
            </span>
          </div>
          <div className={cn('flex max-w-full items-center shrink-0', controlGapClass)}>
            {showInlineMoveButtons && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className={controlButtonClass}
                  onClick={onMoveUp}
                  disabled={!canMoveUp}
                  title="Move subtask up"
                >
                  <CaretUp size={controlIconSize} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={controlButtonClass}
                  onClick={onMoveDown}
                  disabled={!canMoveDown}
                  title="Move subtask down"
                >
                  <CaretDown size={controlIconSize} />
                </Button>
              </>
            )}
            {showIterationsBadge && (
              <Badge 
                variant="outline" 
                className={cn(
                  'cursor-pointer hover:bg-accent/10 transition-colors shrink-0',
                  layoutMode === 'comfortable' ? 'text-xs' : 'text-[10px] px-1'
                )}
                onClick={startEditing}
              >
                {subtask.iterations}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(controlButtonClass, 'shrink-0')}
                  title="More actions"
                >
                  <DotsThree size={controlIconSize} weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={startEditing}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onMoveUp} disabled={!canMoveUp}>
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onMoveDown} disabled={!canMoveDown}>
                  Move down
                </DropdownMenuItem>
                {canMoveToAnotherTask && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onMoveToTask}>
                      Move to task...
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onCopyToTask}>
                      Copy to task...
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </div>
  )
}

export function TaskItem({ 
  task, 
  onUpdate, 
  onDelete, 
  isActive,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragging = false,
  isDragOver = false,
  onSelect,
  onTouchReorder,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  otherTasks = [],
  onMoveSubtaskToTask,
  onCopySubtaskToTask
}: TaskItemProps) {
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)
  const [subtaskName, setSubtaskName] = useState('')
  const [subtaskIterations, setSubtaskIterations] = useState('1')
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(task.name)
  const [editIterations, setEditIterations] = useState(task.iterations.toString())
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false)
  const [subtaskToMove, setSubtaskToMove] = useState<string | null>(null)
  const [subtaskToCopy, setSubtaskToCopy] = useState<string | null>(null)
  const subtaskInputRef = useRef<HTMLTextAreaElement>(null)

  const resizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 192)}px`
  }

  useEffect(() => {
    resizeTextarea(subtaskInputRef.current)
  }, [subtaskName, isAddingSubtask])

  const totalIterations = calculateTaskIterations(task)
  const timeCalc = calculateTotalTime(totalIterations)
  const timeUntilReactivation = getTimeUntilReactivation(task)

  const toggleCollapse = () => {
    onUpdate({ ...task, collapsed: !task.collapsed })
  }

  const toggleComplete = () => {
    const newCompletedState = !task.completed
    const updatedSubtasks = task.subtasks.map(st => ({ ...st, completed: newCompletedState }))
    
    onUpdate({ 
      ...task, 
      completed: newCompletedState,
      subtasks: updatedSubtasks
    })
  }

  const togglePriority = (e: React.MouseEvent) => {
    e.stopPropagation()
    onUpdate({ ...task, isHighPriority: !task.isHighPriority })
  }

  const toggleSubtaskComplete = (subtaskId: string) => {
    const subtask = task.subtasks.find(st => st.id === subtaskId)
    const updatedSubtasks = task.subtasks.map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    )
    
    const isUnticking = subtask?.completed === true
    const shouldUntickParent = isUnticking && task.completed
    const allSubtasksComplete = updatedSubtasks.every(st => st.completed)
    const shouldCompleteParent = !isUnticking && allSubtasksComplete && !task.completed
    
    const incompleteSubtasks = updatedSubtasks.filter(st => !st.completed)
    const completedSubtasks = updatedSubtasks.filter(st => st.completed)
    const reorderedSubtasks = [...incompleteSubtasks, ...completedSubtasks]
    
    onUpdate({ 
      ...task, 
      subtasks: reorderedSubtasks,
      completed: shouldCompleteParent ? true : shouldUntickParent ? false : task.completed
    })
  }

  const updateSubtask = (subtaskId: string, updatedSubtask: Subtask) => {
    const updatedSubtasks = task.subtasks.map(st =>
      st.id === subtaskId ? updatedSubtask : st
    )
    onUpdate({ ...task, subtasks: updatedSubtasks })
  }

  const moveSubtask = (subtaskId: string, direction: 'up' | 'down') => {
    const currentIndex = task.subtasks.findIndex(st => st.id === subtaskId)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= task.subtasks.length) return

    const newSubtasks = [...task.subtasks]
    const [movedSubtask] = newSubtasks.splice(currentIndex, 1)
    newSubtasks.splice(targetIndex, 0, movedSubtask)

    onUpdate({
      ...task,
      subtasks: newSubtasks
    })
  }

  const addSubtask = () => {
    if (!subtaskName.trim()) return
    
    const iterations = parseInt(subtaskIterations) || 1
    if (iterations < 1) return

    const newSubtask: Subtask = {
      id: `subtask-${Date.now()}`,
      name: subtaskName.trim(),
      iterations,
      completed: false
    }

    const firstCompletedIndex = task.subtasks.findIndex(st => st.completed)
    const updatedSubtasks = [...task.subtasks]

    if (firstCompletedIndex === -1) {
      updatedSubtasks.push(newSubtask)
    } else {
      updatedSubtasks.splice(firstCompletedIndex, 0, newSubtask)
    }

    onUpdate({
      ...task,
      subtasks: updatedSubtasks
    })

    setSubtaskName('')
    setSubtaskIterations('1')
  }

  const addSubtaskAndKeepOpen = () => {
    addSubtask()
  }

  const deleteSubtask = (subtaskId: string) => {
    onUpdate({
      ...task,
      subtasks: task.subtasks.filter(st => st.id !== subtaskId)
    })
  }

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditName(task.name)
    setEditIterations(task.iterations.toString())
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setEditName(task.name)
    setEditIterations(task.iterations.toString())
    setIsEditing(false)
  }

  const saveEditing = (triggerNewTask = false) => {
    if (!editName.trim()) {
      cancelEditing()
      return
    }
    
    const hasSubtasks = task.subtasks.length > 0
    
    if (hasSubtasks) {
      onUpdate({
        ...task,
        name: editName.trim()
      })
    } else {
      const iterations = parseInt(editIterations) || 1
      if (iterations < 1) {
        cancelEditing()
        return
      }

      onUpdate({
        ...task,
        name: editName.trim(),
        iterations
      })
    }

    setIsEditing(false)
    
    if (triggerNewTask) {
      setTimeout(() => {
        const addButton = document.querySelector('[data-add-task-button]') as HTMLElement
        if (addButton) {
          addButton.click()
        }
      }, 50)
    }
  }

  const handleBlur = () => {
    setTimeout(() => {
      const activeElement = document.activeElement
      const isStillInEditMode = activeElement?.closest('.task-edit-container')
      
      if (!isStillInEditMode) {
        saveEditing(false)
      }
    }, 100)
  }

  const handleSaveRecurrence = (recurrence: RecurrenceSettings) => {
    onUpdate({ ...task, recurrence })
  }

  const handleMoveUp = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (onMoveUp) {
      onMoveUp()
      return
    }
    onTouchReorder?.('up')
  }

  const handleMoveDown = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (onMoveDown) {
      onMoveDown()
      return
    }
    onTouchReorder?.('down')
  }

  const canMoveUpAction = canMoveUp || Boolean(onTouchReorder)
  const canMoveDownAction = canMoveDown || Boolean(onTouchReorder)
  const incompleteSubtasks = task.subtasks.filter(subtask => !subtask.completed)
  const completedSubtasks = task.subtasks.filter(subtask => subtask.completed)

  return (
    <div
      draggable={Boolean(onDragStart || onDrop)}
      onDragStart={(e) => {
        e.stopPropagation()
        onDragStart?.()
      }}
      onDragEnd={(e) => {
        e.stopPropagation()
        onDragEnd?.()
      }}
      onDragOver={(e) => onDragOver?.(e)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDrop?.()
      }}
      className={cn(
        'border rounded-lg p-2.5 sm:p-3 transition-all relative',
        isActive ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-border bg-card',
        task.completed && 'opacity-60',
        task.isHighPriority && !task.completed && 'border-primary bg-primary/5',
        isDragging && 'opacity-50',
        isDragOver && 'ring-2 ring-primary/30'
      )}
    >
      <div className="flex items-start gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="h-7 w-7 shrink-0"
        >
          {task.collapsed ? <CaretRight size={16} /> : <CaretDown size={16} />}
        </Button>
        <Checkbox
          checked={task.completed}
          onCheckedChange={toggleComplete}
          className="mt-1 relative z-10 cursor-pointer"
        />
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2 task-edit-container">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEditing(true)
                  if (e.key === 'Escape') cancelEditing()
                }}
                onBlur={handleBlur}
                className="h-10 text-base flex-1 min-w-0"
                placeholder="Task name"
                autoFocus
              />
              {task.subtasks.length === 0 ? (
                <Input
                  type="number"
                  min="1"
                  value={editIterations}
                  onChange={(e) => setEditIterations(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEditing(true)
                    if (e.key === 'Escape') cancelEditing()
                  }}
                  onBlur={handleBlur}
                  className="h-10 w-14 sm:w-20 text-base"
                  placeholder="Iter"
                />
              ) : (
                <Badge variant="secondary" className="text-[10px] sm:text-xs h-10 px-2 sm:px-3 shrink-0 whitespace-nowrap">
                  {totalIterations}×
                </Badge>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {task.isHighPriority && !task.completed && (
                <Star size={16} weight="fill" className="text-primary" />
              )}
              <span
                onClick={startEditing}
                className={cn(
                  'font-medium text-base md:text-sm cursor-pointer hover:text-accent transition-colors',
                  task.completed && 'line-through text-muted-foreground'
                )}
              >
                {task.name}
              </span>
              <Badge 
                variant="secondary" 
                className="text-[10px] md:text-xs cursor-pointer hover:bg-accent/20 transition-colors px-1.5 md:px-2.5 h-5 md:h-auto"
                onClick={startEditing}
              >
                <span className="md:hidden">{totalIterations}×</span>
                <span className="hidden md:inline">{totalIterations} {totalIterations === 1 ? 'iteration' : 'iterations'}</span>
              </Badge>
              <span className="text-[10px] md:text-xs text-muted-foreground">
                {formatTimeDisplay(timeCalc.days, timeCalc.hours, timeCalc.minutes)}
              </span>
              {task.recurrence?.enabled && (
                <Badge 
                  variant="outline" 
                  className="text-[10px] md:text-xs gap-1 px-1.5 md:px-2.5 h-5 md:h-auto border-primary/50 text-primary cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowRecurrenceDialog(true)
                  }}
                  title={timeUntilReactivation || undefined}
                >
                  <ArrowClockwise size={12} weight="bold" />
                  <span className="hidden md:inline">{formatRecurrenceDescription(task.recurrence.interval, task.recurrence.unit)}</span>
                </Badge>
              )}
              {task.completed && task.recurrence?.enabled && timeUntilReactivation && (
                <span className="text-[10px] text-muted-foreground">
                  {timeUntilReactivation}
                </span>
              )}
            </div>
          )}

          {!task.collapsed && task.subtasks.length > 0 && (
            <div className="mt-2 ml-2 sm:ml-4 min-w-0 max-w-full space-y-1 overflow-hidden">
              {incompleteSubtasks.map((subtask) => {
                const subtaskIndex = task.subtasks.findIndex(st => st.id === subtask.id)

                return (
                <SubtaskItem
                  key={subtask.id}
                  subtask={subtask}
                  onUpdate={(updatedSubtask) => updateSubtask(subtask.id, updatedSubtask)}
                  onToggleComplete={() => toggleSubtaskComplete(subtask.id)}
                  onDelete={() => deleteSubtask(subtask.id)}
                  onAddNew={() => setIsAddingSubtask(true)}
                  onMoveUp={() => moveSubtask(subtask.id, 'up')}
                  onMoveDown={() => moveSubtask(subtask.id, 'down')}
                  canMoveUp={subtaskIndex > 0}
                  canMoveDown={subtaskIndex < task.subtasks.length - 1}
                  onMoveToTask={() => setSubtaskToMove(subtask.id)}
                  canMoveToAnotherTask={true}
                  onCopyToTask={() => setSubtaskToCopy(subtask.id)}
                />
                )
              })}
            </div>
          )}

          {!task.collapsed && isAddingSubtask && (
            <div className="mt-2 ml-2 sm:ml-4 flex flex-col sm:flex-row gap-2">
              <Textarea
                ref={subtaskInputRef}
                id="subtask-name"
                placeholder="Subtask name"
                rows={2}
                value={subtaskName}
                onChange={(e) => setSubtaskName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    addSubtaskAndKeepOpen()
                    setTimeout(() => subtaskInputRef.current?.focus(), 50)
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setIsAddingSubtask(false)
                  }
                }}
                className="min-h-[2.5rem] max-h-48 resize-none overflow-y-auto text-sm leading-snug flex-1 min-w-0"
                autoFocus
              />
              <Input
                id="subtask-iterations"
                type="number"
                min="1"
                placeholder="Iter"
                value={subtaskIterations}
                onChange={(e) => setSubtaskIterations(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addSubtaskAndKeepOpen()
                    setTimeout(() => subtaskInputRef.current?.focus(), 50)
                  }
                }}
                className="h-8 w-14 sm:w-16 text-xs"
              />
              <Button
                size="sm"
                onClick={() => {
                  addSubtask()
                  setIsAddingSubtask(false)
                }}
                className="h-8 px-2 sm:px-3 shrink-0"
              >
                Add
              </Button>
            </div>
          )}

          {!task.collapsed && !isAddingSubtask && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 ml-2 sm:ml-4 h-8 text-xs"
              onClick={() => setIsAddingSubtask(true)}
            >
              <Plus size={14} className="mr-1" />
              Add Subtask
            </Button>
          )}

          {!task.collapsed && completedSubtasks.length > 0 && (
            <div className="mt-2 ml-2 sm:ml-4 min-w-0 max-w-full space-y-1 overflow-hidden">
              {completedSubtasks.map((subtask) => {
                const subtaskIndex = task.subtasks.findIndex(st => st.id === subtask.id)

                return (
                <SubtaskItem
                  key={subtask.id}
                  subtask={subtask}
                  onUpdate={(updatedSubtask) => updateSubtask(subtask.id, updatedSubtask)}
                  onToggleComplete={() => toggleSubtaskComplete(subtask.id)}
                  onDelete={() => deleteSubtask(subtask.id)}
                  onAddNew={() => setIsAddingSubtask(true)}
                  onMoveUp={() => moveSubtask(subtask.id, 'up')}
                  onMoveDown={() => moveSubtask(subtask.id, 'down')}
                  canMoveUp={subtaskIndex > 0}
                  canMoveDown={subtaskIndex < task.subtasks.length - 1}
                  onMoveToTask={() => setSubtaskToMove(subtask.id)}
                  canMoveToAnotherTask={true}
                  onCopyToTask={() => setSubtaskToCopy(subtask.id)}
                />
                )
              })}
            </div>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center justify-end gap-1.5 flex-wrap shrink-0">
            {/* Move controls */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMoveUp}
              className="h-8 w-8"
              disabled={!canMoveUpAction}
              title="Move task up"
            >
              <CaretUp size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMoveDown}
              className="h-8 w-8"
              disabled={!canMoveDownAction}
              title="Move task down"
            >
              <CaretDown size={16} />
            </Button>

            {/* Primary action - Select/Play */}
            {!task.completed && onSelect && (
              <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect()
                }}
                className="h-8 px-2 text-xs"
                title="Set as current task"
              >
                <PlayCircle size={16} className="sm:mr-1" weight={isActive ? "fill" : "regular"} />
                <span className="hidden sm:inline">{isActive ? 'Active' : 'Select'}</span>
              </Button>
            )}

            {/* Secondary actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="More options"
                >
                  <DotsThree size={16} weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleMoveUp}
                  disabled={!canMoveUpAction}
                >
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleMoveDown}
                  disabled={!canMoveDownAction}
                >
                  Move down
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {!task.completed && (
                  <>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowRecurrenceDialog(true)
                      }}
                      className={cn(
                        task.recurrence?.enabled && "text-primary font-semibold"
                      )}
                    >
                      <ArrowClockwise size={16} className="mr-2" weight={task.recurrence?.enabled ? "bold" : "regular"} />
                      {task.recurrence?.enabled 
                        ? `Recurrence: ${formatRecurrenceDescription(task.recurrence.interval, task.recurrence.unit)}`
                        : 'Set recurrence'
                      }
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={togglePriority}
                      className={cn(
                        task.isHighPriority && "text-primary font-semibold"
                      )}
                    >
                      <Star size={16} className="mr-2" weight={task.isHighPriority ? "fill" : "regular"} />
                      {task.isHighPriority ? 'Remove high priority' : 'Set high priority'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash size={16} className="mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      
      <RecurrenceDialog
        open={showRecurrenceDialog}
        onOpenChange={setShowRecurrenceDialog}
        recurrence={task.recurrence}
        onSave={handleSaveRecurrence}
      />

      {subtaskToMove && (
        <AlertDialog open={!!subtaskToMove} onOpenChange={(open) => !open && setSubtaskToMove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Move subtask to task</AlertDialogTitle>
              <AlertDialogDescription>
                Select a task to move this subtask to:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {otherTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No other tasks available</p>
              ) : (
                otherTasks.map((t) => (
                  <Button
                    key={t.id}
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={() => {
                      if (onMoveSubtaskToTask) {
                        onMoveSubtaskToTask(subtaskToMove, t.id)
                      }
                      setSubtaskToMove(null)
                    }}
                  >
                    {t.name}
                  </Button>
                ))
              )}
            </div>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {subtaskToCopy && (
        <AlertDialog open={!!subtaskToCopy} onOpenChange={(open) => !open && setSubtaskToCopy(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Copy subtask to task</AlertDialogTitle>
              <AlertDialogDescription>
                Select a task to copy this subtask to:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {otherTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No other tasks available</p>
              ) : (
                otherTasks.map((t) => (
                  <Button
                    key={t.id}
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={() => {
                      if (onCopySubtaskToTask) {
                        onCopySubtaskToTask(subtaskToCopy, t.id)
                      }
                      setSubtaskToCopy(null)
                    }}
                  >
                    {t.name}
                  </Button>
                ))
              )}
            </div>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
