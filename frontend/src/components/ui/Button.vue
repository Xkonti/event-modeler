<script setup>
// Base button on Reka's `Primitive`. Exists so Reka triggers can `asChild` onto
// it (merge their behavior onto our styled element) and so the app has one
// styled button. See notes/frontend-architecture.md §6.
//
// `as` lets callers swap the rendered tag (e.g. RouterLink); `asChild` merges
// props onto a single child. `type` defaults to 'button' so a bare <Button> in
// a <form> doesn't accidentally submit; pass type="submit" for the submit btn.
import { Primitive } from 'reka-ui'

defineProps({
  variant: { type: String, default: 'primary' }, // 'primary' | 'secondary' | 'ghost'
  as: { type: [String, Object], default: 'button' },
  asChild: { type: Boolean, default: false },
  type: { type: String, default: 'button' },
})

const base =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2'

const byVariant = {
  primary: 'bg-brand text-brand-fg hover:opacity-90',
  secondary: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
  ghost: 'text-gray-700 hover:bg-gray-100',
}
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :type="as === 'button' ? type : undefined"
    :class="[base, byVariant[variant] || byVariant.primary]"
  >
    <slot />
  </Primitive>
</template>
