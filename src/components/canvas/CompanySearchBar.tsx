"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { chFetch } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"

type Suggestion = {
    company_number: string
    title: string
    company_status?: string
    address_snippet?: string
    date_of_creation?: string
}

const statusStyles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700",
    dissolved: "bg-slate-100 text-slate-500",
    liquidation: "bg-amber-50 text-amber-700",
}

/**
 * Search field with type-ahead company suggestions from Companies House.
 * Picking a suggestion navigates by company number (skipping the extra
 * search call in GraphCanvas); a free-text submit still navigates by name.
 */
export function CompanySearchBar() {
    const searchParams = useSearchParams()
    const query = searchParams.get("q")

    const [value, setValue] = React.useState(query || "")
    const [suggestions, setSuggestions] = React.useState<Suggestion[]>([])
    const [open, setOpen] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [highlighted, setHighlighted] = React.useState(-1)

    const containerRef = React.useRef<HTMLDivElement>(null)
    // Tracks the latest request so stale responses don't overwrite fresh ones.
    const requestSeq = React.useRef(0)

    // Navigate to a new search. GraphCanvas treats an 8-digit numeric `q` as a
    // company number directly, so picking a suggestion avoids a redundant call.
    const navigate = React.useCallback((q: string) => {
        const trimmed = q.trim()
        if (!trimmed) return
        const newParams = new URLSearchParams(searchParams.toString())
        newParams.set("q", trimmed)
        window.history.pushState(null, "", `?${newParams.toString()}`)
        window.location.search = `?${newParams.toString()}`
    }, [searchParams])

    // Debounced type-ahead lookup.
    React.useEffect(() => {
        const term = value.trim()
        if (term.length < 3 || term === (query || "").trim()) {
            setSuggestions([])
            setLoading(false)
            return
        }

        setLoading(true)
        const seq = ++requestSeq.current
        const timer = setTimeout(async () => {
            try {
                const res = await chFetch(`/api/search?q=${encodeURIComponent(term)}`)
                const data = await res.json()
                if (seq !== requestSeq.current) return // a newer request superseded this one
                setSuggestions(data.items || [])
                setOpen(true)
                setHighlighted(-1)
            } catch {
                if (seq === requestSeq.current) setSuggestions([])
            } finally {
                if (seq === requestSeq.current) setLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [value, query])

    // Close the dropdown on an outside click.
    React.useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", onClick)
        return () => document.removeEventListener("mousedown", onClick)
    }, [])

    const choose = (s: Suggestion) => {
        setValue(s.title)
        setOpen(false)
        navigate(s.company_number)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open || suggestions.length === 0) {
            if (e.key === "Enter") navigate(value)
            return
        }
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlighted(h => (h + 1) % suggestions.length)
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlighted(h => (h - 1 + suggestions.length) % suggestions.length)
        } else if (e.key === "Enter") {
            e.preventDefault()
            if (highlighted >= 0) choose(suggestions[highlighted])
            else navigate(value)
        } else if (e.key === "Escape") {
            setOpen(false)
        }
    }

    return (
        <div ref={containerRef} className="relative flex items-center gap-2">
            <div className="relative">
                <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={onKeyDown}
                    onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
                    placeholder="TESCO PLC"
                    autoComplete="off"
                    className="w-[300px] px-3 py-1.5 text-sm text-slate-900 border border-slate-200 rounded-md focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 placeholder:text-slate-400"
                />
                {loading && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
                )}

                {open && suggestions.length > 0 && (
                    <ul className="absolute z-[100] mt-1 w-full max-h-[320px] overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-1">
                        {suggestions.map((s, i) => {
                            const status = s.company_status?.toLowerCase() || ""
                            return (
                                <li key={s.company_number}>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => { e.preventDefault(); choose(s) }}
                                        onMouseEnter={() => setHighlighted(i)}
                                        className={cn(
                                            "w-full text-left px-3 py-2 flex flex-col gap-0.5",
                                            i === highlighted ? "bg-slate-100" : "hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-[#132B5C] truncate">{s.title}</span>
                                            {s.company_status && (
                                                <span className={cn(
                                                    "flex-none text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                                                    statusStyles[status] || "bg-slate-100 text-slate-600"
                                                )}>
                                                    {s.company_status}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs text-slate-500 truncate">
                                            {s.company_number}
                                            {s.address_snippet ? ` · ${s.address_snippet}` : ""}
                                        </span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>

            <Button
                type="button"
                onClick={() => navigate(value)}
                size="sm"
                className="bg-[#132B5C] text-white hover:bg-[#132B5C]/90 h-[34px] px-6 gap-1.5"
            >
                <Search className="h-3.5 w-3.5" />
                Search
            </Button>
        </div>
    )
}
