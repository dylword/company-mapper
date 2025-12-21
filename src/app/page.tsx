import { Suspense } from "react"
import { GraphScreen } from "@/components/GraphScreen"

export default function Home() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50">Loading...</div>}>
      <GraphScreen />
    </Suspense>
  )
}
