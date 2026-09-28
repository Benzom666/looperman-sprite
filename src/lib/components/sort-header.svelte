<script lang="ts">
    import { cn } from "$lib/utils.js"
    import ChevronDown from "lucide-svelte/icons/chevron-down"
    import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down"
    import Lock from "lucide-svelte/icons/lock"
    import Button, {
        type ButtonProps,
    } from "$lib/components/ui/button/button.svelte"
    import type { AssetSortType, SortOrder } from "$lib/splice/types"

    let {
        class: className,
        value,
        label,
        sort,
        order,
        onsort,
        disabled = false,
        disabledReason,
    }: {
        class?: string
        value: AssetSortType
        label: string
        sort: AssetSortType
        order: SortOrder
        onsort: (newSort: AssetSortType) => void
        disabled?: boolean
        disabledReason?: string
    } = $props()

    const active = $derived(value == sort)
</script>

<div class={className}>
    <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        class={cn(
            "gap-0 p-1",
            active ? "text-primary" : "text-muted-foreground"
        )}
        onclick={() => !disabled && onsort(value)}
    >
        <p>{label}</p>
        {#if disabled}
            <Lock size="12" />
        {:else if active}
            <ChevronDown
                size="18"
                class={cn(
                    "transition-transform ease-in-out",
                    order == "ASC" ? "rotate-[-180deg]" : ""
                )}
            />
        {:else}
            <ChevronsUpDown size="12" />
        {/if}
    </Button>
</div>
