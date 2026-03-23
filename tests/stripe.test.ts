import Stripe from "stripe"
import { describe, expect, it } from "vitest"
import { mapStripeError } from "../src/services/stripe.js"
import { AppError } from "../src/types/index.js"

describe("mapStripeError", () => {
  it("maps StripeCardError to 422 CARD_DECLINED", () => {
    const error = new Stripe.errors.StripeCardError({
      message: "Your card was declined",
      type: "card_error",
    })
    const result = mapStripeError(error)
    expect(result).toBeInstanceOf(AppError)
    expect(result.statusCode).toBe(422)
    expect(result.code).toBe("CARD_DECLINED")
  })

  it("maps StripeInvalidRequestError to 400", () => {
    const error = new Stripe.errors.StripeInvalidRequestError({
      message: "Invalid request",
      type: "invalid_request_error",
    })
    const result = mapStripeError(error)
    expect(result.statusCode).toBe(400)
    expect(result.code).toBe("STRIPE_INVALID_REQUEST")
  })

  it("maps StripeConnectionError to 502", () => {
    const error = new Stripe.errors.StripeConnectionError({
      message: "Connection failed",
      type: "api_connection_error",
    })
    const result = mapStripeError(error)
    expect(result.statusCode).toBe(502)
    expect(result.code).toBe("STRIPE_UNAVAILABLE")
  })

  it("maps StripeAPIError to 502", () => {
    const error = new Stripe.errors.StripeAPIError({
      message: "API error",
      type: "api_error",
    })
    const result = mapStripeError(error)
    expect(result.statusCode).toBe(502)
    expect(result.code).toBe("STRIPE_UNAVAILABLE")
  })

  it("passes through AppError unchanged", () => {
    const error = new AppError(404, "NOT_FOUND", "Not found")
    const result = mapStripeError(error)
    expect(result).toBe(error)
  })

  it("maps unknown errors to 500", () => {
    const result = mapStripeError(new Error("unknown"))
    expect(result.statusCode).toBe(500)
    expect(result.code).toBe("INTERNAL_ERROR")
  })
})
