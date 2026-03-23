import type { ApiResponse, ErrorDetail, ResponseMeta } from "../types/index.js"

export function envelope<T>(data: T, meta: ResponseMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta,
  }
}

export function errorEnvelope(error: ErrorDetail, meta: ResponseMeta): ApiResponse<never> {
  return {
    success: false,
    data: null,
    error,
    meta,
  }
}
