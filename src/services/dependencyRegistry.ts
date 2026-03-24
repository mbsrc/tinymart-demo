import { logger } from "../utils/logger.js"

export type DependencyStatus = "healthy" | "degraded" | "unavailable"

export interface DependencyInfo {
  name: string
  status: DependencyStatus
  lastChecked: string | null
  lastError: string | null
}

type HealthCheckFn = () => Promise<DependencyStatus>

interface RegisteredDependency {
  name: string
  healthCheck: HealthCheckFn
  status: DependencyStatus
  lastChecked: Date | null
  lastError: string | null
}

export class DependencyRegistry {
  private dependencies = new Map<string, RegisteredDependency>()
  private monitorInterval: ReturnType<typeof setInterval> | null = null

  register(name: string, healthCheck: HealthCheckFn): void {
    this.dependencies.set(name, {
      name,
      healthCheck,
      status: "healthy",
      lastChecked: null,
      lastError: null,
    })
  }

  async checkOne(name: string): Promise<DependencyStatus> {
    const dep = this.dependencies.get(name)
    if (!dep) return "unavailable"

    try {
      dep.status = await dep.healthCheck()
      dep.lastError = null
    } catch (error) {
      dep.status = "unavailable"
      dep.lastError = error instanceof Error ? error.message : String(error)
    }

    dep.lastChecked = new Date()
    return dep.status
  }

  async checkAll(): Promise<void> {
    const names = [...this.dependencies.keys()]
    await Promise.allSettled(names.map((name) => this.checkOne(name)))
  }

  getStatus(name: string): DependencyStatus {
    return this.dependencies.get(name)?.status ?? "unavailable"
  }

  getInfo(name: string): DependencyInfo | null {
    const dep = this.dependencies.get(name)
    if (!dep) return null

    return {
      name: dep.name,
      status: dep.status,
      lastChecked: dep.lastChecked?.toISOString() ?? null,
      lastError: dep.lastError,
    }
  }

  getAllStatuses(): Record<string, DependencyInfo> {
    const result: Record<string, DependencyInfo> = {}
    for (const [name, dep] of this.dependencies) {
      result[name] = {
        name: dep.name,
        status: dep.status,
        lastChecked: dep.lastChecked?.toISOString() ?? null,
        lastError: dep.lastError,
      }
    }
    return result
  }

  isHealthy(name: string): boolean {
    return this.getStatus(name) === "healthy"
  }

  startMonitoring(intervalMs = 10_000): void {
    if (this.monitorInterval) return

    this.monitorInterval = setInterval(() => {
      this.checkAll().catch((error) => {
        logger.error("Dependency health check cycle failed", {
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }, intervalMs)

    // Run an initial check immediately
    this.checkAll().catch(() => {})

    logger.info("Dependency monitoring started", { interval_ms: intervalMs })
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
      logger.info("Dependency monitoring stopped")
    }
  }
}

export const dependencyRegistry = new DependencyRegistry()
