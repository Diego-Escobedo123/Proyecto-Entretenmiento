<script setup lang="ts">
/**
 * ConfirmDialog — confirmación destructiva reutilizable sobre BaseModal.
 * Uso:
 *   <ConfirmDialog
 *     v-if="pendingDelete"
 *     title="Eliminar obra"
 *     :message="`¿Eliminar “${pendingDelete.title}”? Esta acción no se puede deshacer.`"
 *     @confirm="doDelete"
 *     @cancel="pendingDelete = null"
 *   />
 */
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'

withDefaults(
  defineProps<{ title: string; message: string; confirmText?: string }>(),
  { confirmText: 'Eliminar' },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <BaseModal :title="title" @close="emit('cancel')">
    <p class="confirm-dialog__message">{{ message }}</p>
    <template #footer>
      <BaseButton variant="ghost" @click="emit('cancel')">Cancelar</BaseButton>
      <BaseButton class="confirm-dialog__danger" @click="emit('confirm')">{{ confirmText }}</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.confirm-dialog__message {
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
}

.confirm-dialog__danger {
  --color-accent: #ef4444;
  --color-accent-hover: #f87171;
  --color-accent-contrast: #fff;
}
</style>
