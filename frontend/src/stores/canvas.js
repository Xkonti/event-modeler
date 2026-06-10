// LAYER 4 — Pinia store, client-truth only: the canvas VIEWPORT (pan/zoom),
// nothing else. Selection moved to stores/workspace.js (the inspector and the
// canvas highlight share one selection source); placement geometry is server
// truth projected through the layout solver — never stored.
//
// The viewport is intentionally NOT persisted server-side — it resets on
// reload, which is fine for v1 (single-user, share-screen).
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCanvasStore = defineStore('canvas', () => {
  // vue-flow's { x, y, zoom }
  const viewport = ref({ x: 0, y: 0, zoom: 1 })
  /** @param {{ x: number, y: number, zoom: number }} v */
  function setViewport(v) {
    viewport.value = v
  }

  return { viewport, setViewport }
})
