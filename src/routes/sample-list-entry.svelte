<script lang="ts">
    import { globalAudio } from "$lib/shared/audio.svelte"
    import PackPreview from "$lib/components/pack-preview.svelte"
    import TagBadge from "$lib/components/tag-badge.svelte"
    import Waveform from "$lib/components/waveform.svelte"
    import type { SampleAsset } from "$lib/splice/types"
    import CircleX from "lucide-svelte/icons/circle-x"
    import Pause from "lucide-svelte/icons/pause"
    import Play from "lucide-svelte/icons/play"
    import Button from "$lib/components/ui/button/button.svelte"
    import * as Tooltip from "$lib/components/ui/tooltip/index.js"
    import LoaderCircle from "lucide-svelte/icons/loader-circle"
    import { dataStore, fetchAssets } from "$lib/shared/store.svelte"
    import { cn, formatKey, isFreesound, isLooperman } from "$lib/utils"
    import { loading } from "$lib/shared/loading.svelte"
    import { assetIcons } from "$lib/shared/icons.svelte"
    import { handleSampleDrag } from "$lib/shared/drag.svelte"

    let {
        class: className,
        selected,
        playing,
        sampleAsset,
    }: {
        class?: string
        selected: boolean
        playing: boolean
        sampleAsset: SampleAsset
    } = $props()

    let playButtonRef = $state<HTMLButtonElement>(null!)

    $effect(() => {
        if (selected) {
            playButtonRef.focus({ preventScroll: true })
        }
    })

    const pack = $derived(sampleAsset.parents.items[0])
    const name = $derived(sampleAsset.name.split("/").slice(-1))

    const millisToMinutesAndSeconds = (millis: number) => {
        var minutes = Math.floor(millis / 60000)
        var seconds = Math.floor((millis % 60000) / 1000)
        return minutes + ":" + (seconds < 10 ? "0" : "") + seconds
    }
</script>

<div
    class={cn(
        "group flex items-stretch rounded-md transition-colors",
        selected ? "bg-live/10" : "hover:bg-muted/50",
        className
    )}
>
    <!-- Signal strip: a 2px state indicator, amber when idle, teal when sounding -->
    <div
        class={cn(
            "w-[2px] shrink-0 rounded-full my-1.5 transition-colors",
            selected && playing ? "bg-live" : "bg-transparent"
        )}
    ></div>

    <button
        class="flex flex-1 min-w-0 gap-3 items-center py-1.5 pr-2 text-left focus:outline-none cursor-grab"
        id={`sample-list-entry-${sampleAsset.uuid}`}
        draggable="true"
        tabindex="-1"
        onmousedown={() => globalAudio.selectSampleAsset(sampleAsset, false)}
        ondragstart={(event) => handleSampleDrag(event, sampleAsset)}
    >
        <PackPreview {pack} />
        <Button
            variant="ghost"
            bind:ref={playButtonRef}
            class="group/play flex-shrink-0 focus:outline-none"
            size="icon-lg"
            onclick={() =>
                playing
                    ? globalAudio.ref.pause()
                    : globalAudio.playSampleAsset(sampleAsset)}
        >
            {#if (selected && globalAudio.loading) || (loading.samplesCount && loading.samples.has(sampleAsset.uuid))}
                <LoaderCircle class="animate-spin" />
            {:else if playing}
                <Pause class="text-live" />
            {:else}
                <Play class="group-hover/play:block hidden" />
                {#if sampleAsset.asset_category_slug in assetIcons}
                    {@const Icon = assetIcons[sampleAsset.asset_category_slug]}
                    <Icon
                        class={cn(
                            "group-hover/play:hidden",
                            selected ? "text-signal" : "text-muted-foreground"
                        )}
                    />
                {:else}
                    <CircleX
                        class={cn(
                            "group-hover/play:hidden",
                            selected ? "text-signal" : "text-muted-foreground"
                        )}
                    />
                {/if}
            {/if}
        </Button>

        <div class="min-w-32 flex-[3_1_auto] overflow-clip">
            <div
                class={cn(
                    "relative after:content-[''] after:absolute after:inset-y-0 after:right-0 after:w-4 after:pointer-events-none",
                    selected
                        ? "after:bg-gradient-to-r after:from-transparent after:to-live/10"
                        : "after:bg-gradient-to-r after:from-transparent after:to-background"
                )}
            >
                <Tooltip.Provider>
                    <Tooltip.Root>
                        <Tooltip.Trigger
                            class="overflow-clip text-nowrap cursor-grab font-mono text-[13px]"
                        >
                            {name}
                        </Tooltip.Trigger>
                        <Tooltip.Content class="font-mono text-xs">
                            {name}
                        </Tooltip.Content>
                    </Tooltip.Root>
                </Tooltip.Provider>
                <div
                    class="flex gap-0.5 text-xs overflow-clip text-nowrap text-muted-foreground"
                >
                    {#each sampleAsset.tags.slice(0, 6) as tag}
                        {@const active = dataStore.tags.includes(tag.uuid)}
                        <TagBadge
                            label={tag.label}
                            variant="ghost"
                            class="px-1 py-0.5 h-auto"
                            count={0}
                            onclick={() => {
                                if (!active) {
                                    dataStore.tags.push(tag.uuid)
                                    fetchAssets()
                                }
                            }}
                        />
                    {/each}
                </div>
            </div>
        </div>

        <Waveform
            src={sampleAsset.files[1].url}
            format={isFreesound(sampleAsset) || isLooperman(sampleAsset)
                ? "image"
                : "json"}
            progress={selected ? globalAudio.progress() : 0}
            onseek={(progress) => {
                const startTime = progress * (sampleAsset.duration / 1000)
                globalAudio.playSampleAsset(sampleAsset, startTime)
            }}
            class="min-w-32 w-[150px] h-10 flex-grow hidden lg:block shrink-0"
        />

        <div
            class="text-muted-foreground flex-shrink-0 w-14 flex-grow font-mono text-xs"
        >
            {millisToMinutesAndSeconds(sampleAsset.duration)}
        </div>
        <div
            class="text-muted-foreground flex-shrink-0 w-14 flex-grow font-mono text-xs"
        >
            {(sampleAsset.key &&
                formatKey(sampleAsset.key, sampleAsset.chord_type)) ??
                "--"}
        </div>
        <div
            class="text-muted-foreground flex-shrink-0 w-14 flex-grow font-mono text-xs"
        >
            {sampleAsset.bpm ?? "--"}
        </div>
    </button>
</div>
