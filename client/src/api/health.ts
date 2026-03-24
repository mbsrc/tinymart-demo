import type { DetailedHealth, HealthCheck, ReadinessCheck } from "../types/api"
import { apiGet } from "./client"

export function getHealth() {
  return apiGet<HealthCheck>("/health")
}

export function getReadiness() {
  return apiGet<ReadinessCheck>("/health/ready")
}

export function getDetailedHealth() {
  return apiGet<DetailedHealth>("/health/detailed")
}
