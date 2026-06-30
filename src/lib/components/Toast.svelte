<script lang="ts">
  import { toasts } from "$lib/stores/toast";
</script>

{#if $toasts.length > 0}
  <div class="toast-stack">
    {#each $toasts as toast (toast.id)}
      <div class="toast">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 5v3.5M8 11h.01" />
        </svg>
        <span class="toast-text">{toast.message}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-stack {
    position: fixed;
    bottom: 96px;
    right: 16px;
    z-index: 101;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 360px;
    padding: 10px 14px;
    background: white;
    border: 1px solid #e5e5ea;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
    font-size: 12px;
    color: #1c1c1e;
    animation: slideUp 0.3s ease-out;
  }

  :global(html.dark) .toast {
    background: #2c2c2e;
    border-color: #3a3a3c;
    color: #e5e5e7;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }

  .toast svg {
    color: #c0392b;
    flex-shrink: 0;
  }

  .toast-text {
    line-height: 1.35;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media print {
    .toast-stack { display: none !important; }
  }
</style>
