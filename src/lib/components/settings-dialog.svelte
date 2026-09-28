<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog"
    import Settings from "lucide-svelte/icons/settings"
    import { buttonVariants } from "$lib/components/ui/button/index.js"
    import { cn } from "$lib/utils"
    import ExternalLink from "$lib/components/external-link.svelte"
    import Input from "$lib/components/ui/input/input.svelte"
    import Button from "$lib/components/ui/button/button.svelte"
    import FolderOpen from "lucide-svelte/icons/folder-open"
    import TriangleAlert from "lucide-svelte/icons/triangle-alert"
    import Undo2 from "lucide-svelte/icons/undo-2"
    import Label from "$lib/components/ui/label/label.svelte"
    import {
        config,
        isSamplesDirValid,
        saveConfig,
        settingsDialog,
        updateTheme,
    } from "$lib/shared/config.svelte"
    import Slider from "$lib/components/ui/slider/slider.svelte"
    import { open as openDialog } from "@tauri-apps/plugin-dialog"
    import ThemeSelect from "./theme-select.svelte"
    import Switch from "$lib/components/ui/switch/switch.svelte"
    import ApiKeyField from "$lib/components/api-key-field.svelte"
    import Separator from "$lib/components/ui/separator/separator.svelte"
    import type { SampleSource } from "$lib/splice/types"

    let flashbangAudio = $state<HTMLAudioElement>(null!)

    // The key field edits a local draft so we only persist on a successful test.
    let keySource = $state<SampleSource>(
        config.active_source == "freesound" ? "freesound" : "splice"
    )
</script>

<Dialog.Root bind:open={settingsDialog.open}>
    <Dialog.Trigger
        class={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "text-muted-foreground flex-shrink-0"
        )}><Settings /></Dialog.Trigger
    >
    <Dialog.Content class="max-w-lg">
        <Dialog.Header>
            <Dialog.Title>Settings</Dialog.Title>
        </Dialog.Header>
        <div class="flex flex-col gap-5 py-2 max-h-[65vh] overflow-y-auto pr-1">
            <div class="flex flex-col gap-2">
                <Label for="fileInput">Samples folder</Label>
                <p class="text-muted-foreground text-sm">
                    Dragging a sample into your DAW saves a 16-bit WAV here.
                </p>
                <div class="flex gap-2">
                    <Input
                        id="fileInput"
                        type="text"
                        class={cn(
                            "font-mono text-xs",
                            isSamplesDirValid() ? "" : "border-warn"
                        )}
                        bind:value={config.samples_dir}
                        oninput={saveConfig}
                    />
                    <Button
                        class="flex-shrink-0"
                        size="icon"
                        variant="outline"
                        onclick={() => {
                            openDialog({ multiple: false, directory: true })
                                .then((path) => {
                                    if (path) {
                                        config.samples_dir = path
                                        saveConfig()
                                    }
                                })
                        }}><FolderOpen /></Button
                    >
                </div>
                <div
                    class={cn(
                        "flex gap-2 items-center text-warn text-sm",
                        isSamplesDirValid() && "opacity-0"
                    )}
                >
                    <TriangleAlert size="16" />
                    That folder does not exist.
                </div>
            </div>

            <Separator />

            <ApiKeyField bind:source={keySource} onvalid={saveConfig} compact />

            <Separator />

            <div class="flex flex-col gap-2">
                <Label for="themeSelect">Theme</Label>
                <div class="flex gap-2">
                    <ThemeSelect
                        bind:value={config.ui_theme}
                        onselect={() => {
                            if (config.ui_theme == "light")
                                flashbangAudio.play()
                            updateTheme()
                            saveConfig()
                        }}
                    />
                    <audio
                        bind:this={flashbangAudio}
                        src="/flashbang.mp3"
                        preload="auto"
                    ></audio>
                </div>
            </div>

            <div class="flex flex-col gap-2">
                <Label for="uiScaleSlider">Interface scale</Label>
                <div class="flex gap-4">
                    <Slider
                        id="uiScaleSlider"
                        min={0.5}
                        max={2}
                        step={0.1}
                        type="single"
                        bind:value={config.ui_scale}
                        onValueCommit={saveConfig}
                    />
                    <Button
                        class="flex-shrink-0"
                        size="icon"
                        variant="outline"
                        onclick={() => {
                            config.ui_scale = 1
                            saveConfig()
                        }}
                    >
                        <Undo2 />
                    </Button>
                </div>
            </div>

            <div class="flex flex-col gap-2">
                <Label for="mp3DelayToggle">MP3 delay correction</Label>
                <p class="text-muted-foreground text-sm">
                    Cut 12ms from the start of saved files to correct for
                    encoder delay.
                </p>
                <div class="flex items-center gap-2">
                    <Switch
                        id="mp3DelayToggle"
                        bind:checked={config.cut_mp3_delay}
                        onchange={() => {
                            config.cut_mp3_delay = !config.cut_mp3_delay
                            saveConfig()
                        }}
                    />
                    <Label for="mp3DelayToggle" class="cursor-pointer">
                        {config.cut_mp3_delay ? "Enabled" : "Disabled"}
                    </Label>
                </div>
            </div>

            <div class="flex flex-col gap-2">
                <Label for="repeatAudioToggle">Loop long samples</Label>
                <p class="text-muted-foreground text-sm">
                    Repeat playback for sounds detected as loops.
                </p>
                <div class="flex items-center gap-2">
                    <Switch
                        id="repeatAudioToggle"
                        bind:checked={config.repeat_audio}
                        onchange={() => {
                            config.repeat_audio = !config.repeat_audio
                            saveConfig()
                        }}
                    />
                    <Label for="repeatAudioToggle" class="cursor-pointer">
                        {config.repeat_audio ? "Enabled" : "Disabled"}
                    </Label>
                </div>
            </div>
        </div>
        <Dialog.Footer
            class="text-muted-foreground text-xs flex-col items-start gap-2"
        >
            <div class="flex items-center gap-2">
                <span>Built on</span>
                <ExternalLink
                    to="https://github.com/Robert-K/splicerr"
                    class="text-foreground underline underline-offset-2"
                    >Splicerr</ExternalLink
                ><span>by</span>
                <ExternalLink
                    to="https://github.com/Robert-K"
                    class="text-foreground underline underline-offset-2"
                    >Kosro</ExternalLink
                ><span>, after</span>
                <ExternalLink
                    to="https://github.com/ascpixi/splicedd"
                    class="text-foreground underline underline-offset-2"
                    >Splicedd</ExternalLink
                ><span>by ascpixi.</span>
            </div>
            <div class="flex items-center gap-2">
                <span>MIT licensed. Freesound samples keep their own licenses.</span>
            </div>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
