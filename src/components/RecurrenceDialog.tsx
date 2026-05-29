import { useState } from 'react'
import { RecurrenceSettings, RecurrenceUnit } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RecurrenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recurrence: RecurrenceSettings | undefined
  onSave: (recurrence: RecurrenceSettings) => void
}

export function RecurrenceDialog({ open, onOpenChange, recurrence, onSave }: RecurrenceDialogProps) {
  const [enabled, setEnabled] = useState(recurrence?.enabled ?? false)
  const [interval, setInterval] = useState((recurrence?.interval ?? 1).toString())
  const [unit, setUnit] = useState<RecurrenceUnit>(recurrence?.unit ?? 'weeks')

  const handleSave = () => {
    const intervalNum = parseInt(interval) || 1
    onSave({
      enabled,
      interval: Math.max(1, intervalNum),
      unit,
      lastCompletedAt: recurrence?.lastCompletedAt
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recurring Task Settings</DialogTitle>
          <DialogDescription>
            Set this task to automatically reappear after completion
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="recurrence-enabled" className="text-sm font-medium">
              Enable Recurrence
            </Label>
            <Switch
              id="recurrence-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="recurrence-interval" className="text-sm font-medium">
                  Repeat Every
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="recurrence-interval"
                    type="number"
                    min="1"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    className="w-20"
                  />
                  <Select value={unit} onValueChange={(value) => setUnit(value as RecurrenceUnit)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">
                        {parseInt(interval) === 1 ? 'Day' : 'Days'}
                      </SelectItem>
                      <SelectItem value="weeks">
                        {parseInt(interval) === 1 ? 'Week' : 'Weeks'}
                      </SelectItem>
                      <SelectItem value="months">
                        {parseInt(interval) === 1 ? 'Month' : 'Months'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="text-muted-foreground">
                  This task will automatically reappear at the top of your list{' '}
                  {parseInt(interval) === 1 ? (
                    <>every {unit === 'days' ? 'day' : unit === 'weeks' ? 'week' : 'month'}</>
                  ) : (
                    <>every {interval} {unit}</>
                  )}{' '}
                  after you mark it as complete.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
