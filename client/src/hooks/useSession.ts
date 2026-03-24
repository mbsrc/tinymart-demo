import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { addItem, closeSession, createSession, getKioskStore, getSession } from "../api/sessions"

export function useKioskStore(storeId: string) {
  return useQuery({
    queryKey: ["kiosk-store", storeId],
    queryFn: () => getKioskStore(storeId),
    enabled: !!storeId,
  })
}

export function useCreateSession() {
  return useMutation({
    mutationFn: createSession,
  })
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: ["sessions", id],
    queryFn: () => getSession(id as string),
    enabled: !!id,
  })
}

export function useAddItem(sessionId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { product_id: string; action: "added" | "removed" }) =>
      addItem(sessionId as string, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions", sessionId] }),
  })
}

export function useCloseSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => closeSession(sessionId),
    onSuccess: (_data, sessionId) => qc.invalidateQueries({ queryKey: ["sessions", sessionId] }),
  })
}
