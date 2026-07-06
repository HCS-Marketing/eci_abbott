"use client"
import { useState, useEffect } from "react"

/**
 * Date input that only fires onChange when the user finishes editing (onBlur or Enter).
 * Prevents firing cascading API calls while navigating months in the calendar popup.
 */
export default function DateInput({
  value,
  onChange,
  min,
  max,
  disabled,
  className,
}: {
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
  disabled?: boolean
  className?: string
}) {
  const [local, setLocal] = useState(value)

  // Sync from parent if value changes externally
  useEffect(() => { setLocal(value) }, [value])

  function commit() {
    if (local !== value && local) onChange(local)
  }

  return (
    <input
      type="date"
      value={local}
      min={min}
      max={max}
      disabled={disabled}
      onChange={e => {
        const v = e.target.value
        setLocal(v)
        // Commit immediately when a full YYYY-MM-DD date is picked (e.g. via calendar popup)
        if (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v !== value) onChange(v)
      }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit() }}
      className={className || "border border-gray-200 text-gray-700 text-xs px-2.5 py-1.5 rounded-lg outline-none bg-white"}
    />
  )
}
