"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
    /** Date value in YYYY-MM-DD string format */
    value?: string
    /** Called with YYYY-MM-DD string when date changes */
    onChange?: (value: string) => void
    /** Placeholder text when no date is selected */
    placeholder?: string
    /** Additional className for the trigger button */
    className?: string
    /** Display format for the date (date-fns format string) */
    displayFormat?: string
    /** Whether the picker is disabled */
    disabled?: boolean
}

export function DatePicker({
    value,
    onChange,
    placeholder = "Pick a date",
    className,
    displayFormat = "dd/MM/yyyy",
    disabled = false,
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false)

    // Convert YYYY-MM-DD string to Date object for the calendar
    const selectedDate = React.useMemo(() => {
        if (!value) return undefined
        try {
            // Parse YYYY-MM-DD
            const d = parse(value, "yyyy-MM-dd", new Date())
            return isNaN(d.getTime()) ? undefined : d
        } catch {
            return undefined
        }
    }, [value])

    const handleSelect = (date: Date | undefined) => {
        if (date) {
            // Convert Date back to YYYY-MM-DD string
            const formatted = format(date, "yyyy-MM-dd")
            onChange?.(formatted)
        } else {
            onChange?.("")
        }
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 opacity-60" />
                    {selectedDate ? (
                        <span className="truncate">{format(selectedDate, displayFormat)}</span>
                    ) : (
                        <span className="truncate">{placeholder}</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleSelect}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}
