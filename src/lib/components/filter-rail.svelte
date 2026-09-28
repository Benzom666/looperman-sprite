<script lang="ts">
    import { config } from "$lib/shared/config.svelte"
    import {
        dataStore,
        queryStore,
        fetchAssets,
        randomSeed,
    } from "$lib/shared/store.svelte"
    import SourceSelect from "$lib/components/source-select.svelte"
    import KeySelect from "$lib/components/key-select.svelte"
    import BpmSelect from "$lib/components/bpm-select.svelte"
    import AssetCategorySelect from "$lib/components/asset-category-select.svelte"
    import SortSelect from "$lib/components/sort-select.svelte"
    import TagBadge from "$lib/components/tag-badge.svelte"
    import Shuffle from "lucide-svelte/icons/shuffle"
    import Button from "$lib/components/ui/button/button.svelte"
    import { cn } from "$lib/utils"

    let { class: className }: { class?: string } = $props()

    let expandTags = $state(false)

    const isFreesoundSource = $derived(config.active_source == "freesound")

    const hasFilters = $derived(
        dataStore.tags.length > 0 ||
            queryStore.key != null ||
            queryStore.bpm != null ||
            queryStore.min_bpm != null ||
            queryStore.max_bpm != null ||
            queryStore.asset_category_slug != null
    )

    const clearAll = () => {
        dataStore.tags.splice(0, dataStore.tags.length)
        queryStore.key = null
        queryStore.chord_type = null
        queryStore.bpm = null
        queryStore.min_bpm = null
        queryStore.max_bpm = null
        queryStore.asset_category_slug = null
        fetchAssets()
    }
</script>

<aside
    class={cn(
        "w-60 shrink-0 border-r border-border bg-panel flex flex-col overflow-clip",
        className
    )}
>
    <div class="flex flex-col gap-5 p-4 overflow-y-auto">
        <div class="flex flex-col gap-1.5">
            <span
                class="text-[10px] uppercase tracking-widest text-muted-foreground"
            >
                Library
            </span>
            <SourceSelect class="w-full" />
        </div>

        <div class="flex flex-col gap-1.5">
            <span
                class="text-[10px] uppercase tracking-widest text-muted-foreground"
            >
                Key
            </span>
            <KeySelect
                class="w-full"
                bind:key={queryStore.key}
                bind:chord_type={queryStore.chord_type}
                onselect={fetchAssets}
            />
        </div>

        <div class="flex flex-col gap-1.5">
            <span
                class="text-[10px] uppercase tracking-widest text-muted-foreground"
            >
                Tempo
            </span>
            <BpmSelect
                class="w-full"
                bind:bpm={queryStore.bpm}
                bind:min_bpm={queryStore.min_bpm}
                bind:max_bpm={queryStore.max_bpm}
                onsubmit={fetchAssets}
            />
        </div>

        <div class="flex flex-col gap-1.5">
            <span
                class="text-[10px] uppercase tracking-widest text-muted-foreground"
            >
                Type
            </span>
            <AssetCategorySelect
                class="w-full"
                bind:asset_category_slug={queryStore.asset_category_slug}
                onselect={fetchAssets}
            />
        </div>

        <div class="flex flex-col gap-1.5">
            <span
                class="text-[10px] uppercase tracking-widest text-muted-foreground"
            >
                Sort
            </span>
            <div class="flex gap-1.5">
                <SortSelect
                    class="flex-1"
                    bind:sort={queryStore.sort}
                    onselect={fetchAssets}
                    order={queryStore.order}
                />
                <Button
                    variant="outline"
                    size="icon"
                    title="Shuffle"
                    class="flex-shrink-0"
                    onclick={() => {
                        queryStore.random_seed = randomSeed()
                        queryStore.sort = "random"
                        fetchAssets()
                    }}
                >
                    <Shuffle size={16} />
                </Button>
            </div>
        </div>

        {#if dataStore.tag_summary.length > 0}
            <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                    <span
                        class="text-[10px] uppercase tracking-widest text-muted-foreground"
                    >
                        Tags
                    </span>
                    <div class="flex items-center gap-1">
                        {#if hasFilters}
                            <button
                                class="text-[10px] text-muted-foreground hover:text-foreground"
                                onclick={clearAll}
                            >
                                clear
                            </button>
                        {/if}
                        <button
                            class="text-[10px] text-muted-foreground hover:text-foreground"
                            onclick={() => (expandTags = !expandTags)}
                        >
                            {expandTags ? "fewer" : "more"}
                        </button>
                    </div>
                </div>
                <div
                    class={cn(
                        "flex flex-wrap gap-1 overflow-clip",
                        !expandTags && "max-h-[104px]"
                    )}
                >
                    {#each expandTags
                        ? dataStore.tag_summary
                        : dataStore.tag_summary.slice(0, 12) as tag}
                        {@const active = dataStore.tags.includes(tag.tag.uuid)}
                        <TagBadge
                            label={tag.tag.label}
                            count={tag.count}
                            {active}
                            onclick={() => {
                                if (active) {
                                    dataStore.tags.splice(
                                        dataStore.tags.indexOf(tag.tag.uuid),
                                        1
                                    )
                                } else {
                                    dataStore.tags.push(tag.tag.uuid)
                                }
                                fetchAssets()
                            }}
                        />
                    {/each}
                </div>
                {#if isFreesoundSource}
                    <p class="text-[10px] leading-snug text-muted-foreground/70">
                        Counts come from the current page, not the whole library.
                    </p>
                {/if}
            </div>
        {/if}
    </div>
</aside>
