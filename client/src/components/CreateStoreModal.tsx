import { type FormEvent, useState } from "react"
import { useCreateStore } from "../hooks/useStores"
import { Modal } from "./ui/Modal"

interface CreateStoreModalProps {
  open: boolean
  onClose: () => void
}

export function CreateStoreModal({ open, onClose }: CreateStoreModalProps) {
  const [name, setName] = useState("")
  const [locationName, setLocationName] = useState("")
  const [address, setAddress] = useState("")
  const createStore = useCreateStore()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    createStore.mutate(
      {
        name: name.trim(),
        location_name: locationName.trim() || undefined,
        address: address.trim() || undefined,
      },
      {
        onSuccess: () => {
          setName("")
          setLocationName("")
          setAddress("")
          onClose()
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Store">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="store-name" className="block text-sm font-medium text-gray-700">
            Name *
          </label>
          <input
            id="store-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            required
          />
        </div>
        <div>
          <label htmlFor="store-location" className="block text-sm font-medium text-gray-700">
            Location
          </label>
          <input
            id="store-location"
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="store-address" className="block text-sm font-medium text-gray-700">
            Address
          </label>
          <input
            id="store-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
        </div>
        {createStore.error && (
          <p className="text-sm text-red-600">{(createStore.error as Error).message}</p>
        )}
        <button
          type="submit"
          disabled={createStore.isPending || !name.trim()}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createStore.isPending ? "Creating..." : "Create Store"}
        </button>
      </form>
    </Modal>
  )
}
