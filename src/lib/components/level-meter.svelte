<script lang="ts">
    import { dataStore, PER_PAGE } from "$lib/shared/store.svelte"
    import { loading } from "$lib/shared/loading.svelte"
    import { globalAudio } from "$lib/shared/audio.svelte"
    import { cn } from "$lib/utils"

    const SEGMENTS = 28

    let { class: className }: { class?: string } = $props()

    const playing = $derived(
        globalAudio.currentAsset != null && !globalAudio.paused
    )

    // How full the current page is. A real meter reading, not decoration.
    const filled = $derived(
        Math.min(
            Math.round(
                (Math.min(dataStore.sampleAssets.length, PER_PAGE) / PER_PAGE) *
                    SEGMENTS
            ),
            SEGMENTS
        )
    )

    const lit = $derived(loading.assets ? SEGMENTS : filled)
</script>

<div
    class={cn("flex items-end gap-[2px] h-4", className)}
    role="meter"
    aria-valuemin={0}
    aria-valuemax={dataStore.total_records}
    aria-valuenow={dataStore.total_records}
    aria-label="Result meter"
>
    {#each { length: SEGMENTS } as _, index}
        <div
            class={cn(
                "w-[3px] rounded-[1px] transition-[height,background-color] duration-300",
                loading.assets
                    ? "bg-signal animate-pulse"
                    : index < lit
                      ? playing
                          ? "bg-live"
                          : "bg-signal"
                      : "bg-border",
                index % 4 === 3 && index !== SEGMENTS - 1 && "mr-[3px]"
            )}
            style={`height: ${loading.assets ? 100 : 34 + index * 2.4}%`}
        ></div>
    {/each}
</div>
