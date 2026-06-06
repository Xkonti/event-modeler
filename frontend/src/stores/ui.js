// LAYER 4 — Pinia store, client-truth only: UI chrome state with no server
// origin. Sidebar collapse, active theme, transient banners. See
// notes/frontend-architecture.md §4. No server data cached here (colada's job).
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/** @typedef {{ id: number, kind: 'info'|'success'|'error', text: string }} Banner */

export const useUiStore = defineStore('ui', () => {
  // --- sidebar ---
  const sidebarCollapsed = ref(false)
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
  /** @param {boolean} v */
  function setSidebarCollapsed(v) {
    sidebarCollapsed.value = v
  }

  // --- theme --- ('light' | 'dark')
  const theme = ref('light')
  /** @param {'light'|'dark'} t */
  function setTheme(t) {
    theme.value = t
  }
  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  // --- transient banners ---
  /** @type {import('vue').Ref<Banner[]>} */
  const banners = ref([])
  let nextBannerId = 1

  /**
   * @param {'info'|'success'|'error'} kind
   * @param {string} text
   * @returns {number} banner id (for manual dismiss)
   */
  function pushBanner(kind, text) {
    const id = nextBannerId++
    banners.value.push({ id, kind, text })
    return id
  }
  /** @param {number} id */
  function dismissBanner(id) {
    banners.value = banners.value.filter((b) => b.id !== id)
  }
  function clearBanners() {
    banners.value = []
  }

  const hasBanners = computed(() => banners.value.length > 0)

  return {
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
    theme,
    setTheme,
    toggleTheme,
    banners,
    hasBanners,
    pushBanner,
    dismissBanner,
    clearBanners,
  }
})
