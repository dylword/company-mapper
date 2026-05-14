"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { rateLimitEvents, RateLimitNotice } from "@/lib/client-fetch";
import { AlertTriangle } from "lucide-react";

const formatCountdown = (ms: number) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
};

export const RateLimitDialog: React.FC = () => {
    const [notice, setNotice] = useState<RateLimitNotice | null>(null);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const unsubscribe = rateLimitEvents.subscribe(n => {
            setNotice(prev => {
                // Keep the latest / further-in-the-future deadline
                if (!prev || n.retryAt > prev.retryAt) return n;
                return prev;
            });
            setNow(Date.now());
        });
        return () => { unsubscribe(); };
    }, []);

    useEffect(() => {
        if (!notice) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [notice]);

    if (!notice) return null;
    const msLeft = notice.retryAt - now;
    const isOver = msLeft <= 0;

    return (
        <Dialog open onOpenChange={(open) => { if (!open && isOver) setNotice(null); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-900">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Companies House rate limit reached
                    </DialogTitle>
                    <DialogDescription className="text-slate-600">
                        Your application has used <span className="font-semibold">{notice.used}</span> of {notice.limit} requests
                        allowed in the current 5-minute window. Further requests will fail until the
                        window resets.
                    </DialogDescription>
                </DialogHeader>

                <div className="my-2 rounded-md border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Retry available in</div>
                    <div className="mt-1 font-mono text-3xl font-semibold tabular-nums text-slate-900">
                        {isOver ? "Ready" : formatCountdown(msLeft)}
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => setNotice(null)}
                        disabled={!isOver}
                    >
                        Dismiss
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default RateLimitDialog;
