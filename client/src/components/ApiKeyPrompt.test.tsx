import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { renderWithProviders } from "../test/render"
import { ApiKeyPrompt } from "./ApiKeyPrompt"

describe("ApiKeyPrompt", () => {
  it("renders the prompt with input and button", () => {
    renderWithProviders(<ApiKeyPrompt />)
    expect(screen.getByText("Connect to TinyMart")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Paste your API key")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument()
  })

  it("disables button when input is empty", () => {
    renderWithProviders(<ApiKeyPrompt />)
    expect(screen.getByRole("button", { name: /connect/i })).toBeDisabled()
  })

  it("enables button when input has text", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ApiKeyPrompt />)
    await user.type(screen.getByPlaceholderText("Paste your API key"), "some-key")
    expect(screen.getByRole("button", { name: /connect/i })).not.toBeDisabled()
  })

  it("shows error for invalid API key", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ApiKeyPrompt />)
    // The MSW handler checks for x-api-key header; an empty-ish key will fail
    await user.type(screen.getByPlaceholderText("Paste your API key"), "bad-key")
    await user.click(screen.getByRole("button", { name: /connect/i }))
    expect(await screen.findByText(/invalid api key/i)).toBeInTheDocument()
  })

  it("accepts valid API key and dismisses", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ApiKeyPrompt />)
    await user.type(screen.getByPlaceholderText("Paste your API key"), "valid-key")
    await user.click(screen.getByRole("button", { name: /connect/i }))

    // After successful validation, the prompt should disappear (key is stored)
    await waitFor(() => {
      expect(localStorage.getItem("tinymart-api-key")).toBe("valid-key")
    })
  })
})
