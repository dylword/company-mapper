"use client";

import React from "react";

interface LoadingOverlayProps {
    active: boolean;
    label?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ active, label }) => {
    return (
        <>
            {/* Top progress bar — always mounted so the animation is smooth on toggle. */}
            <div
                className="pointer-events-none fixed top-0 left-0 right-0 h-[3px] z-[60] overflow-hidden"
                aria-hidden={!active}
                style={{ opacity: active ? 1 : 0, transition: "opacity 200ms ease" }}
            >
                <div className="h-full w-full relative">
                    <div
                        className="absolute inset-y-0 w-1/3 rounded-full"
                        style={{
                            background:
                                "linear-gradient(90deg, transparent 0%, #132B5C 30%, #2f5fb8 60%, transparent 100%)",
                            animation: active ? "cm-progress 1.2s ease-in-out infinite" : "none",
                        }}
                    />
                </div>
            </div>

            {/* Subtle floating chip in the bottom-right of the canvas. */}
            {active && (
                <div className="pointer-events-none absolute bottom-6 right-6 z-50">
                    <div className="flex items-center gap-2.5 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-2 shadow-lg">
                        <span className="relative inline-flex w-3 h-3">
                            <span className="absolute inset-0 rounded-full bg-[#132B5C] opacity-30 animate-ping" />
                            <span className="relative inline-flex w-3 h-3 rounded-full bg-[#132B5C]" />
                        </span>
                        <span className="text-xs font-medium text-slate-700">
                            {label || "Working…"}
                        </span>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes cm-progress {
                    0% {
                        left: -33%;
                    }
                    100% {
                        left: 100%;
                    }
                }
            `}</style>
        </>
    );
};

export default LoadingOverlay;
