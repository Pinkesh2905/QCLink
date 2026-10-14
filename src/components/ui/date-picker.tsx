"use client"

import * as React from "react"
import { CalendarDays, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Dates travel through the app as "YYYY-MM-DD" strings (that is what the API and database use), so
// the picker takes and returns the same. Dates are built at local noon so no timezone can move them
// to the neighbouring day.
function parseYMD(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return undefined
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function toYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

interface DatePickerProps {
  /** "YYYY-MM-DD", or "" for no date */
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  /** earliest / latest selectable date, "YYYY-MM-DD" */
  min?: string
  max?: string
  disabled?: boolean
  /** show a clear (x) button when a date is chosen */
  clearable?: boolean
  className?: string
  "aria-label"?: string
}

function DatePicker({
  value,
  onChange,
  id,
  placeholder = "Select date",
  min,
  max,
  disabled = false,
  clearable = false,
  className,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseYMD(value)
  const minDate = parseYMD(min)
  const maxDate = parseYMD(max)

  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const todayAllowed = (!minDate || today >= minDate) && (!maxDate || today <= maxDate)

  const disabledDays = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ]

  const pick = (date: Date | undefined) => {
    if (!date) return
    onChange(toYMD(date))
    setOpen(false)
  }

  const thisYear = today.getFullYear()

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel}
            data-empty={!selected}
            className={cn(
              "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-xs shadow-xs outline-none transition-[color,box-shadow] md:text-sm dark:bg-input/30",
              "hover:border-ring/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "data-[empty=true]:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
              clearable && selected && "pr-8"
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{selected ? formatDisplay(selected) : placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-xl p-0 shadow-lg">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={pick}
            defaultMonth={selected ?? (todayAllowed ? today : minDate ?? maxDate ?? today)}
            disabled={disabledDays}
            captionLayout="dropdown"
            startMonth={new Date(thisYear - 10, 0)}
            endMonth={new Date(thisYear + 5, 11)}
            autoFocus
          />
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
            <button
              type="button"
              onClick={() => todayAllowed && pick(today)}
              disabled={!todayAllowed}
              className="rounded px-1.5 py-1 font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Today
            </button>
            {clearable && selected && (
              <button
                type="button"
                onClick={() => {
                  onChange("")
                  setOpen(false)
                }}
                className="rounded px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {clearable && selected && !disabled && (
        <button
          type="button"
          aria-label="Clear date"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export { DatePicker }
