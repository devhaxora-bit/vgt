"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Party, PartyType } from "@/lib/types/party.types"
import { getParties } from "@/lib/services/party.service"

interface PartyAutocompleteProps {
    type: PartyType
    onSelect: (party: Party | null) => void
    onValueChange?: (value: string) => void
    value?: string
    placeholder?: string
}

export function PartyAutocomplete({
    type,
    onSelect,
    onValueChange,
    value = "",
    placeholder = "Select party..."
}: PartyAutocompleteProps) {
    const [open, setOpen] = React.useState(false)
    const [parties, setParties] = React.useState<Party[]>([])
    const [loading, setLoading] = React.useState(false)
    const [inputValue, setInputValue] = React.useState(value)

    React.useEffect(() => {
        setInputValue(value)
    }, [value])

    const fetchParties = async (search: string) => {
        setLoading(true)
        try {
            const data = await getParties(type, search)
            setParties(data)
        } catch (error) {
            console.error("Failed to fetch parties", error)
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        if (open) {
            fetchParties("")
        }
    }, [open, type])

    const handleSelect = (party: Party) => {
        onSelect(party)
        setInputValue(party.name)
        onValueChange?.(party.name)
        setOpen(false)
    }

    const handleInputChange = (val: string) => {
        setInputValue(val)
        onValueChange?.(val)
        // If user types something that doesn't match a selected party, we clear the selected party object
        // provided we want to allow free text.
        // But for autocomplete, usually we want to filter.
        // Let's debounce search here? Or just search on open?
        // For now, simple client-side filtering if list is small, or server side if large.
        // Given the requirement "auto show dropdown of all available names", let's reload on type.
        fetchParties(val)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal text-left"
                >
                    {inputValue || placeholder}
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={`Search ${type}...`}
                        value={inputValue}
                        onValueChange={handleInputChange}
                    />
                    <CommandList>
                        {loading && <div className="p-2 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading...</div>}
                        {!loading && parties.length === 0 && (
                            <CommandEmpty>No party found.</CommandEmpty>
                        )}
                        <CommandGroup>
                            {parties.map((party) => (
                                <CommandItem
                                    key={party.id}
                                    value={party.name}
                                    onSelect={() => handleSelect(party)}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{party.name}</span>
                                        <span className="text-xs text-muted-foreground">{party.code} - {party.city}</span>
                                    </div>
                                    <Check
                                        className={cn(
                                            "ml-auto",
                                            inputValue === party.name ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
