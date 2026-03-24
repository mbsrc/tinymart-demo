import { AppError } from "../types/index.js"
import { logger } from "./logger.js"

export type CircuitState = "closed" | "open" | "half_open"

export interface CircuitBreakerOptions {
  name: string
  failureThreshold: number
  resetTimeoutMs: number
  halfOpenMaxAttempts: number
}

export interface CircuitBreakerStatus {
  state: CircuitState
  failureCount: number
  lastFailureTime: string | null
  nextRetryTime: string | null
}

const DEFAULTS: Omit<CircuitBreakerOptions, "name"> = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxAttempts: 1,
}

export class CircuitBreaker {
  private state: CircuitState = "closed"
  private failureCount = 0
  private lastFailureTime: number | null = null
  private halfOpenAttempts = 0
  private readonly options: CircuitBreakerOptions

  constructor(
    options: Pick<CircuitBreakerOptions, "name"> & Partial<Omit<CircuitBreakerOptions, "name">>,
  ) {
    this.options = { ...DEFAULTS, ...options }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (this.shouldTransitionToHalfOpen()) {
        this.transitionTo("half_open")
      } else {
        throw new AppError(503, "CIRCUIT_OPEN", `${this.options.name} is temporarily unavailable`)
      }
    }

    if (this.state === "half_open" && this.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
      throw new AppError(503, "CIRCUIT_OPEN", `${this.options.name} is temporarily unavailable`)
    }

    try {
      if (this.state === "half_open") {
        this.halfOpenAttempts++
      }

      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      nextRetryTime:
        this.state === "open" && this.lastFailureTime
          ? new Date(this.lastFailureTime + this.options.resetTimeoutMs).toISOString()
          : null,
    }
  }

  getState(): CircuitState {
    return this.state
  }

  private shouldTransitionToHalfOpen(): boolean {
    if (!this.lastFailureTime) return false
    return Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs
  }

  private onSuccess(): void {
    if (this.state === "half_open") {
      this.transitionTo("closed")
    }
    this.failureCount = 0
    this.lastFailureTime = null
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === "half_open") {
      this.transitionTo("open")
      return
    }

    if (this.failureCount >= this.options.failureThreshold) {
      this.transitionTo("open")
    }
  }

  private transitionTo(newState: CircuitState): void {
    const previousState = this.state
    this.state = newState

    if (newState === "half_open") {
      this.halfOpenAttempts = 0
    }

    if (newState === "closed") {
      this.failureCount = 0
      this.lastFailureTime = null
    }

    logger.info(`Circuit breaker "${this.options.name}" transitioned`, {
      from: previousState,
      to: newState,
      failure_count: this.failureCount,
    })
  }
}
