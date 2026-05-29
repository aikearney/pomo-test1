import { Statistics } from '@/lib/types'
import { calculateTotalTime, formatTimeDisplay } from '@/lib/timer-utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { CheckCircle, Clock, Fire, Trophy } from '@phosphor-icons/react'

interface StatisticsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  statistics: Statistics
}

export function StatisticsDialog({ open, onOpenChange, statistics }: StatisticsDialogProps) {
  const totalTime = calculateTotalTime(statistics.totalCompletedIterations)
  const todayTime = calculateTotalTime(Math.floor(statistics.focusTimeToday / 25))
  
  const recentTasks = statistics.completedTaskHistory.slice(0, 10)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Statistics</DialogTitle>
          <DialogDescription>
            Your Pomodoro productivity overview
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          <div className="space-y-6 pr-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Trophy size={24} className="text-primary" weight="fill" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{statistics.totalCompletedTasks}</p>
                    <p className="text-xs text-muted-foreground">Total Tasks Completed</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Fire size={24} className="text-accent" weight="fill" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{statistics.totalCompletedIterations}</p>
                    <p className="text-xs text-muted-foreground">Total Focus Sessions</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Clock size={24} className="text-primary" weight="fill" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {formatTimeDisplay(totalTime.days, totalTime.hours, totalTime.minutes)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Focus Time</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <CheckCircle size={24} className="text-accent" weight="fill" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {formatTimeDisplay(todayTime.days, todayTime.hours, todayTime.minutes)}
                    </p>
                    <p className="text-xs text-muted-foreground">Focus Time Today</p>
                  </div>
                </div>
              </Card>
            </div>

            <div>
              <h3 className="font-medium mb-3">Recently Completed Tasks</h3>
              {recentTasks.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No completed tasks yet</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {recentTasks.map((task, index) => {
                    const date = new Date(task.completedAt)
                    const formattedDate = date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                    const formattedTime = date.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit'
                    })

                    return (
                      <Card key={`${task.completedAt}-${index}`} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{task.taskName}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.completedIterations} iteration{task.completedIterations !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{formattedDate}</p>
                            <p className="text-xs text-muted-foreground">{formattedTime}</p>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
