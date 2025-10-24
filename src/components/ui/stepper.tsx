import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = {
  title: string
  description?: string
}

type StepperProps = {
  steps: Step[]
  currentStep: number
  className?: string
  onStepClick?: (step: number) => void
}

export function Stepper({ steps, currentStep, className, onStepClick }: StepperProps) {
  return (
    <div className={cn('w-full', className)}>
      <ol className="space-y-3">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isUpcoming = stepNumber > currentStep
          const isClickable = isCompleted && onStepClick

          return (
            <li key={index} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-background text-primary',
                    isUpcoming && 'border-muted-foreground/25 bg-background text-muted-foreground',
                    isClickable && 'cursor-pointer hover:opacity-80 transition-opacity'
                  )}
                  onClick={() => isClickable && onStepClick(stepNumber)}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={(e) => isClickable && (e.key === 'Enter' || e.key === ' ') && onStepClick(stepNumber)}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : stepNumber}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'mt-2 h-full w-0.5',
                      isCompleted ? 'bg-primary' : 'bg-muted-foreground/25'
                    )}
                    style={{ minHeight: '24px' }}
                  />
                )}
              </div>
              <div className="flex-1 pt-1">
                <p
                  className={cn(
                    'text-sm font-medium leading-none',
                    isCurrent && 'text-primary',
                    isUpcoming && 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
