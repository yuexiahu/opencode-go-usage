# opencode-go-usage

Sidebar + footer widget for [OpenCode](https://opencode.ai) (V2) showing your
[OpenCode Go](https://opencode.ai/v2/docs/console/go) quota at a glance:
used percent and reset time for the 5h / weekly / monthly windows.

![status](https://img.shields.io/badge/opencode-%3E%3D2.0.12-blue)

## Features

- Sidebar card (`sidebar.content`): three rows, one per window, each with a
  compact reset countdown (`03h40m` / `05d15h` / `23d02h`) and a slider-style
  bar with the percent embedded (`─14%────────`). Only the number is colored
  (green / yellow / red by threshold), everything else stays gray.
- Footer status (`home.footer.status` + `prompt.footer.status`):
  `Go 1/2/14%`.
- Auto refresh every 60s, plus a `Refresh Go usage` palette command and a
  `/go-usage-refresh` slash command.
- Server side also registers a `go_usage` agent tool and a `/go-usage`
  slash command.

## Requirements

- OpenCode V2 (tested on 2.0.12).
- An OpenCode Go API key connected via `/connect` ( otherwise the widget
  shows an error state). The plugin reads the stored credential, it never
  stores or transmits the key anywhere else.

## Install

### A. Manual (local directory)

```sh
cp -r opencode-go-usage ~/.config/opencode/plugins/
cd ~/.config/opencode/plugins/opencode-go-usage
npm install
```

Restart the OpenCode TUI. No config entry needed: the directory is
auto-discovered (the root `index.ts` / `tui.tsx` re-export `src/`).

### B. From GitHub

```sh
opencode plugin add github:yuexiahu/opencode-go-usage
```

## How it works

There is no official CLI/API for the Go quota, but the inference gateway
exposes an undocumented endpoint that returns the three windows:

```sh
curl https://opencode.ai/zen/go/v1/usage \
  -H "Authorization: Bearer $OPENCODE_GO_KEY" \
  -H "User-Agent: opencode"
```

```json
{"usage":{
  "rolling":{"status":"ok","percent":1,"resetsAt":"2026-09-22T11:57:31.123Z"},
  "weekly":{"status":"ok","percent":2,"resetsAt":"2026-09-28T00:00:00.000Z"},
  "monthly":{"status":"ok","percent":14,"resetsAt":"2026-10-15T11:38:12.000Z"}}}
```

Notes:

- The `User-Agent: opencode` header is required, otherwise Cloudflare
  answers `403 error code: 1010`.
- `rolling` is the 5h window ($12), `weekly` is $30, `monthly` is $60.

## Layout

```
├── index.ts        # package root entry (re-export, needed for discovery)
├── tui.tsx         # package root TUI entry (re-export)
├── package.json    # exports ".", "./rpc", "./tui"
└── src/
    ├── index.ts    # server plugin: RPC + tool + command
    ├── rpc.ts      # shared Rpc definition
    └── tui.tsx     # sidebar card + footer status + refresh command
```

## License

MIT
