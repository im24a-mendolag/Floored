import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  valueLabel?: string
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, valueLabel, ...props }, ref) => {
    return (
      <label className={cn('space-y-2 block', className)}>
        <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          <span>{label}</span>
          {valueLabel ? <span className="text-foreground">{valueLabel}</span> : null}
        </div>
        <input
          type="range"
          className="w-full accent-primary"
          ref={ref}
          {...props}
        />
      </label>
    )
  }
)
Slider.displayName = 'Slider'

export { Slider }
