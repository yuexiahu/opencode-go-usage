import { Rpc } from "@opencode/plugin/rpc"

const windowSchema = {
  type: "object",
  properties: {
    status: { type: "string" },
    percent: { type: "number" },
    resetsAt: { type: "string" },
  },
  required: ["status", "percent", "resetsAt"],
  additionalProperties: false,
} as const

export const GoUsage = Rpc.define({
  id: "go-usage",
  methods: {
    get: {
      input: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          rolling: windowSchema,
          weekly: windowSchema,
          monthly: windowSchema,
          fetchedAt: { type: "string" },
        },
        required: ["rolling", "weekly", "monthly", "fetchedAt"],
        additionalProperties: false,
      },
      errors: {
        no_auth: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
          additionalProperties: false,
        },
        fetch_failed: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
          additionalProperties: false,
        },
      },
    },
  },
  events: {},
})
