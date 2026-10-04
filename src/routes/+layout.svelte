<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { initThemeListener } from "$lib/stores/theme";
  import { initI18n } from "$lib/i18n";

  onMount(() => {
    initThemeListener();
    initI18n();
  });
</script>

<slot />
