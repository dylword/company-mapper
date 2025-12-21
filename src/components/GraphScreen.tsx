"use client"

import { useSearchParams } from "next/navigation"
import { GraphCanvas } from "@/components/GraphCanvas"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export function GraphScreen() {
    const searchParams = useSearchParams()
    const query = searchParams.get("q")

    return (
        <div className="h-screen w-screen flex flex-col">
            {/* Canvas Area */}
            <div className="flex-1 overflow-hidden relative">
                <GraphCanvas />
            </div>
        </div>
    )
}

