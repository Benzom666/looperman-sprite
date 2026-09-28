<script lang="ts">
    import { loading } from "$lib/shared/loading.svelte"
    import { uid } from "$lib/shared/uid"
    import { fetch } from "@tauri-apps/plugin-http"
    import pako from "pako"
    import { inview } from "svelte-inview"
    import { cn } from "$lib/utils"

    const key = `progress-gradient-${uid()}`

    let ref = null! as HTMLButtonElement

    let {
        src,
        progress = 0,
        class: className,
        onseek,
        // Splice serves a JSON array of 800 normalized peaks. Freesound only
        // serves a rendered PNG, which we mask into the same visual language.
        format = "json",
    }: {
        src: string
        progress?: number
        class?: string
        onseek: (progress: number) => void
        format?: "json" | "image"
    } = $props()

    let waveform = $state<number[]>(new Array(800).fill(0))

    let loadedSrc = $state("")

    let isLoading = $state(false)

    let isInView = $state(true)

    let imageFailed = $state(false)

    const loaded = $derived(loadedSrc == src)

    $effect(() => {
        if (!isLoading && !loaded && !loading.fetchError && format == "json") {
            fetchWaveform()
        }
    })

    // Image waveforms are fetched by the browser through mask-image, so we
    // preload separately just to catch 404s and to drive the fade-in.
    $effect(() => {
        if (format != "image" || !src) return
        imageFailed = false
        const image = new Image()
        image.onload = () => {
            if (src == loadedSrc) return
            loadedSrc = src
        }
        image.onerror = () => {
            console.warn("⚠️ Failed loading waveform image", src)
            imageFailed = true
        }
        image.src = src
    })

    const maskStyle = $derived(
        `mask-image:url(${JSON.stringify(src)});` +
            `-webkit-mask-image:url(${JSON.stringify(src)});` +
            `mask-size:100% 100%;-webkit-mask-size:100% 100%;` +
            `mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;`
    )

    function fetchWaveform() {
        isLoading = true
        loading.waveformsCount += 1
        const loadingSrc = src
        fetch(src)
            .then((resp) => {
                if (loadingSrc == src) {
                    if (resp.headers.get("content-encoding") == "gzip") {
                        resp.arrayBuffer().then((buff) => {
                            const inflated = pako.inflate(
                                new Uint8Array(buff),
                                {
                                    to: "string",
                                }
                            )
                            waveform = JSON.parse(inflated)
                        })
                    } else {
                        resp.json().then((json) => {
                            waveform = json
                        })
                    }
                    loadedSrc = src
                    loading.waveformsCount -= 1
                    isLoading = false
                } else {
                    console.info("🕜 Ignored stale waveform")
                    loading.waveformsCount -= 1
                    isLoading = false
                }
            })
            .catch((error: Error) => {
                console.error("⚠️ Failed loading waveform", error)
                loading.waveformsCount -= 1
            })
    }

    function generateWaveformPath(data: number[]) {
        const pathData = []
        const width = 1000 // Total width of the SVG
        const height = 200 // Total height of the SVG
        const midHeight = height / 2
        const step = width / data.length // Horizontal step size for each data point

        // Top half of the waveform
        pathData.push(`M 0 ${midHeight}`)
        data.forEach((value, index) => {
            const x = index * step
            const y = midHeight - value * midHeight // Flip vertically
            pathData.push(`L ${x} ${y}`)
        })

        // Bottom half (mirrored) of the waveform
        for (let i = data.length - 1; i >= 0; i--) {
            const x = i * step
            const y = midHeight + data[i] * midHeight
            pathData.push(`L ${x} ${y}`)
        }

        pathData.push("Z") // Close the path
        return pathData.join(" ")
    }
</script>

<button
    class={cn(className, "focus:outline-none cursor-grab")}
    use:inview
    tabindex={-1}
    oninview_change={(event) => (isInView = event.detail.inView)}
    onclick={(event) => {
        const rect = ref.getBoundingClientRect()
        progress = (event.clientX - rect.left) / rect.width
        onseek(progress)
    }}
    bind:this={ref}
    aria-label="Waveform"
>
    {#if format == "image"}
        {#if src && !imageFailed}
            <div
                class={cn(
                    "relative size-full transition-opacity duration-300",
                    !loaded && "opacity-0"
                )}
            >
                <div
                    class="absolute inset-0 bg-muted-foreground opacity-50"
                    style={maskStyle}
                ></div>
                <div
                    class="absolute inset-0"
                    style={`clip-path:inset(0 ${(1 - progress) * 100}% 0 0)`}
                >
                    <div class="size-full bg-primary" style={maskStyle}></div>
                </div>
            </div>
        {/if}
    {:else if waveform}
        <svg
            class={cn(
                "size-full transition-transform duration-1000",
                isInView && "",
                !loaded && "scale-y-0"
            )}
            viewBox={`0 0 1000 200`}
            preserveAspectRatio="none"
        >
            <defs>
                <linearGradient id={key} x1="0" y1="0" x2="1" y2="0">
                    <stop
                        offset={`${progress * 100 || 0}%`}
                        stop-color="hsl(var(--primary))"
                    />
                    <stop
                        offset={`${progress * 100 || 0}%`}
                        stop-color="hsl(var(--muted-foreground))"
                    />
                </linearGradient>
            </defs>
            <path d={generateWaveformPath(waveform)} fill={`url(#${key})`} />
        </svg>
    {/if}
</button>
