"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Node, Edge, useReactFlow } from "reactflow";
import { Sparkles, Send, X, Loader2, Pin, PinOff, GripVertical } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buildCanvasDigest, hashDigest, CanvasDigest } from "@/lib/canvas-digest";

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

interface AIChatPanelProps {
    nodes: Node[];
    edges: Edge[];
    onHighlightNode?: (nodeId: string) => void;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 420;

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ nodes, edges }) => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [pinnedDigest, setPinnedDigest] = useState<CanvasDigest | null>(null);
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [resizing, setResizing] = useState(false);
    const lastDigestHash = useRef<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { setCenter, getNodes } = useReactFlow();

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, streaming]);

    // Drag-to-resize: capture pointer on the left-edge grip and update width
    // until release. The handler reads window.innerWidth - clientX so the panel
    // tracks the mouse smoothly regardless of layout.
    useEffect(() => {
        if (!resizing) return;
        const onMove = (e: MouseEvent) => {
            const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
            setWidth(next);
        };
        const onUp = () => setResizing(false);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [resizing]);

    const handleHighlight = useCallback(
        (id: string) => {
            const node = getNodes().find(n => n.id === id);
            if (!node) return;
            setCenter(node.position.x + 120, node.position.y + 40, { zoom: 1.2, duration: 600 });
        },
        [getNodes, setCenter]
    );

    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || streaming) return;

        const digest = pinned && pinnedDigest ? pinnedDigest : buildCanvasDigest(nodes, edges);
        const hash = hashDigest(digest);
        const changed = lastDigestHash.current !== null && lastDigestHash.current !== hash;
        lastDigestHash.current = hash;

        const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
        setMessages(nextMessages);
        setInput("");
        setStreaming(true);
        setMessages(m => [...m, { role: "assistant", content: "" }]);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: nextMessages, digest, digestChanged: changed }),
            });

            if (!res.ok || !res.body) {
                const errBody = await res.text().catch(() => "");
                throw new Error(errBody || `Request failed (${res.status})`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let acc = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                acc += decoder.decode(value, { stream: true });
                setMessages(m => {
                    const copy = [...m];
                    copy[copy.length - 1] = { role: "assistant", content: acc };
                    return copy;
                });
            }
        } catch (err: any) {
            setMessages(m => {
                const copy = [...m];
                copy[copy.length - 1] = {
                    role: "assistant",
                    content: `_Error: ${err?.message || "failed to reach the model"}_`,
                };
                return copy;
            });
        } finally {
            setStreaming(false);
        }
    }, [input, streaming, messages, nodes, edges, pinned, pinnedDigest]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    const togglePin = () => {
        if (pinned) {
            setPinned(false);
            setPinnedDigest(null);
        } else {
            setPinnedDigest(buildCanvasDigest(nodes, edges));
            setPinned(true);
        }
    };

    // Markdown component overrides — gives us a tight investigator look and
    // turns any inline `code` into a clickable node-ID chip.
    const markdownComponents = useMemo(
        () => ({
            h1: (props: any) => <h1 className="text-base font-semibold text-slate-900 mt-3 mb-2 first:mt-0" {...props} />,
            h2: (props: any) => <h2 className="text-sm font-semibold text-slate-900 mt-3 mb-1.5 first:mt-0" {...props} />,
            h3: (props: any) => <h3 className="text-[13px] font-semibold text-slate-800 mt-2.5 mb-1 first:mt-0" {...props} />,
            p: (props: any) => <p className="text-sm leading-relaxed text-slate-700 my-1.5" {...props} />,
            ul: (props: any) => <ul className="list-disc pl-5 my-1.5 space-y-1 text-sm text-slate-700" {...props} />,
            ol: (props: any) => <ol className="list-decimal pl-5 my-1.5 space-y-1 text-sm text-slate-700" {...props} />,
            li: (props: any) => <li className="leading-relaxed" {...props} />,
            strong: (props: any) => <strong className="font-semibold text-slate-900" {...props} />,
            em: (props: any) => <em className="italic text-slate-700" {...props} />,
            hr: () => <hr className="my-3 border-slate-200" />,
            a: ({ href, children, ...rest }: any) => {
                const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
                if (isExternal) {
                    return (
                        <a
                            href={href}
                            className="text-[#132B5C] underline hover:no-underline"
                            target="_blank"
                            rel="noreferrer"
                            {...rest}
                        >
                            {children}
                        </a>
                    );
                }
                // Treat any non-URL href as a node-id citation; the link label
                // (the human-readable name) is what we render.
                return (
                    <button
                        onClick={() => href && handleHighlight(String(href))}
                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 hover:bg-[#132B5C] hover:text-white border border-slate-200 text-[12px] font-medium text-slate-800 hover:border-[#132B5C] transition-colors align-baseline"
                        title={`Focus ${href} on the canvas`}
                    >
                        {children}
                    </button>
                );
            },
            blockquote: (props: any) => (
                <blockquote className="border-l-2 border-slate-300 pl-3 my-2 text-slate-600 italic text-sm" {...props} />
            ),
            // react-markdown v9 removed the `inline` prop — detect inline by
            // the absence of a fenced-language class and the absence of newlines.
            code: ({ className, children, ...rest }: any) => {
                const text = String(children ?? "");
                const isBlock = /\blanguage-/.test(className || "") || text.includes("\n");
                if (isBlock) {
                    return <code className={cn(className, "font-mono text-[11px]")} {...rest}>{children}</code>;
                }
                return (
                    <code
                        className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-700"
                        {...rest}
                    >
                        {children}
                    </code>
                );
            },
            pre: (props: any) => (
                <pre className="my-2 p-2 rounded bg-slate-900 text-slate-100 text-[11px] overflow-x-auto" {...props} />
            ),
            table: (props: any) => (
                <div className="my-2 overflow-x-auto">
                    <table className="text-xs border-collapse" {...props} />
                </div>
            ),
            th: (props: any) => <th className="border border-slate-200 px-2 py-1 bg-slate-50 text-left font-semibold" {...props} />,
            td: (props: any) => <td className="border border-slate-200 px-2 py-1" {...props} />,
        }),
        [handleHighlight]
    );

    return (
        <>
            {/* Floating toggle button (only when closed) */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#132B5C] text-white shadow-lg hover:bg-[#0d1f44] transition-all hover:shadow-xl"
                    title="Open AML investigator"
                >
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-medium">Ask the investigator</span>
                </button>
            )}

            {/* Side panel — fixed to the right; canvas remains pannable on the left */}
            <aside
                style={{ width: open ? width : 0 }}
                className={cn(
                    "fixed top-0 right-0 z-[60] h-full bg-white border-l border-slate-200 shadow-[0_0_30px_rgba(15,23,42,0.08)] flex flex-col transition-[transform,width] duration-300",
                    open ? "translate-x-0" : "translate-x-full",
                    resizing && "transition-none"
                )}
            >
                {/* Resize grip on the left edge */}
                {open && (
                    <div
                        onMouseDown={() => setResizing(true)}
                        className="absolute top-0 left-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize group z-10"
                        title="Drag to resize"
                    >
                        <div className={cn(
                            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-1 rounded-full bg-slate-300 group-hover:bg-[#132B5C] transition-colors",
                            resizing && "bg-[#132B5C]"
                        )} />
                        <GripVertical className={cn(
                            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded",
                            resizing && "opacity-100 text-[#132B5C]"
                        )} />
                    </div>
                )}

                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-[#132B5C] to-[#1d3d7d] text-white">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        <div>
                            <div className="text-sm font-semibold leading-tight">AML Investigator</div>
                            <div className="text-[10px] text-white/70 leading-tight">
                                {nodes.length} nodes · {edges.length} edges
                                {pinned && " · canvas pinned"}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={togglePin}
                            className={cn(
                                "p-1.5 rounded hover:bg-white/10 transition",
                                pinned && "bg-white/20"
                            )}
                            title={pinned ? "Unpin — use live canvas" : "Pin current canvas snapshot"}
                        >
                            {pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                        </button>
                        <button
                            onClick={() => setOpen(false)}
                            className="p-1.5 rounded hover:bg-white/10 transition"
                            title="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center text-slate-500 text-sm mt-12 space-y-3">
                            <Sparkles className="h-6 w-6 mx-auto text-slate-300" />
                            <div className="font-medium text-slate-700">Investigator on standby</div>
                            <p className="text-xs leading-relaxed max-w-[280px] mx-auto">
                                I can see the canvas. Ask me anything — try:
                            </p>
                            <div className="flex flex-col gap-1.5 max-w-[280px] mx-auto">
                                {[
                                    "Anything concerning here?",
                                    "Are there phoenixing patterns?",
                                    "Who's hiding behind overseas PSCs?",
                                ].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => {
                                            setInput(s);
                                            textareaRef.current?.focus();
                                        }}
                                        className="text-xs text-left px-3 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div
                            key={i}
                            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                        >
                            <div
                                className={cn(
                                    "max-w-[92%] rounded-lg px-3 py-2 break-words",
                                    m.role === "user"
                                        ? "bg-[#132B5C] text-white text-sm leading-relaxed whitespace-pre-wrap"
                                        : "bg-slate-50 text-slate-800 border border-slate-200 w-full"
                                )}
                            >
                                {m.role === "assistant" ? (
                                    <div className="markdown-body">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                            {m.content || (streaming ? "…" : "")}
                                        </ReactMarkdown>
                                        {streaming && i === messages.length - 1 && (
                                            <span className="inline-block w-1.5 h-3 ml-0.5 bg-slate-400 animate-pulse align-middle" />
                                        )}
                                    </div>
                                ) : (
                                    m.content
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input */}
                <div className="border-t border-slate-200 p-3 bg-slate-50">
                    <div className="relative flex items-end gap-2 bg-white rounded-lg border border-slate-300 focus-within:border-[#132B5C] focus-within:ring-1 focus-within:ring-[#132B5C] transition">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            rows={1}
                            placeholder="Ask about the canvas…"
                            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none max-h-32"
                            disabled={streaming}
                        />
                        <Button
                            onClick={send}
                            disabled={streaming || !input.trim()}
                            size="icon"
                            className="m-1 h-8 w-8 bg-[#132B5C] hover:bg-[#0d1f44] text-white shrink-0"
                        >
                            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                    <div className="mt-1.5 text-[10px] text-slate-400 px-1">
                        Enter to send · Shift+Enter for newline · click highlighted names to focus on the canvas · drag the left edge to resize
                    </div>
                </div>
            </aside>
        </>
    );
};

export default AIChatPanel;
