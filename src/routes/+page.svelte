<script lang="ts">
    import SampleListEntry from "./sample-list-entry.svelte"
    import SearchInput from "$lib/components/search-input.svelte"
    import { ScrollArea } from "$lib/components/ui/scroll-area"
    import { onMount, tick } from "svelte"
    import SettingsDialog from "$lib/components/settings-dialog.svelte"
    import FilterRail from "$lib/components/filter-rail.svelte"
    import LevelMeter from "$lib/components/level-meter.svelte"
    import Onboarding from "$lib/components/onboarding.svelte"
    import Button from "$lib/components/ui/button/button.svelte"
    import Separator from "$lib/components/ui/separator/separator.svelte"
    import SortHeader from "$lib/components/sort-header.svelte"
    import AudioPlayer from "$lib/components/audio-player.svelte"
    import { globalAudio } from "$lib/shared/audio.svelte"
    import type { AssetSortType } from "$lib/splice/types"
    import { loading } from "$lib/shared/loading.svelte"
    import {
        dataStore,
        storeCallbacks,
        queryStore,
        fetchAssets,
        DEFAULT_SORT,
    } from "$lib/shared/store.svelte"
    import { config, configLoaded } from "$lib/shared/config.svelte"
    import { cn } from "$lib/utils"
    import Search from "lucide-svelte/icons/search"
    import Smile from "lucide-svelte/icons/smile"
    import Ghost from "lucide-svelte/icons/ghost"
    import Settings from "lucide-svelte/icons/settings"
    import { setActiveSource } from "$lib/shared/store.svelte"

    const isFreesoundSource = $derived(config.active_source == "freesound")
    const isLoopermanSource = $derived(config.active_source == "looperman")
    // Neither API library can order by filename or key; both fall back to
    // relevance. Splice is the only source with real name/key sorting.
    const sortLimited = $derived(isFreesoundSource || isLoopermanSource)

    $effect(() => {
        if (
            queryStore.sort in ["random", "popularity", "relevance", "recency"]
        ) {
            queryStore.order = "DESC"
        }
    })

    let viewportRef = $state<HTMLElement>(null!)
    let searchInputRef = $state<HTMLInputElement>(null!)

    const selectedSampleIndex = $derived(
        dataStore.sampleAssets.findIndex(
            (sampleAsset) => sampleAsset.uuid == globalAudio.currentAsset?.uuid
        )
    )

    const updateSort = (newSort: AssetSortType) => {
        if (queryStore.sort == newSort) {
            if (queryStore.order == "DESC") {
                queryStore.order = "ASC"
            } else {
                queryStore.sort = DEFAULT_SORT
            }
        } else {
            queryStore.sort = newSort
            queryStore.order = "DESC"
        }
        fetchAssets()
    }

    const step = (delta: number) => {        const currentIndex = dataStore.sampleAssets.findIndex(
            (asset) => asset.uuid === globalAudio.currentAsset?.uuid
        )
        const nextIndex = currentIndex + delta
        if (nextIndex < 0 || nextIndex >= dataStore.sampleAssets.length) return
        const sampleAsset = dataStore.sampleAssets[nextIndex]
        globalAudio.playSampleAsset(sampleAsset)
        document
            .getElementById(`sample-list-entry-${sampleAsset.uuid}`)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }

    // Pagination is append-only: the next page loads on scroll or via the
    // footer button, and a failed page rolls back so the retry re-requests
    // the same page instead of skipping it.
    const loadMore = () => {
        if (loading.assets) return
        if (
            dataStore.sampleAssets.length >= dataStore.total_records ||
            dataStore.total_records == 0
        )
            return
        queryStore.page += 1
        fetchAssets()
    }

    storeCallbacks.onbeforedataupdate = () => {
        viewportRef.scrollTo({ top: 0, behavior: "smooth" })
    }
    storeCallbacks.onbeforetagsupdate = () => {}

    onMount(() => {
        viewportRef.addEventListener("scroll", () => {
            if (
                viewportRef.scrollTop + viewportRef.clientHeight >=
                viewportRef.scrollHeight - viewportRef.clientHeight
            ) {
                loadMore()
            }
        })

        // The layout's onMount (and therefore loadConfig) runs after ours, so
        // the first search has to wait or it would query the default source.
        configLoaded.then(() => {
            if (config.setup_complete) {
                searchInputRef.focus()
                fetchAssets()
            }
        })
    })
</script>

{#if !config.setup_complete}
    <Onboarding />
{:else}
    <div class="flex size-full">
        <FilterRail />

        <main class="flex flex-col size-full min-w-0">
            <header
                class="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0"
            >
                <SettingsDialog />
                <div class="flex items-baseline gap-2 select-none">
                    <span class="font-semibold tracking-tight">Sprite</span>
                </div>
                <SearchInput
                    bind:value={queryStore.query}
                    onsubmit={fetchAssets}
                    class="flex-1 min-w-0"
                    bind:inputRef={searchInputRef}
                />
                <div class="flex items-center gap-3 shrink-0">
                    <LevelMeter />
                    <span
                        class="font-mono text-xs text-muted-foreground tabular-nums"
                    >
                        {dataStore.total_records.toLocaleString()}
                    </span>
                </div>
            </header>

            <div
                class="flex gap-3 items-center justify-between px-4 py-1.5 text-xs text-muted-foreground shrink-0"
            >
                <span>
                    {isLoopermanSource
                        ? "Looperman · Free loops"
                        : isFreesoundSource
                          ? "Freesound · Creative Commons"
                          : "Splice"}
                </span>
                {#if loading.assets}
                    <span class="text-signal">searching…</span>
                {/if}
            </div>

            <div
                class="flex gap-2 items-center justify-between overflow-clip px-4 py-1 shrink-0"
            >
                <div
                    class="w-12 flex-shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground"
                >
                    {isFreesoundSource || isLoopermanSource ? "Src" : "Pack"}
                </div>
                <SortHeader
                    value="name"
                    label="Filename"
                    sort={queryStore.sort}
                    order={queryStore.order}
                    onsort={updateSort}
                    disabled={sortLimited}
                    disabledReason="This library cannot sort by filename"
                    class="min-w-32 w-96 flex-[3_1_auto]"
                />
                <SortHeader
                    value="duration"
                    label="Time"
                    sort={queryStore.sort}
                    order={queryStore.order}
                    onsort={updateSort}
                    class="flex-shrink-0 w-14 flex-grow"
                />
                <SortHeader
                    value="key"
                    label="Key"
                    sort={queryStore.sort}
                    order={queryStore.order}
                    onsort={updateSort}
                    disabled={sortLimited}
                    disabledReason="This library cannot sort by key"
                    class="flex-shrink-0 w-14 flex-grow"
                />
                <SortHeader
                    value="bpm"
                    label="BPM"
                    sort={queryStore.sort}
                    order={queryStore.order}
                    onsort={updateSort}
                    class="flex-shrink-0 w-14 flex-grow"
                />
            </div>

            <Separator />

            <ScrollArea
                class="px-4 flex-grow"
                bind:viewportRef
                onkeydown={(e) => {
                    switch (e.key) {
                        case "ArrowUp":
                            e.preventDefault()
                            step(-1)
                            break
                        case "ArrowDown":
                            e.preventDefault()
                            step(1)
                            break
                        case "ArrowLeft":
                            e.preventDefault()
                            step(-1)
                            break
                        case "ArrowRight":
                            e.preventDefault()
                            step(1)
                            break
                        case " ":
                            e.preventDefault()
                            globalAudio.togglePlay()
                            break
                    }
                }}
            >
                <div class="flex flex-col py-1 size-full">
                    {#each dataStore.sampleAssets as sampleAsset, index}
                        {@const selected =
                            globalAudio.currentAsset?.uuid ==
                            sampleAsset.uuid}
                        <SampleListEntry
                            {sampleAsset}
                            {selected}
                            playing={selected && !globalAudio.paused}
                        />
                        {#if index < dataStore.sampleAssets.length - 1}
                            <div class={selected ? "px-2" : ""}>
                                <Separator />
                            </div>
                        {/if}
                    {:else}
                        <div
                            class="flex flex-col gap-3 justify-center items-center size-full text-muted-foreground"
                        >
                            {#if loading.fetchError}
                                <Ghost size={40} />
                                <p class="font-medium text-foreground">
                                    Couldn't load samples
                                </p>
                                <p
                                    class="text-sm max-w-md text-center break-words"
                                >
                                    {loading.fetchError.message}
                                </p>
                                <Button onclick={fetchAssets}>Try again</Button>
                            {:else if loading.beforeFirstLoad}
                                <Smile size={40} />
                                <p class="font-medium text-foreground">
                                    Ready when you are
                                </p>
                                <p class="text-sm">
                                    Type something above, or hit shuffle.
                                </p>
                            {:else}
                                <Search size={40} />
                                <p class="font-medium text-foreground">
                                    Nothing matched
                                </p>
                                <p class="text-sm">
                                    Try a broader search, or clear the filters in
                                    the sidebar.
                                </p>
                            {/if}
                        </div>
                    {/each}
                </div>
            </ScrollArea>

            {#if dataStore.sampleAssets.length > 0}
                <div
                    class="flex gap-3 items-center justify-center px-4 py-2 text-xs text-muted-foreground shrink-0"
                >
                    <span>
                        Showing {dataStore.sampleAssets.length} of {dataStore.total_records.toLocaleString()}
                    </span>
                    {#if dataStore.sampleAssets.length < dataStore.total_records}
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={loading.assets}
                            onclick={loadMore}
                        >
                            {loading.assets ? "Loading…" : "Load more"}
                        </Button>
                    {/if}
                </div>
            {/if}
            {#if loading.fetchError && dataStore.sampleAssets.length > 0}
                <div
                    class="flex gap-2 items-center justify-center px-4 pb-2 text-xs text-destructive shrink-0"
                >
                    <span>Couldn't load more{loading.fetchError.message ? `: ${loading.fetchError.message}` : ""}</span>
                    <Button variant="outline" size="sm" onclick={loadMore}>
                        Retry
                    </Button>
                </div>
            {/if}

            <AudioPlayer onprev={() => step(-1)} onnext={() => step(1)} />
        </main>
    </div>
{/if}
