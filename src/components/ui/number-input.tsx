"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "step"> & {
  value: number | null | undefined
  /** Called with the number typed so far, or null while the box is empty or holds only "-" or ".". */
  onValueChange: (value: number | null) => void
}

const toText = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value))
const toNumber = (text: string): number | null => {
  if (text.trim() === "") return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

/**
 * A decimal number box. It keeps exactly what the person typed ("0.", "0.0", "0.003"), and only reports the number
 * upwards. A box that turned every keystroke into a number and back would drop the dot and the zeros of "0.003" as soon as
 * they were typed, because 0. and 0.0 are both just 0.
 */
export function NumberInput({ value, onValueChange, onBlur, ...props }: Props) {
  const [text, setText] = React.useState(toText(value))

  // A value that changed from outside (a form reset, a loaded record) replaces the text; the number we reported ourselves does not.
  React.useEffect(() => {
    if (toNumber(text) !== (value ?? null)) setText(toText(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const typed = e.target.value.replace(",", ".")
        if (!/^-?\d*\.?\d*$/.test(typed)) return // only digits, one dot and a leading minus
        setText(typed)
        onValueChange(toNumber(typed))
      }}
      onBlur={(e) => {
        // tidy what was typed ("00.5" or "5." becomes 0.5 or 5)
        const n = toNumber(text)
        if (n !== null) setText(String(n))
        onBlur?.(e)
      }}
    />
  )
}
