import type { ApiResponse } from "../types/api"

let apiKey: string | null = null

export function setApiKey(key: string | null) {
  apiKey = key
}

export function getApiKey() {
  return apiKey
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (apiKey) h["x-api-key"] = apiKey
  return h
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiResponse<T>
  if (!body.success || body.error) {
    const err = new Error(body.error?.message ?? "Request failed") as Error & {
      code?: string
      status?: number
      correlationId?: string
    }
    err.code = body.error?.code
    err.status = res.status
    err.correlationId = body.meta?.correlation_id
    throw err
  }
  return body.data as T
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: headers() })
  return unwrap<T>(res)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      ...headers(),
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return unwrap<T>(res)
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: {
      ...headers(),
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  })
  return unwrap<T>(res)
}
