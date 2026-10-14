"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// The month and year pickers in the calendar header. The browser's own <select> list cannot be
// styled, so this is a small menu instead: rounded panel, soft hover, a check on the current value,
// and the current value is scrolled into view when it opens (handy for the long year list).
function CaptionDropdown({
  value,
  options,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  value?: string | number | readonly string[]
  options?: { value: number; label: string; disabled?: boolean }[]
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
  disabled?: boolean
  "aria-label"?: string
}) {
  const current = options?.find((o) => String(o.value) === String(value))

  const choose = (next: number) => {
    // DayPicker expects a <select> change event: hand it the one thing it reads, the new value
    onChange?.({ target: { value: String(next) } } as React.ChangeEvent<HTMLSelectElement>)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        className="group inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        {current?.label}
        <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={6}
        className="max-h-72 min-w-[7.5rem] rounded-xl border-border/70 p-1 shadow-lg [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {options?.map((option) => {
          const isCurrent = String(option.value) === String(value)
          return (
            <DropdownMenuItem
              key={option.value}
              ref={
                isCurrent
                  ? (el) => {
                      // open on the current value rather than the top of the list
                      if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "center" }))
                    }
                  : undefined
              }
              disabled={option.disabled}
              onSelect={() => choose(option.value)}
              className={cn(
                "cursor-pointer justify-between gap-3 rounded-lg px-2.5 py-1.5 transition-colors",
                isCurrent && "bg-accent/60 font-medium"
              )}
            >
              {option.label}
              {isCurrent && <Check className="size-3.5 text-foreground" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// A calm, neutral calendar: no heavy borders or colours, the selected day uses the app's primary
// colour and today is only marked with a thin ring. Styling is driven entirely by theme tokens, so
// it follows light / dark mode automatically.
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "relative flex flex-col",
        month: "space-y-3",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium",
        dropdowns: "flex items-center justify-center gap-0.5 text-sm font-medium",
        // the bar spans the whole header, so it must not catch clicks itself: only the two arrows do
        nav: "pointer-events-none absolute inset-x-0 top-0 flex h-8 items-center justify-between",
        button_previous:
          "pointer-events-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
        button_next:
          "pointer-events-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "size-9 text-center text-[11px] font-medium text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "size-9 p-0 text-center text-sm",
        day_button:
          "inline-flex size-9 items-center justify-center rounded-md font-normal transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-medium [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        today: "[&:not([aria-selected])>button]:ring-1 [&:not([aria-selected])>button]:ring-inset [&:not([aria-selected])>button]:ring-border [&>button]:font-semibold",
        outside: "[&>button]:text-muted-foreground/50",
        disabled: "[&>button]:pointer-events-none [&>button]:opacity-35",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Dropdown: CaptionDropdown,
        Chevron: ({ orientation, className: chevronClass, ...chevronProps }) => {
          const Icon =
            orientation === "left" ? ChevronLeft : orientation === "right" ? ChevronRight : orientation === "up" ? ChevronUp : ChevronDown
          return <Icon className={cn("size-4", chevronClass)} {...chevronProps} />
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
