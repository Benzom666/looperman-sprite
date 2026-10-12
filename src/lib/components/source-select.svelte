<script lang="ts">
    import * as Select from "$lib/components/ui/select/index"
    import { config } from "$lib/shared/config.svelte"
    import { setActiveSource } from "$lib/shared/store.svelte"
    import type { SampleSource } from "$lib/splice/types"
    import TriangleAlert from "lucide-svelte/icons/triangle-alert"

    let { class: className }: { class?: string } = $props()

    const options: { value: SampleSource; label: string }[] = [
        { value: "splice", label: "Splice" },
        { value: "freesound", label: "Freesound" },
        { value: "looperman", label: "Looperman" },
    ]

    const missingKey = $derived(
        (config.active_source == "freesound" && !config.freesound_api_key) ||
            (config.active_source == "looperman" &&
                (!config.looperman_email || !config.looperman_password))
    )
</script>

<div class="flex flex-col gap-1">
    <Select.Root
        type="single"
        value={config.active_source}
        onValueChange={(value) => setActiveSource(value as SampleSource)}
    >
        <Select.Trigger class={className ?? "w-[140px]"}>
            {options.find((option) => option.value == config.active_source)
                ?.label ?? "Source..."}
        </Select.Trigger>
        <Select.Content>
            <Select.Group>
                <Select.GroupHeading
                    class="text-xs text-muted-foreground font-normal"
                    >Sample source</Select.GroupHeading
                >
                {#each options as option}
                    <Select.Item value={option.value} label={option.label}
                        >{option.label}</Select.Item
                    >
                {/each}
            </Select.Group>
        </Select.Content>
    </Select.Root>
    {#if missingKey}
        <div
            class="flex gap-1 items-center text-warn text-xs whitespace-nowrap"
        >
            <TriangleAlert size="12" />
            {config.active_source == "looperman"
                ? "Add Looperman login in Settings for WAVs"
                : "Add a Freesound API key in Settings"}
        </div>
    {/if}
</div>
