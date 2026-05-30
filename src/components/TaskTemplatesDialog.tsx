import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MagnifyingGlass, Plus, ArrowClockwise } from '@phosphor-icons/react'
import {
  TASK_TEMPLATES,
  getAllCategories,
  getTemplatesByCategory,
  searchTemplates,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  type TaskTemplate,
  type TaskCategory,
} from '@/lib/task-templates'
import { Task } from '@/lib/types'

interface TaskTemplatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddTask: (task: Task) => void
  existingTasks: Task[]
}

export function TaskTemplatesDialog({
  open,
  onOpenChange,
  onAddTask,
  existingTasks,
}: TaskTemplatesDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | 'all'>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)
  const [taskName, setTaskName] = useState('')
  const [recurrenceInterval, setRecurrenceInterval] = useState<string>('')
  const [recurrenceUnit, setRecurrenceUnit] = useState<'days' | 'weeks' | 'months'>('weeks')
  
  const categories = getAllCategories()
  
  const displayedTemplates = searchQuery
    ? searchTemplates(searchQuery)
    : selectedCategory === 'all'
    ? TASK_TEMPLATES
    : getTemplatesByCategory(selectedCategory)

  const isTemplateAlreadyAdded = (templateId: string) => {
    return existingTasks.some(task => task.templateId === templateId)
  }

  const handleSelectTemplate = (template: TaskTemplate) => {
    setSelectedTemplate(template)
    setTaskName(template.name)
    setRecurrenceInterval(template.recurrenceInterval.toString())
    setRecurrenceUnit(template.recurrenceUnit)
  }

  const handleConfirmAdd = () => {
    if (!selectedTemplate) return

    const interval = parseInt(recurrenceInterval)
    if (isNaN(interval) || interval < 1) {
      return
    }

    if (!taskName.trim()) {
      return
    }

    const newTask: Task = {
      id: `task-${Date.now()}`,
      name: taskName.trim(),
      iterations: selectedTemplate.iterations,
      subtasks: [],
      completed: false,
      collapsed: false,
      templateId: selectedTemplate.id,
      recurrence: {
        enabled: true,
        interval,
        unit: recurrenceUnit,
      },
    }
    
    onAddTask(newTask)
    setSelectedTemplate(null)
    setTaskName('')
    setRecurrenceInterval('')
    setRecurrenceUnit('weeks')
    onOpenChange(false)
  }

  const handleCancelRecurrence = () => {
    setSelectedTemplate(null)
    setTaskName('')
    setRecurrenceInterval('')
    setRecurrenceUnit('weeks')
  }

  const formatRecurrence = (interval: number, unit: string) => {
    const unitLabel = interval === 1 ? unit.slice(0, -1) : unit
    return `Every ${interval} ${unitLabel}`
  }

  return (
    <>
      <Dialog open={open && !selectedTemplate} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto sm:max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              Recurring Task Templates
            </DialogTitle>
            <DialogDescription>
              Choose from common household tasks that automatically repeat
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0 px-6 pb-6 space-y-4">
            <div className="relative">
              <MagnifyingGlass
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs
              value={selectedCategory}
              onValueChange={(value) => {
                setSelectedCategory(value as TaskCategory | 'all')
                setSearchQuery('')
              }}
              className="flex flex-col flex-1 min-h-0"
            >
              <ScrollArea className="w-full pb-2">
                <TabsList className="inline-flex w-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {categories.map((category) => (
                    <TabsTrigger key={category} value={category}>
                      <span className="mr-1">{CATEGORY_ICONS[category]}</span>
                      {CATEGORY_LABELS[category]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              <TabsContent value={selectedCategory} className="mt-4 flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-[50vh] sm:h-[400px]">
                  <div className="space-y-2 pr-4">
                    {displayedTemplates.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>No templates found</p>
                        {searchQuery && (
                          <Button
                            variant="link"
                            onClick={() => setSearchQuery('')}
                            className="mt-2"
                          >
                            Clear search
                          </Button>
                        )}
                      </div>
                    ) : (
                      displayedTemplates.map((template) => {
                        const alreadyAdded = isTemplateAlreadyAdded(template.id)
                        return (
                          <div
                            key={template.id}
                            className={`flex items-start justify-between gap-3 p-3 rounded-lg border transition-colors ${
                              alreadyAdded
                                ? 'bg-muted/50 opacity-50 cursor-not-allowed'
                                : 'bg-card hover:bg-accent/5 group'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">
                                  {CATEGORY_ICONS[template.category]}
                                </span>
                                <h3 className="font-medium text-sm">
                                  {template.name}
                                </h3>
                                {alreadyAdded && (
                                  <Badge variant="secondary" className="text-xs ml-auto">
                                    Already added
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">
                                {template.description}
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {template.iterations} {template.iterations === 1 ? 'iteration' : 'iterations'}
                                </Badge>
                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                  <ArrowClockwise size={12} />
                                  {formatRecurrence(
                                    template.recurrenceInterval,
                                    template.recurrenceUnit
                                  )}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSelectTemplate(template)}
                              className="shrink-0"
                              disabled={alreadyAdded}
                            >
                              <Plus size={16} className="mr-1" />
                              Add
                            </Button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <p>{displayedTemplates.length} templates available</p>
              <p>Tasks will auto-repeat after completion</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && handleCancelRecurrence()}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize Task</DialogTitle>
            <DialogDescription>
              Customize the task name and recurrence settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task name</Label>
              <Input
                id="task-name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="Enter task name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurrence-interval">Repeat every</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="recurrence-interval"
                  type="number"
                  min="1"
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(e.target.value)}
                  className="w-full sm:w-24"
                />
                <Select value={recurrenceUnit} onValueChange={(value) => setRecurrenceUnit(value as 'days' | 'weeks' | 'months')}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {taskName.trim() && recurrenceInterval && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Preview</p>
                <p className="text-sm font-medium">
                  {taskName.trim()} will repeat every{' '}
                  {recurrenceInterval || '?'}{' '}
                  {recurrenceInterval === '1' 
                    ? recurrenceUnit.slice(0, -1) 
                    : recurrenceUnit}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelRecurrence}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmAdd}
              disabled={!taskName.trim() || !recurrenceInterval || parseInt(recurrenceInterval) < 1}
            >
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
