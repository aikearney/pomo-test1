import { useRef, useState } from 'react'
import { Task, Subtask, RecurrenceSettings } from '@/lib/types'
import { calculateTaskIterations, formatTimeDisplay, calculateTotalTime, formatRecurrenceDescription, getTimeUntilReactivation } from '@/lib/timer-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { CaretDown, CaretRight, Plus, Trash, PlayCircle, CaretUp, Star, ArrowClockwise, DotsThree } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { RecurrenceDialog } from '@/components/RecurrenceDialog'

interface TaskItemProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: () => void
  isActive: boolean
  onSelect?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
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
  canMoveDown = false
}: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(subtask.name)
  const [editIterations, setEditIterations] = useState(subtask.iterations.toString())

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
      className={cn(
        'flex items-start sm:items-center gap-2 text-sm p-1.5 rounded transition-all'
      )}
    >
      <Checkbox
        checked={subtask.completed}
        onCheckedChange={onToggleComplete}
        className="h-4 w-4 mt-0.5 sm:mt-0"
      />
      
      {isEditing ? (
        <div className="flex items-center gap-2 flex-1 subtask-edit-container">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEditing(true)
              if (e.key === 'Escape') cancelEditing()
            }}
            onBlur={handleBlur}
            className="h-10 text-base flex-1 min-w-0"
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
            className="h-10 w-14 sm:w-20 text-base"
            placeholder="Iter"
          />
        </div>
      ) : (
        <>
          <span
            onClick={startEditing}
            className={cn(
              'flex-1 text-xs cursor-pointer hover:text-accent transition-colors',
              subtask.completed && 'line-through text-muted-foreground'
            )}
          >
            {subtask.name}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Move subtask up"
            >
              <CaretUp size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Move subtask down"
            >
              <CaretDown size={14} />
            </Button>
          </div>
          <Badge 
            variant="outline" 
            className="text-xs cursor-pointer hover:bg-accent/10 transition-colors shrink-0"
            onClick={startEditing}
          >
            {subtask.iterations}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="More actions"
              >
                <DotsThree size={14} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onMoveUp} disabled={!canMoveUp}>
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMoveDown} disabled={!canMoveDown}>
                Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  )
}

export function TaskItem({ 
  task, 
  onUpdate, 
  onDelete, 
  isActive,
  onSelect,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false
}: TaskItemProps) {
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)
  const [subtaskName, setSubtaskName] = useState('')
  const [subtaskIterations, setSubtaskIterations] = useState('1')
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(task.name)
  const [editIterations, setEditIterations] = useState(task.iterations.toString())
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false)
  const subtaskInputRef = useRef<HTMLInputElement>(null)

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
    
    const incompleteSubtasks = updatedSubtasks.filter(st => !st.completed)
    const completedSubtasks = updatedSubtasks.filter(st => st.completed)
    const reorderedSubtasks = [...incompleteSubtasks, ...completedSubtasks]
    
    onUpdate({ 
      ...task, 
      subtasks: reorderedSubtasks,
      completed: shouldUntickParent ? false : task.completed
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

  return (
    <div
      className={cn(
        'border rounded-lg p-2.5 sm:p-3 transition-all relative',
        isActive ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-border bg-card',
        task.completed && 'opacity-60',
        task.isHighPriority && !task.completed && 'border-primary bg-primary/5'
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
          className="mt-1"
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
            <div className="mt-2 ml-2 sm:ml-4 space-y-1">
              {task.subtasks.map((subtask, index) => (
                <SubtaskItem
                  key={subtask.id}
                  subtask={subtask}
                  onUpdate={(updatedSubtask) => updateSubtask(subtask.id, updatedSubtask)}
                  onToggleComplete={() => toggleSubtaskComplete(subtask.id)}
                  onDelete={() => deleteSubtask(subtask.id)}
                  onAddNew={() => setIsAddingSubtask(true)}
                  onMoveUp={() => moveSubtask(subtask.id, 'up')}
                  onMoveDown={() => moveSubtask(subtask.id, 'down')}
                  canMoveUp={index > 0}
                  canMoveDown={index < task.subtasks.length - 1}
                />
              ))}
            </div>
          )}

          {!task.collapsed && isAddingSubtask && (
            <div className="mt-2 ml-2 sm:ml-4 flex flex-col sm:flex-row gap-2">
              <Input
                ref={subtaskInputRef}
                id="subtask-name"
                placeholder="Subtask name"
                value={subtaskName}
                onChange={(e) => setSubtaskName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addSubtaskAndKeepOpen()
                    setTimeout(() => subtaskInputRef.current?.focus(), 50)
                  }
                }}
                className="h-8 text-xs flex-1 min-w-0"
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
        </div>

        {!isEditing && (
          <div className="flex items-center justify-end gap-1.5 flex-wrap shrink-0">
            {/* Move controls */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onMoveUp?.()
              }}
              className="h-8 w-8"
              disabled={!canMoveUp}
              title="Move task up"
            >
              <CaretUp size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onMoveDown?.()
              }}
              className="h-8 w-8"
              disabled={!canMoveDown}
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
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveUp?.()
                  }}
                  disabled={!canMoveUp}
                >
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveDown?.()
                  }}
                  disabled={!canMoveDown}
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
    </div>
  )
}
