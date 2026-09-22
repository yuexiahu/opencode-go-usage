import { Plugin } from "@opencode/plugin/tui"
import { GoUsage } from "./rpc.js"
import { createSignal, Show } from "solid-js"

type Window = { status: string; percent: number; resetsAt: string }
type Usage = { rolling: Window; weekly: Window; monthly: Window; fetchedAt: string }

function color(percent: number): string {
  if (percent >= 90) return "red"
  if (percent >= 70) return "yellow"
  return "green"
}

function barParts(percent: number, width = 20): { left: string; label: string; right: string } {
  const label = `${percent}%`
  const maxPos = width - label.length
  const raw = Math.round((percent / 100) * maxPos)
  const pos = percent <= 0 ? 0 : Math.max(1, Math.min(maxPos, raw))
  return { left: "─".repeat(pos), label, right: "─".repeat(width - pos - label.length) }
}

function relative(resetsAt: string): string {
  const ms = new Date(resetsAt).getTime() - Date.now()
  const p2 = (n: number) => String(n).padStart(2, "0")
  if (Number.isNaN(ms)) return resetsAt
  if (ms <= 0) return "00h00m"
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${p2(d)}d${p2(h % 24)}h`
  if (h > 0) return `${p2(h)}h${p2(m % 60)}m`
  return `${p2(m)}m`
}

export default Plugin.define({
  id: "go-usage-tui",
  async setup(context) {
    const [usage, setUsage] = createSignal<Usage | null>(null)
    const [error, setError] = createSignal<string | null>(null)

    let rpc: { get: (i: object) => Promise<Usage> } | undefined
    try {
      rpc = context.client.rpc(GoUsage as never) as never
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }

    const refresh = async () => {
      if (!rpc) return
      try {
        setUsage(await rpc.get({}))
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    }

    const timer = setInterval(() => void refresh(), 60_000)
    await refresh()
    const footerRender = () => (
      <text fg="gray">{usage() ? `Go ${usage()!.rolling.percent}/${usage()!.weekly.percent}/${usage()!.monthly.percent}%` : error() ? "Go ?" : "Go …"}</text>
    )
    const unregisterSetupFooter = context.ui.slot({
      append: "home.footer.status",
      render: footerRender,
    })
    // session view footer is a different slot, register the same content there
    const unregisterPromptFooter = context.ui.slot({
      append: "prompt.footer.status",
      render: footerRender,
    })

    // keymap.layer must run in render context; ui.slot registers directly in setup
    let keymapRegistered = false
    const unregisterApp = context.ui.slot({
      append: "app",
      render: () => {
        if (!keymapRegistered) {
          keymapRegistered = true
          context.keymap.layer(() => ({
            mode: "global",
            priority: 10,
            commands: [
              {
                id: "go-usage.refresh",
                title: "Refresh Go usage",
                group: "Go",
                palette: true,
                slash: { name: "go-usage-refresh", aliases: ["go"] },
                enabled: () => true,
                run: async () => {
                  await refresh()
                  context.ui.toast.show({ message: "Go usage refreshed", variant: "success" })
                },
              },
            ],
            bindings: ["go-usage.refresh"],
          }))
        }
        return null
      },
    })

    const unregisterCard = context.ui.slot({
      append: "sidebar.content",
      render: () => (
        <box flexDirection="column">
          <text>Go</text>
          <Show
            when={usage()}
            fallback={
              <Show when={error()} fallback={<text fg="gray">Loading…</text>}>
                <text fg="red">{`Error: ${error() ?? ""}`}</text>
              </Show>
            }
          >
            {(u) => (
              <box flexDirection="column">
                <box flexDirection="row">
                  <text fg="gray">{`5h ${relative(u().rolling.resetsAt).padEnd(6)} ${barParts(u().rolling.percent).left}`}</text>
                  <text fg={color(u().rolling.percent)}>{barParts(u().rolling.percent).label}</text>
                  <text fg="gray">{barParts(u().rolling.percent).right}</text>
                </box>
                <box flexDirection="row">
                  <text fg="gray">{`wk ${relative(u().weekly.resetsAt).padEnd(6)} ${barParts(u().weekly.percent).left}`}</text>
                  <text fg={color(u().weekly.percent)}>{barParts(u().weekly.percent).label}</text>
                  <text fg="gray">{barParts(u().weekly.percent).right}</text>
                </box>
                <box flexDirection="row">
                  <text fg="gray">{`mo ${relative(u().monthly.resetsAt).padEnd(6)} ${barParts(u().monthly.percent).left}`}</text>
                  <text fg={color(u().monthly.percent)}>{barParts(u().monthly.percent).label}</text>
                  <text fg="gray">{barParts(u().monthly.percent).right}</text>
                </box>
              </box>
            )}
          </Show>
        </box>
      ),
    })

    return () => {
      clearInterval(timer)
      unregisterApp()
      unregisterSetupFooter()
      unregisterPromptFooter()
      unregisterCard()
    }
  },
})
