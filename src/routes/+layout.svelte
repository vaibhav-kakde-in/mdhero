<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { initThemeListener } from "$lib/stores/theme";
  // Runs locale detection and sets <html lang> before the first render.
  import "$lib/i18n";

  onMount(() => {
    initThemeListener();
  });
</script>

<slot />
