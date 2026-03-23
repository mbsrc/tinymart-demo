interface PaginationParams {
  page: number
  limit: number
  offset: number
}

interface PaginationMeta {
  page: number
  limit: number
  total: number
  total_pages: number
}

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT))
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
  }
}

export type { PaginationMeta }
