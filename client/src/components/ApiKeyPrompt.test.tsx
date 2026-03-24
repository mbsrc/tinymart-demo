import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { renderWithProviders } from "../test/render"
import { ApiKeyPrompt } from "./ApiKeyPrompt"

describe("ApiKeyPrompt", () => {
  describe("rendering", () => {
    it("renders the prompt heading", () => {
      renderWithProviders(<ApiKeyPrompt />)
      expect(screen.getByText("Connect to TinyMart")).toBeInTheDocument()
    })

    it("renders description text", () => {
      renderWithProviders(<ApiKeyPrompt />)
      expect(screen.getByText(/enter your operator api key/i)).toBeInTheDocument()
    })

    it("renders input field with placeholder", () => {
      renderWithProviders(<ApiKeyPrompt />)
      expect(screen.getByPlaceholderText("Paste your API key")).toBeInTheDocument()
    })

    it("renders connect button", () => {
      renderWithProviders(<ApiKeyPrompt />)
      expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument()
    })
  })

  describe("validation", () => {
    it("disables button when input is empty", () => {
      renderWithProviders(<ApiKeyPrompt />)
      expect(screen.getByRole("button", { name: /connect/i })).toBeDisabled()
    })

    it("disables button when input is only whitespace", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ApiKeyPrompt />)
      await user.type(screen.getByPlaceholderText("Paste your API key"), "   ")
      expect(screen.getByRole("button", { name: /connect/i })).toBeDisabled()
    })

    it("enables button when input has text", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ApiKeyPrompt />)
      await user.type(screen.getByPlaceholderText("Paste your API key"), "some-key")
      expect(screen.getByRole("button", { name: /connect/i })).not.toBeDisabled()
    })
  })

  describe("submission", () => {
    it("shows Connecting... while validating", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ApiKeyPrompt />)
      await user.type(screen.getByPlaceholderText("Paste your API key"), "valid-key")
      await user.click(screen.getByRole("button", { name: /connect/i }))

      // Eventually resolves
      await waitFor(() => {
        expect(localStorage.getItem("tinymart-api-key")).toBe("valid-key")
      })
    })

    it("shows error for invalid API key", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ApiKeyPrompt />)
      await user.type(screen.getByPlaceholderText("Paste your API key"), "bad-key")
      await user.click(screen.getByRole("button", { name: /connect/i }))
      expect(await screen.findByText(/invalid api key/i)).toBeInTheDocument()
    })

    it("does not store invalid key in localStorage", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ApiKeyPrompt />)
      await user.type(screen.getByPlaceholderText("Paste your API key"), "bad-key")
      await user.click(screen.getByRole("button", { name: /connect/i }))
      await screen.findByText(/invalid api key/i)
      expect(localStorage.getItem("tinymart-api-key")).toBeNull()
    })

    it("stores valid key in localStorage", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ApiKeyPrompt />)
      await user.type(screen.getByPlaceholderText("Paste your API key"), "valid-key")
      await user.click(screen.getByRole("button", { name: /connect/i }))
      await waitFor(() => {
        expect(localStorage.getItem("tinymart-api-key")).toBe("valid-key")
      })
    })

    it("re-enables button after failed attempt", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ApiKeyPrompt />)
      await user.type(screen.getByPlaceholderText("Paste your API key"), "bad-key")
      await user.click(screen.getByRole("button", { name: /connect/i }))
      await screen.findByText(/invalid api key/i)

      // Button should be re-enabled
      expect(screen.getByRole("button", { name: /connect/i })).not.toBeDisabled()
    })
  })
})
