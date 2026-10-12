<script lang="ts">
    import { config, saveConfig } from "$lib/shared/config.svelte"
    import { setFreesoundApiKey } from "$lib/freesound/api"
    import { verifyFreesoundKey, type KeyCheck } from "$lib/freesound/verify"
    import { verifySpliceSource } from "$lib/splice/verify"
    import { verifyLooperman } from "$lib/looperman/api"
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
        source: "splice" | "freesound" | "looperman"
        onvalid?: () => void
        compact?: boolean
    } = $props()

    let key = $state("")
    let email = $state("")
    let password = $state("")
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
        } else if (source == "looperman") {
            check = { status: "checking" }
            const result = await verifyLooperman(email, password)
            check = result
            if (result.status == "valid") {
                config.looperman_email = email.trim()
                config.looperman_password = password
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

    const onkeydownLogin = (event: KeyboardEvent) => {
        if (event.key == "Enter" && email.trim() && password) run()
    }
</script>

<div class="flex flex-col gap-2">
    <Label for="apikey" class="flex items-center gap-1.5">
        <KeyRound size={14} class="text-signal" />
        {#if source == "freesound"}Freesound API key{:else if source == "looperman"}Looperman login{:else}Check Splice{/if}
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
            {:else if source == "looperman"}
                Sprite searches Looperman's free loops. Searching and previews
                need no account, but saving full-quality WAVs does — log in
                with your Looperman account from
                <ExternalLink to="https://www.looperman.com/account/login"
                    >looperman.com</ExternalLink
                >.
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
        {:else if source == "looperman"}
            <div class="flex flex-col gap-2 flex-1">
                <Input
                    id="loopemail"
                    type="email"
                    autocomplete="email"
                    spellcheck="false"
                    placeholder="Looperman email"
                    bind:value={email}
                    onkeydown={onkeydownLogin}
                    class={cn(
                        "font-mono text-xs",
                        check.status == "valid" && "border-live",
                        check.status == "invalid" && "border-destructive"
                    )}
                />
                <div class="relative">
                    <Input
                        id="looppass"
                        type={reveal ? "text" : "password"}
                        autocomplete="current-password"
                        spellcheck="false"
                        placeholder="Looperman password"
                        bind:value={password}
                        onkeydown={onkeydownLogin}
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
            </div>
        {/if}
        <Button
            variant="outline"
            class="flex-shrink-0"
            disabled={busy ||
                (source == "freesound" && !key.trim()) ||
                (source == "looperman" && (!email.trim() || !password))}
            onclick={run}
        >
            {#if busy}
                <Loader class="animate-spin" />
                Checking
            {:else}
                Test {source == "freesound" ? "key" : source == "looperman" ? "login" : "connection"}
            {/if}
        </Button>
    </div>

    {#if check.status == "valid"}
        <div class="flex items-center gap-1.5 text-sm text-live">
            <Check size={15} />
            {#if source == "freesound"}Key works. You can search Freesound now.{:else if source == "looperman"}Login works. WAV downloads are on.{:else}Splice
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
    {:else if source == "looperman" && !compact}
        <p class="text-muted-foreground text-xs">
            The login is stored in Sprite's config file on this machine and is
            sent only to looperman.com. Without it, Sprite still searches
            Looperman but saves preview MP3s instead of WAVs.
        </p>
    {/if}
</div>
