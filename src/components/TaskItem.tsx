import { useState, useRef } from 'react'
import { Task, Subtask, RecurrenceSettings } from '@/lib/types'
import { calculateTaskIterations, formatTimeDisplay, calculateTotalTime, formatRecurrenceDescription, getTimeUntilReactivation } from '@/lib/timer-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { CaretDown, CaretRight, Plus, Trash, Square, DotsSixVertical, PlayCircle, CaretUp, X, Star, ArrowClockwise } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { RecurrenceDialog } from '@/components/RecurrenceDialog'

interface TaskItemProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: () => void
  isActive: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  isDragging: boolean
  isDragOver: boolean
  onSelect?: () => void
  onTouchReorder?: (direction: 'up' | 'down') => void
}

interface SubtaskItemProps {
  subtask: Subtask
  onUpdate: (subtask: Subtask) => void
  onToggleComplete: () => void
  onDelete: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  isDragging: boolean
  isDragOver: boolean
  onAddNew?: () => void
}

function SubtaskItem({
  subtask,
  onUpdate,
  onToggleComplete,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragging,
  isDragOver,
  onAddNew
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
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'flex items-center gap-2 text-sm p-1.5 rounded transition-all',
        isDragging && 'opacity-50 scale-95 rotate-1',
        isDragOver && 'bg-accent/20 scale-[1.02]'
      )}
    >
      <div 
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
        title="Drag to reorder"
      >
        <DotsSixVertical size={14} weight="bold" />
      </div>
      <Checkbox
        checked={subtask.completed}
        onCheckedChange={onToggleComplete}
        className="h-3.5 w-3.5"
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
          <Badge 
            variant="outline" 
            className="text-xs cursor-pointer hover:bg-accent/10 transition-colors"
            onClick={startEditing}
          >
            {subtask.iterations}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onDelete}
          >
            <Trash size={12} />
          </Button>
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
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragging,
  isDragOver,
  onSelect,
  onTouchReorder
}: TaskItemProps) {
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)
  const [subtaskName, setSubtaskName] = useState('')
  const [subtaskIterations, setSubtaskIterations] = useState('1')
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null)
  const [dragOverSubtaskId, setDragOverSubtaskId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(task.name)
  const [editIterations, setEditIterations] = useState(task.iterations.toString())
  const [showReorderButtons, setShowReorderButtons] = useState(false)
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false)
  const longPressTimer = useRef<number | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
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

    onUpdate({
      ...task,
      subtasks: [...task.subtasks, newSubtask]
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

  const handleSubtaskDragStart = (subtaskId: string) => {
    setDraggedSubtaskId(subtaskId)
  }

  const handleSubtaskDragEnd = () => {
    setDraggedSubtaskId(null)
    setDragOverSubtaskId(null)
  }

  const handleSubtaskDragOver = (e: React.DragEvent, subtaskId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedSubtaskId && draggedSubtaskId !== subtaskId) {
      setDragOverSubtaskId(subtaskId)
    }
  }

  const handleSubtaskDrop = (e: React.DragEvent, targetSubtaskId: string) => {
    e.stopPropagation()
    
    if (!draggedSubtaskId || draggedSubtaskId === targetSubtaskId) {
      return
    }

    const draggedIndex = task.subtasks.findIndex(st => st.id === draggedSubtaskId)
    const targetIndex = task.subtasks.findIndex(st => st.id === targetSubtaskId)

    if (draggedIndex === -1 || targetIndex === -1) {
      return
    }

    const newSubtasks = [...task.subtasks]
    const [draggedSubtask] = newSubtasks.splice(draggedIndex, 1)
    newSubtasks.splice(targetIndex, 0, draggedSubtask)

    onUpdate({
      ...task,
      subtasks: newSubtasks
    })

    setDraggedSubtaskId(null)
    setDragOverSubtaskId(null)
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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isEditing) return
    
    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    
    longPressTimer.current = window.setTimeout(() => {
      setShowReorderButtons(true)
    }, 500)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return
    
    const touch = e.touches[0]
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x)
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y)
    
    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
    }
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    touchStartPos.current = null
  }

  const handleReorder = (direction: 'up' | 'down') => {
    if (onTouchReorder) {
      onTouchReorder(direction)
    }
    setShowReorderButtons(false)
  }

  const handleSaveRecurrence = (recurrence: RecurrenceSettings) => {
    onUpdate({ ...task, recurrence })
  }

  return (
    <div
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn(
        'border rounded-lg p-3 transition-all relative',
        isActive ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-border bg-card',
        task.completed && 'opacity-60',
        task.isHighPriority && !task.completed && 'border-primary bg-primary/5',
        isDragging && 'opacity-50 scale-95 rotate-2',
        isDragOver && 'border-accent border-2 scale-[1.02] shadow-lg',
        showReorderButtons && 'ring-2 ring-primary'
      )}
    >
      {showReorderButtons && (
        <>
          <div 
            className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded-lg z-20 flex items-center justify-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="lg"
              variant="default"
              className="h-14 w-14 rounded-full shadow-lg"
              onClick={() => handleReorder('up')}
            >
              <CaretUp size={28} weight="bold" />
            </Button>
            <Button
              size="lg"
              variant="default"
              className="h-14 w-14 rounded-full shadow-lg"
              onClick={() => handleReorder('down')}
            >
              <CaretDown size={28} weight="bold" />
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-14 w-14 rounded-full shadow-lg"
              onClick={() => setShowReorderButtons(false)}
            >
              <X size={28} />
            </Button>
          </div>
        </>
      )}
      <div className="flex items-start gap-2">
        <div 
          className="cursor-grab active:cursor-grabbing mt-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Drag to reorder"
        >
          <DotsSixVertical size={16} weight="bold" />
        </div>
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
            <div className="mt-2 ml-4 space-y-1">
              {task.subtasks.map(subtask => (
                <SubtaskItem
                  key={subtask.id}
                  subtask={subtask}
                  onUpdate={(updatedSubtask) => updateSubtask(subtask.id, updatedSubtask)}
                  onToggleComplete={() => toggleSubtaskComplete(subtask.id)}
                  onDelete={() => deleteSubtask(subtask.id)}
                  onDragStart={() => handleSubtaskDragStart(subtask.id)}
                  onDragEnd={handleSubtaskDragEnd}
                  onDragOver={(e) => handleSubtaskDragOver(e, subtask.id)}
                  onDrop={(e) => handleSubtaskDrop(e, subtask.id)}
                  isDragging={draggedSubtaskId === subtask.id}
                  isDragOver={dragOverSubtaskId === subtask.id}
                  onAddNew={() => setIsAddingSubtask(true)}
                />
              ))}
            </div>
          )}

          {!task.collapsed && isAddingSubtask && (
            <div className="mt-2 ml-4 flex gap-2">
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
              className="mt-2 ml-4 h-7 text-xs"
              onClick={() => setIsAddingSubtask(true)}
            >
              <Plus size={14} className="mr-1" />
              Add Subtask
            </Button>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1">
            {!task.completed && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowRecurrenceDialog(true)
                  }}
                  className={cn(
                    "h-7 w-7",
                    task.recurrence?.enabled && "text-primary"
                  )}
                  title="Set recurrence"
                >
                  <ArrowClockwise size={16} weight={task.recurrence?.enabled ? "bold" : "regular"} />
                </Button>
                <Button
                  variant={task.isHighPriority ? "default" : "ghost"}
                  size="icon"
                  onClick={togglePriority}
                  className={cn(
                    "h-7 w-7",
                    task.isHighPriority && "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                  title={task.isHighPriority ? "Remove high priority" : "Set as high priority"}
                >
                  <Star size={16} weight={task.isHighPriority ? "fill" : "regular"} />
                </Button>
              </>
            )}
            {!task.completed && onSelect && (
              <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect()
                }}
                className="h-7 px-2 text-xs"
                title="Set as current task"
              >
                <PlayCircle size={16} className="mr-1" weight={isActive ? "fill" : "regular"} />
                {isActive ? 'Active' : 'Select'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-7 w-7"
            >
              <Trash size={16} />
            </Button>
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
