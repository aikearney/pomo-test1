import { TimerPhase } from '@/lib/types'
import { formatTimerDisplay, WORK_DURATION, SHORT_BREAK_DURATION, LONG_BREAK_DURATION, ITERATIONS_BEFORE_LONG_BREAK } from '@/lib/timer-utils'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { BellSlash } from '@phosphor-icons/react'

interface TimerDisplayProps {
  phase: TimerPhase
  remainingSeconds: number
  completedIterations: number
  isCompact?: boolean
  isRunning?: boolean
  isMuted?: boolean
}

export function TimerDisplay({ phase, remainingSeconds, completedIterations, isCompact = false, isRunning = false, isMuted = false }: TimerDisplayProps) {
  const getPhaseLabel = () => {
    switch (phase) {
      case 'work':
        return 'Focus Time'
      case 'break':
        return 'Short Break'
      case 'longBreak':
        return 'Long Break'
      default:
        return 'Ready'
    }
  }

  const getPhaseColor = () => {
    return 'text-foreground'
  }

  const getPhaseDuration = () => {
    switch (phase) {
      case 'work':
        return WORK_DURATION
      case 'break':
        return SHORT_BREAK_DURATION
      case 'longBreak':
        return LONG_BREAK_DURATION
      default:
        return WORK_DURATION
    }
  }

  const getNextBreakInfo = () => {
    if (phase !== 'work' || !isRunning) return null
    
    const nextIterationNumber = completedIterations + 1
    const isNextBreakLong = nextIterationNumber % ITERATIONS_BEFORE_LONG_BREAK === 0
    const breakDuration = isNextBreakLong ? 15 : 5
    
    return {
      duration: breakDuration,
      type: isNextBreakLong ? 'long' : 'short'
    }
  }

  const nextBreak = getNextBreakInfo()

  const progress = phase === 'idle' ? 0 : ((getPhaseDuration() - remainingSeconds) / getPhaseDuration()) * 100

  if (isCompact) {
    return (
      <Card className="p-4">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {getPhaseLabel()}
          </span>
          
          <motion.div
            key={phase}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={cn('font-display font-bold text-5xl', getPhaseColor())}
          >
            {formatTimerDisplay(remainingSeconds)}
          </motion.div>

          <div className="flex flex-col items-center gap-1">
            {nextBreak && (
              <span className="text-xs text-primary font-medium">
                Next: {nextBreak.duration}min break
              </span>
            )}
            {isMuted && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <BellSlash size={12} weight="fill" />
                Muted
              </span>
            )}
          </div>
          
          <Progress value={progress} className="w-full h-1.5" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {getPhaseLabel()}
          </span>
          {completedIterations > 0 && (
            <span className="text-xs text-muted-foreground">
              ({completedIterations} completed)
            </span>
          )}
        </div>
        
        <motion.div
          key={phase}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className={cn('font-display font-bold text-5xl md:text-6xl', getPhaseColor())}
        >
          {formatTimerDisplay(remainingSeconds)}
        </motion.div>

        <div className="flex flex-col items-center gap-2 w-full">
          {nextBreak && (
            <div className="text-sm text-primary font-medium">
              Next: {nextBreak.duration} minute {nextBreak.type} break
            </div>
          )}
          
          {isMuted && (
            <div className="text-sm text-destructive font-medium flex items-center gap-1.5">
              <BellSlash size={16} weight="fill" />
              Sound Muted
            </div>
          )}
        </div>

        <Progress value={progress} className="w-full h-2" />
      </div>
    </Card>
  )
}
