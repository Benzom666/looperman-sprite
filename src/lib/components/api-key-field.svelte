<script lang="ts">
    import { config, saveConfig } from "$lib/shared/config.svelte"
    import { setFreesoundApiKey } from "$lib/freesound/api"
    import { verifyFreesoundKey, type KeyCheck } from "$lib/freesound/verify"
    import { verifySpliceSource } from "$lib/splice/verify"
    import Input from "$lib/components/ui/input/input.svelte"
    import Button from "$lib/components/ui/button/button.svelte"
    import Label from "$lib/components/ui/label/label.svelte"
    import ExternalLink from "$lib/components/external-link.svelte"
    import { openUrl } from "@tauri-apps/plugin-opener"
    import { cn } from "$lib/utils"
    import Check from "lucide-svelte/icons/check"
    import Loader from "lucide-svelte/icons/loader-circle"
    import TriangleAlert from "lucide-svelte/icons/triangle-alert"
    import KeyRound from "lucide-svelte/icons/key-round"

    let {
        source = $bindable(),
        onvalid,
        compact = false,
    }: {
        source: "splice" | "freesound"
        onvalid?: () => void
        compact?: boolean
    } = $props()

    let key = $state("")
    let check = $state<KeyCheck>({ status: "idle" })
    let reveal = $state(false)

    const busy = $derived(check.status == "checking")

    const run = async () => {
        if (source == "freesound") {
            check = { status: "checking" }
            const result = await verifyFreesoundKey(key)
            check = result
            if (result.status == "valid") {
                config.freesound_api_key = key.trim()
                saveConfig()
                onvalid?.()
            }
        } else {
            check = { status: "checking" }
            const result = await verifySpliceSource()
            check = result
            if (result.status == "valid") onvalid?.()
        }
    }

    // Enter submits, which is what people try first.
    const onkeydown = (event: KeyboardEvent) => {
        if (event.key == "Enter" && key.trim()) run()
    }
</script>

<div class="flex flex-col gap-2">
    <Label for="apikey" class="flex items-center gap-1.5">
        <KeyRound size={14} class="text-signal" />
        {#if source == "freesound"}Freesound API key{:else}Check Splice{/if}
    </Label>

    {#if !compact}
        <p class="text-muted-foreground text-sm">
            {#if source == "freesound"}
                Sprite searches Freesound's library of Creative Commons samples.
                Get a free key from
                <ExternalLink to="https://freesound.org/apiv2/apply"
                    >freesound.org/apiv2/apply</ExternalLink
                >, then copy the
                <span class="font-medium text-foreground"
                    >Client secret / Api key</span
                > column.
            {:else}
                Splice needs no key. Sprite will check that the Splice API is
                reachable from this machine.
            {/if}
        </p>
    {/if}

    <div class="flex gap-2">
        {#if source == "freesound"}
            <div class="relative flex-1">
                <Input
                    id="apikey"
                    type={reveal ? "text" : "password"}
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="Paste your key"
                    bind:value={key}
                    {onkeydown}
                    class={cn(
                        "font-mono text-xs",
                        check.status == "valid" && "border-live",
                        check.status == "invalid" && "border-destructive"
                    )}
                />
                <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground"
                    onclick={() => (reveal = !reveal)}
                >
                    {reveal ? "hide" : "show"}
                </button>
            </div>
        {/if}
        <Button
            variant="outline"
            class="flex-shrink-0"
            disabled={busy || (source == "freesound" && !key.trim())}
            onclick={run}
        >
            {#if busy}
                <Loader class="animate-spin" />
                Checking
            {:else}
                Test {source == "freesound" ? "key" : "connection"}
            {/if}
        </Button>
    </div>

    {#if check.status == "valid"}
        <div class="flex items-center gap-1.5 text-sm text-live">
            <Check size={15} />
            {#if source == "freesound"}Key works. You can search Freesound now.{:else}Splice
                is reachable.{/if}
        </div>
    {:else if check.status == "invalid"}
        <div class="flex items-start gap-1.5 text-sm text-destructive">
            <TriangleAlert size={15} class="mt-0.5 shrink-0" />
            <span>{check.message}</span>
        </div>
    {/if}

    {#if source == "freesound" && !compact}
        <p class="text-muted-foreground text-xs">
            The key is stored in Sprite's config file on this machine and is sent
            only to Freesound as an authorization header.
        </p>
    {/if}
</div>
