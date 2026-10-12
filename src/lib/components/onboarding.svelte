<script lang="ts">
    import { onMount } from "svelte"
    import { homeDir, join } from "@tauri-apps/api/path"
    import { exists, mkdir } from "@tauri-apps/plugin-fs"
    import {
        config,
        saveConfig,
        isSamplesDirValid,
        validateSamplesDir,
    } from "$lib/shared/config.svelte"
    import { setActiveSource, fetchAssets } from "$lib/shared/store.svelte"
    import ApiKeyField from "$lib/components/api-key-field.svelte"
    import Button from "$lib/components/ui/button/button.svelte"
    import Input from "$lib/components/ui/input/input.svelte"
    import Label from "$lib/components/ui/label/label.svelte"
    import { open as openDialog } from "@tauri-apps/plugin-dialog"
    import { cn } from "$lib/utils"
    import ArrowRight from "lucide-svelte/icons/arrow-right"
    import ArrowLeft from "lucide-svelte/icons/arrow-left"
    import FolderOpen from "lucide-svelte/icons/folder-open"
    import TriangleAlert from "lucide-svelte/icons/triangle-alert"
    import type { SampleSource } from "$lib/splice/types"

    const STEPS = ["Folder", "Library", "Access"] as const

    const LIBRARIES: {
        id: SampleSource
        title: string
        body: string
    }[] = [
        {
            id: "looperman",
            title: "Looperman",
            body: "Free community loops with key and BPM on every upload. No key needed to search; add your login for full-quality WAVs.",
        },
        {
            id: "freesound",
            title: "Freesound",
            body: "736,000+ Creative Commons samples. Free, and the only one that works without a Splice subscription.",
        },
        {
            id: "splice",
            title: "Splice",
            body: "The Splice catalogue. No key needed, but their API sits behind a bot check and often refuses direct requests.",
        },
    ]

    let step = $state(0)
    let source = $state<SampleSource>("looperman")
    let dirValid = $state(false)
    let dirTouched = $state(false)
    let keyOk = $state(false)

    // Suggest a folder in Documents (visible in Finder, not a system folder that
    // gets cleaned) and create it, so the first run is never a dead end.
    // Looperman and Splice need no key to start searching: Looperman only
    // asks for a login when you want full-quality WAVs instead of previews.
    const keyNeedsCheck = (value: SampleSource) => value == "freesound"

    // A Looperman login is optional, so leaving the Access step is always
    // allowed for sources without a mandatory key.
    $effect(() => {
        if (!keyNeedsCheck(source)) keyOk = true
    })

    onMount(async () => {
        dirValid = isSamplesDirValid()
        if (config.samples_dir) {
            source = config.active_source
            keyOk =
                !keyNeedsCheck(config.active_source) ||
                !!config.freesound_api_key
            return
        }
        const suggestion = await join(await homeDir(), "Documents", "Sprite")
        if (!(await exists(suggestion))) {
            await mkdir(suggestion, { recursive: true }).catch(() => {})
        }
        config.samples_dir = suggestion
        await validateSamplesDir()
        dirValid = isSamplesDirValid()
    })

    const pickFolder = async () => {
        const path = await openDialog({ multiple: false, directory: true })
        if (path) {
            config.samples_dir = path
            await validateSamplesDir()
            dirValid = isSamplesDirValid()
            dirTouched = true
        }
    }

    // Typing a path the user has not created yet should still work if we make it.
    const ensureFolder = async () => {
        dirTouched = true
        if (config.samples_dir && !(await exists(config.samples_dir))) {
            await mkdir(config.samples_dir, { recursive: true }).catch(() => {})
        }
        await validateSamplesDir()
        dirValid = isSamplesDirValid()
    }

    const canAdvance = $derived(
        step == 0 ? dirValid : step == 1 ? true : keyOk
    )

    const finish = () => {
        config.active_source = source
        config.setup_complete = true
        saveConfig()
        setActiveSource(source)
        // A same-source switch is a no-op, so kick off the first search here.
        if (config.active_source == source) fetchAssets()
    }
</script>

<div class="fixed inset-0 z-50 bg-background flex">
    <div class="flex-1 flex flex-col justify-center px-12 max-w-2xl">
        <!-- Step rail: setup is a real sequence, so numbering carries meaning -->
        <div class="flex items-center gap-2 mb-10">
            {#each STEPS as label, index}
                <div class="flex items-center gap-2">
                    <div
                        class={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] transition-colors",
                            index < step && "bg-signal text-signal-foreground",
                            index == step && "bg-live text-live-foreground",
                            index > step && "bg-muted text-muted-foreground"
                        )}
                    >
                        {index + 1}
                    </div>
                    <span
                        class={cn(
                            "text-xs uppercase tracking-widest",
                            index == step
                                ? "text-foreground"
                                : "text-muted-foreground"
                        )}
                    >
                        {label}
                    </span>
                </div>
                {#if index < STEPS.length - 1}
                    <div class="w-8 h-px bg-border"></div>
                {/if}
            {/each}
        </div>

        {#key step}
            <div class="flex flex-col gap-4">
                {#if step == 0}
                    <div class="flex flex-col gap-2">
                        <Label for="dir">Where should samples go?</Label>
                        <p class="text-muted-foreground text-sm">
                            Dragging a sample into your DAW saves a 16-bit WAV
                            here. Pick any folder you like.
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <Input
                            id="dir"
                            class={cn(
                                "font-mono text-xs",
                                !dirValid && dirTouched && "border-destructive"
                            )}
                            bind:value={config.samples_dir}
                            onblur={ensureFolder}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            class="flex-shrink-0"
                            onclick={pickFolder}
                        >
                            <FolderOpen />
                        </Button>
                    </div>
                    {#if !dirValid}
                        <div
                            class="flex items-center gap-1.5 text-sm text-warn"
                        >
                            <TriangleAlert size={15} />
                            Could not use that folder. Pick another one, or create
                            it in Finder first.
                        </div>
                    {/if}
                {:else if step == 1}
                    <div class="flex flex-col gap-2">
                        <Label>Which library?</Label>
                        <p class="text-muted-foreground text-sm">
                            You can switch at any time from the sidebar.
                        </p>
                    </div>
                    <div class="flex flex-col gap-2">
                        {#each LIBRARIES as option}
                            <button
                                class={cn(
                                    "text-left px-4 py-3 rounded-md border transition-colors",
                                    source == option.id
                                        ? "border-live bg-live/10"
                                        : "border-border hover:border-muted-foreground/40 hover:bg-muted/50"
                                )}
                                onclick={() => (source = option.id)}
                            >
                                <div class="font-medium">{option.title}</div>
                                <div
                                    class="text-muted-foreground text-sm mt-0.5"
                                >
                                    {option.body}
                                </div>
                            </button>
                        {/each}
                    </div>
                {:else}
                    <ApiKeyField
                        bind:source
                        onvalid={() => (keyOk = true)}
                    />
                {/if}
            </div>
        {/key}

        <div class="flex justify-between items-center mt-10">
            <Button
                variant="ghost"
                disabled={step == 0}
                onclick={() => step--}
            >
                <ArrowLeft size={16} />
                Back
            </Button>
            {#if step < STEPS.length - 1}
                <Button disabled={!canAdvance} onclick={() => step++}>
                    {step == 1 ? "Next" : "Continue"}
                    <ArrowRight size={16} />
                </Button>
            {:else}
                <div class="flex gap-2 items-center">
                    {#if source == "freesound" && !keyOk}
                        <!-- The Freesound key is optional: skip and add it
                        later in Settings, or search another library. -->
                        <Button variant="ghost" onclick={finish}>
                            Skip for now
                        </Button>
                    {/if}
                    <Button disabled={!canAdvance} onclick={finish}>
                        Start searching
                        <ArrowRight size={16} />
                    </Button>
                </div>
            {/if}
        </div>
    </div>

    <!-- Right half: state the product plainly rather than decorating it -->
    <div
        class="hidden md:flex flex-1 items-center justify-center border-l border-border bg-panel"
    >
        <div class="max-w-xs px-8">
            <div class="text-5xl font-semibold tracking-tight">Sprite</div>
            <p class="text-muted-foreground mt-3 leading-relaxed">
                Search a free sample library, audition anything with the
                keyboard, and drag it straight into your DAW. No subscription,
                no account.
            </p>
            <div class="mt-6 flex flex-col gap-1.5 font-mono text-xs text-muted-foreground">
                <div class="flex gap-2">
                    <span class="text-signal w-8 shrink-0">space</span>
                    <span>play / pause</span>
                </div>
                <div class="flex gap-2">
                    <span class="text-signal w-8 shrink-0">&uarr; &darr;</span>
                    <span>previous / next</span>
                </div>
            </div>
        </div>
    </div>
</div>
