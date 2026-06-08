// LAYER 4 — Pinia store, client-truth only: canvas view state with no server
// origin. Viewport (pan/zoom), the current selection, and the active-layers
// stub. See notes/frontend-architecture.md §4.
//
// IMPORTANT: this store holds NO placement positions. Placement x/y are server
// truth and live in the colada cache (useSlice); the canvas reads them from
// there and writes them back via the slice repo's move mutation. Keeping
// positions out of here avoids a second source of truth that could drift.
//
// The viewport is intentionally NOT persisted server-side — it resets on reload,
// which is fine for v1 (single-user, share-screen).
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCanvasStore = defineStore('canvas', () => {
  // --- viewport (pan/zoom) --- vue-flow's { x, y, zoom }
  const viewport = ref({ x: 0, y: 0, zoom: 1 })
  /** @param {{ x: number, y: number, zoom: number }} v */
  function setViewport(v) {
    viewport.value = v
  }

  // --- selection --- mutually exclusive node vs edge selection.
  /** @type {import('vue').Ref<string|null>} */
  const selectedNodeId = ref(null)
  /** @type {import('vue').Ref<string|null>} */
  const selectedEdgeId = ref(null)

  /** @param {string|null} id */
  function selectNode(id) {
    selectedNodeId.value = id
    selectedEdgeId.value = null
  }
  /** @param {string|null} id */
  function selectEdge(id) {
    selectedEdgeId.value = id
    selectedNodeId.value = null
  }
  function clearSelection() {
    selectedNodeId.value = null
    selectedEdgeId.value = null
  }

  // --- active layers (stub) --- future: filter which entity types render.
  /** @type {import('vue').Ref<string[]>} */
  const activeLayers = ref([])

  return {
    viewport,
    setViewport,
    selectedNodeId,
    selectedEdgeId,
    selectNode,
    selectEdge,
    clearSelection,
    activeLayers,
  }
})
