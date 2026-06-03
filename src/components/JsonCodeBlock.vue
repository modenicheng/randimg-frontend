<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  code: string
}>();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const highlightToken = (match: string, stringToken?: string, keySeparator?: string, literal?: string) => {
  if (stringToken) {
    if (keySeparator !== undefined) {
      const separator = keySeparator.replace(":", '<span class="json-punctuation">:</span>');
      return `<span class="json-key">${stringToken}</span>${separator}`;
    }

    return `<span class="json-string">${stringToken}</span>`;
  }

  if (literal) {
    return `<span class="json-literal">${literal}</span>`;
  }

  if (/^-?\d/.test(match)) {
    return `<span class="json-number">${match}</span>`;
  }

  return `<span class="json-punctuation">${match}</span>`;
};

const highlightJson = (source: string) => {
  const escaped = escapeHtml(source);
  const tokenPattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;

  return escaped.replace(tokenPattern, highlightToken);
};

const highlightedCode = computed(() => highlightJson(props.code.trim()));
</script>

<template>
  <v-card variant="flat" class="code-card mb-2">
    <v-card-text>
      <pre class="json-code" v-html="highlightedCode"></pre>
    </v-card-text>
  </v-card>
</template>

<style scoped lang="scss">
.code-card {
  margin: 0.75rem 0 1.75rem;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background: rgba(var(--v-theme-on-surface), 0.035);
  color: rgb(var(--v-theme-on-surface));
}

.code-card.v-theme--dark {
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  background: rgba(var(--v-theme-on-surface), 0.07);
}

.code-card :deep(.v-card-text) {
  padding: 1rem 1.25rem;
}

.json-code {
  margin: 0;
  overflow-x: auto;
  white-space: pre;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.65;
}

.json-code :deep(.json-key) {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.json-code :deep(.json-string) {
  color: #2e7d32;
}

.json-code :deep(.json-number) {
  color: #b26a00;
}

.json-code :deep(.json-literal) {
  color: #7b1fa2;
  font-weight: 600;
}

.json-code :deep(.json-punctuation) {
  color: rgba(var(--v-theme-on-surface), 0.64);
}

.code-card.v-theme--dark .json-code :deep(.json-string) {
  color: #81c995;
}

.code-card.v-theme--dark .json-code :deep(.json-number) {
  color: #fdd663;
}

.code-card.v-theme--dark .json-code :deep(.json-literal) {
  color: #d7aefb;
}

@media (max-width: 600px) {
  .code-card :deep(.v-card-text) {
    padding: 0.875rem 1rem;
  }
}
</style>
