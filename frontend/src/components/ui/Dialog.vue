<script setup>
// Reka Dialog* wrapper. Not used by the v1 auth shell — included as the modal
// primitive for later model-editing UI (notes/frontend-architecture.md §6).
//
// Controlled open state via `v-model:open` (Reka DialogRoot binds `open`).
// Slots: #trigger (optional, rendered inside DialogTrigger asChild), default
// (the body, inside DialogContent), and `title` is a prop for the a11y title.
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'

const open = defineModel('open', { type: Boolean, default: false })

defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/50" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg focus:outline-none"
      >
        <DialogTitle v-if="title" class="text-lg font-semibold text-gray-900">{{ title }}</DialogTitle>
        <DialogDescription v-if="description" class="mt-1 text-sm text-gray-600">{{ description }}</DialogDescription>
        <div class="mt-4">
          <slot />
        </div>
        <DialogClose
          class="absolute right-4 top-4 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand"
          aria-label="Close"
        >
          &times;
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
