<script setup lang="ts">
import { ui } from '@/ui/figma'
</script>

<template>
  <svg
    class="tp-icon"
    :width="ui.isUi3 ? 24 : 32"
    :height="ui.isUi3 ? 24 : 32"
    :viewBox="ui.isUi3 ? '-4 -4 32 32' : '0 0 24 24'"
  >
    <path
      fill="currentColor"
      d="M13 17a.999.999 0 1 0-1.998 0a.999.999 0 0 0 1.997 0m-.26-7.853a.75.75 0 0 0-1.493.103l.004 4.501l.007.102a.75.75 0 0 0 1.493-.103l-.004-4.502zm1.23-5.488c-.857-1.548-3.082-1.548-3.938 0L2.286 17.66c-.83 1.5.255 3.34 1.97 3.34h15.49c1.714 0 2.799-1.84 1.969-3.34zm-2.626.726a.75.75 0 0 1 1.313 0l7.746 14.002a.75.75 0 0 1-.657 1.113H4.256a.75.75 0 0 1-.657-1.113z"
    />
  </svg>
</template>
