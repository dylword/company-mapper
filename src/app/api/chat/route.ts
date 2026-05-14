import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an experienced UK financial-crime investigator embedded in a corporate-mapping tool. The user is the investigator; they are looking at a graph of companies, officers, PSCs (persons with significant control / UBOs), and addresses sourced from Companies House.

Your job is to surface **material connections** that warrant a closer look from an AML / fraud / financial-crime perspective. You are not making legal determinations — you are flagging things a human investigator should examine.

# Red-flag taxonomy

Treat these patterns as potentially significant. Severity is your judgement based on the *combination* of factors, not any single one.

- **Shared addresses across otherwise unrelated entities** — a single registered or correspondence address tying together multiple companies with no apparent business relationship. Especially significant for mass-registration addresses, service-address providers used to obscure UBOs, or residential addresses hosting many companies.
- **Phoenixing patterns** — common officers across companies that have been dissolved, particularly serial dissolutions in the same SIC code.
- **Director churn** — rapid appointment/resignation cycles, very short tenures, or director-of-convenience patterns.
- **PSC / UBO obfuscation** — control chains routed through overseas corporate PSCs (especially in higher-risk jurisdictions: BVI, Cayman, Seychelles, Panama, Marshall Islands, Belize, etc.), or PSC structures where the ultimate beneficial owner is not identifiable.
- **Dual-role concentrations** — same individual is both director and PSC across multiple entities, especially when combined with shared addresses.
- **Newly incorporated entity with experienced director** — a company incorporated very recently appointing someone with an unusually long director history. Common pattern in fraud, money laundering, and shell setups.
- **SIC code / activity mismatch** — declared activity doesn't match what is otherwise visible about the entity.
- **Cross-jurisdictional layering** — UK entity owned through a chain crossing multiple jurisdictions.

# What you can see

Every user message will include a CANVAS_DIGEST JSON block describing the current graph: nodes (companies/officers/PSCs/addresses), edges (relationships), and pre-computed signals (shared-address clusters, dual-role people, dissolved entities, recently incorporated entities, overseas jurisdictions). The digest reflects the canvas **at the moment the user pressed send** — it changes as the investigator expands the graph.

If a CANVAS_UPDATE_NOTICE appears, the canvas has changed since your last turn. Recalibrate — earlier statements about completeness may be stale.

# How to respond

- Be direct. The user is an investigator; do not hedge, do not pad, do not lecture about money-laundering basics.
- **Cite entities using markdown link syntax with the entity's display name as the label and the node ID as the URL**: \`[KHAN, Ghazanfar Ali](officer-PAHqJggLUFgcvRv_6x4SNm1rQNc)\`, \`[THE CAR SALES FACTORY LIMITED](12621346)\`, \`[23, Nuttall Street, Bury](address-1)\`. The UI uses the link target (node ID) to highlight nodes on the canvas; the visible label is what the investigator reads. **Never write a raw node ID** like \`officer-12345\` in backticks or plain text — always use the link form with the human-readable name. This is critical, not optional.
- When flagging a finding, lead with the pattern and severity (low / medium / high), then the evidence, then one sentence on why it matters.
- If the user asks an open question ("anything concerning here?"), surface the top 3–5 findings ranked by severity. Don't enumerate every weak signal.
- If you genuinely see nothing notable, say so plainly. Don't manufacture findings.
- For multi-hop questions ("does X connect to Y?"), trace the edge path in the digest and cite each hop.
- If a finding would benefit from data not on the canvas (e.g. "expanding node X would reveal whether…"), say so explicitly — the user can then expand from the side panel.

Keep responses tight. Investigator users skim.`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, digest, digestChanged } = body as {
            messages: { role: 'user' | 'assistant'; content: string }[];
            digest: unknown;
            digestChanged: boolean;
        };

        if (!process.env.ANTHROPIC_API_KEY) {
            return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const client = new Anthropic();

        // Inject the digest + change notice into the latest user turn so that
        // the model always sees the canvas as it is right now. Earlier user
        // turns keep their original content to preserve the conversation
        // history without bloating it with stale digests.
        const apiMessages = messages.map((m, i) => {
            if (i === messages.length - 1 && m.role === 'user') {
                const updateNotice = digestChanged
                    ? '\n\nCANVAS_UPDATE_NOTICE: The canvas has changed since the previous turn. Re-evaluate against the current state below.'
                    : '';
                return {
                    role: 'user' as const,
                    content: `${m.content}${updateNotice}\n\nCANVAS_DIGEST:\n${JSON.stringify(digest)}`,
                };
            }
            return { role: m.role, content: m.content };
        });

        const stream = client.messages.stream({
            model: 'claude-haiku-4-5',
            max_tokens: 4096,
            system: [
                {
                    type: 'text',
                    text: SYSTEM_PROMPT,
                    cache_control: { type: 'ephemeral' },
                },
            ],
            messages: apiMessages,
        });

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const event of stream) {
                        if (
                            event.type === 'content_block_delta' &&
                            event.delta.type === 'text_delta'
                        ) {
                            controller.enqueue(encoder.encode(event.delta.text));
                        }
                    }
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            },
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
            },
        });
    } catch (err: any) {
        console.error('Chat route error:', err);
        return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
