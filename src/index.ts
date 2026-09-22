import { Plugin } from "@opencode/plugin"
import { GoUsage } from "./rpc.js"

const USAGE_URL = "https://opencode.ai/zen/go/v1/usage"

function extractKey(credential: unknown): string | undefined {
  if (!credential) return undefined
  if (typeof credential === "string") return credential
  if (typeof credential === "object") {
    const c = credential as Record<string, unknown>
    for (const k of ["key", "token", "apiKey", "value", "secret"]) {
      if (typeof c[k] === "string" && (c[k] as string).length > 0) return c[k] as string
    }
  }
  return undefined
}

async function fetchGoUsage(apiKey: string, signal?: AbortSignal) {
  const res = await fetch(USAGE_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // UA header required, otherwise Cloudflare answers 1010
      "User-Agent": "opencode",
      Accept: "application/json",
    },
    signal,
  })
  if (!res.ok) {
    throw new Error(`Go usage HTTP ${res.status}`)
  }
  const data = (await res.json()) as {
    usage: {
      rolling: { status: string; percent: number; resetsAt: string }
      weekly: { status: string; percent: number; resetsAt: string }
      monthly: { status: string; percent: number; resetsAt: string }
    }
  }
  return { ...data.usage, fetchedAt: new Date().toISOString() }
}

export default Plugin.define({
  id: "go-usage",
  async setup(ctx) {
    const load = async (signal?: AbortSignal) => {
      const connection = await ctx.integration.connection.active("opencode-go")
      if (!connection) throw new Error("no_auth")
      const credential = await ctx.integration.connection.resolve(connection)
      const key = extractKey(credential)
      if (!key) throw new Error("no_auth")
      return fetchGoUsage(key, signal)
    }

    await ctx.rpc.register(GoUsage, {
      get: async (_input, context) => {
        try {
          return await load(context.signal)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          if (msg === "no_auth") return context.error("no_auth", "OpenCode Go credential not found, run /connect first", { message: msg })
          return context.error("fetch_failed", msg, { message: msg })
        }
      },
    })

    // agent tool: go_usage
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "go_usage",
        description: "Query OpenCode Go quota: used percent and reset time for the 5h/weekly/monthly windows",
        input: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
        },
        execute: async (_input, context) => {
          try {
            const usage = await load(context.signal)
            const text = [
              `5h (rolling): ${usage.rolling.percent}% [${usage.rolling.status}] resets at ${usage.rolling.resetsAt}`,
              `weekly: ${usage.weekly.percent}% [${usage.weekly.status}] resets at ${usage.weekly.resetsAt}`,
              `monthly: ${usage.monthly.percent}% [${usage.monthly.status}] resets at ${usage.monthly.resetsAt}`,
            ].join("\n")
            return { content: text }
          } catch (e) {
            return { content: `Failed: ${e instanceof Error ? e.message : String(e)}` }
          }
        },
      })
    })

    // slash command: /go-usage
    await ctx.command.transform((editor) => {
      editor.add({
        name: "go-usage",
        description: "Show OpenCode Go quota",
        execute: async ({ sessionID, prompt, delivery }) => {
          try {
            const usage = await load()
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              delivery,
              text: `OpenCode Go usage:\n- 5h: ${usage.rolling.percent}% (${usage.rolling.status}), resets at ${usage.rolling.resetsAt}\n- week: ${usage.weekly.percent}% (${usage.weekly.status}), resets at ${usage.weekly.resetsAt}\n- month: ${usage.monthly.percent}% (${usage.monthly.status}), resets at ${usage.monthly.resetsAt}`,
            })
          } catch (e) {
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              delivery,
              text: `Failed to query Go usage: ${e instanceof Error ? e.message : String(e)}. Run /connect to connect OpenCode Go first.`,
            })
          }
        },
      })
    })
  },
})
