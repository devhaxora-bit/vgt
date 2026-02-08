"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInputValue(val)
        onValueChange?.(val)
        fetchParties(val)
    }

    const handleAddNewParty = () => {
        const newParty: Party = {
            id: 'new',
            name: inputValue,
            code: '',
            type: type,
            gstin: '',
            address: '',
            city: '',
            pincode: '',
            state: '',
            phone: '',
            email: '',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        handleSelect(newParty);
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
            <PopoverContent className="w-[300px] p-0" align="start">
                <div className="flex flex-col">
                    {/* Search Input */}
                    <div className="p-2 border-b">
                        <Input
                            placeholder={`Search ${type}...`}
                            value={inputValue}
                            onChange={handleInputChange}
                            className="h-8"
                            autoFocus
                        />
                    </div>

                    {/* Results List */}
                    <div className="max-h-[200px] overflow-y-auto">
                        {loading && (
                            <div className="p-2 text-center text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                Loading...
                            </div>
                        )}

                        {!loading && parties.length === 0 && !inputValue && (
                            <div className="p-2 text-center text-sm text-muted-foreground">
                                Type to search or add a new party
                            </div>
                        )}

                        {!loading && parties.length === 0 && inputValue && (
                            <div className="p-2 text-center text-sm text-muted-foreground">
                                No parties found
                            </div>
                        )}

                        {parties.map((party) => (
                            <div
                                key={party.id}
                                onClick={() => handleSelect(party)}
                                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                            >
                                <div className="flex flex-col">
                                    <span className="font-medium">{party.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {party.code} - {party.city}
                                    </span>
                                </div>
                                {inputValue === party.name && (
                                    <Check className="h-4 w-4 text-primary" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add New Party Button */}
                    {!loading && inputValue && (
                        <div className="border-t p-1">
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-primary font-bold h-9"
                                onClick={handleAddNewParty}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add "{inputValue}" as new party
                            </Button>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
