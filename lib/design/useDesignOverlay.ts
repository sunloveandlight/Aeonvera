"use client";

import { useOverlayMode } from "@/lib/audit/useOverlayMode";

export function useDesignOverlay() {
  return useOverlayMode();
}
