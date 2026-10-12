<div align="center">

# Looperman Sprite

**The open-source Splice alternative. Search a free loop library, audition
with the keyboard, drag it into your DAW.**

No subscription, no credits, no account required to start.

![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-000?logo=apple&logoColor=white) ![Windows](https://img.shields.io/badge/Windows-coming%20soon-lightgrey) ![Linux](https://img.shields.io/badge/Linux-coming%20soon-lightgrey) ![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## What it does

Looperman Sprite brings the Splice workflow — search, audition, drag into
your project — to libraries that are actually free, in a desktop app for
producers.

- **Search** Looperman's community loop library, filter by key and tempo,
  and narrow by genre tags. Infinite scroll through thousands of results.
- **Audition** with the keyboard. <kbd>space</kbd> plays, <kbd>↑</kbd>/<kbd>↓</kbd>
  step through the list, and clicking a waveform seeks.
- **Drag** any loop straight onto a DAW track. With a free Looperman login,
  Sprite saves the full-quality WAV; without one it saves the preview.
  Either way it lands as a 16-bit WAV in your samples folder, ready to use.

Two more sources ship built in: **Freesound** (700,000+ Creative Commons
sounds, free API key) and **Splice** itself, though see
[Splice and bot protection](#splice-and-bot-protection).

## Install

**macOS (Apple Silicon):** download the `.dmg` from
[Releases](https://github.com/Benzom666/looperman-sprite/releases), drag
Sprite to your Applications folder, and open it.

The app is not notarized, so Gatekeeper will complain on first launch. Either:

- right-click the app and choose **Open**, or
- run `xattr -d com.apple.quarantine /Applications/Sprite.app`

## First run

Sprite walks you through three steps: where to save samples, which library to
search, and optional credentials.

- **Looperman** needs nothing to search. Add your free
  [looperman.com](https://www.looperman.com/account/login) login to unlock
  full-quality WAV downloads — without it, Sprite saves preview MP3s.
- **Freesound** needs a free key from
  [freesound.org/apiv2/apply](https://freesound.org/apiv2/apply). Copy the
  **Client secret / Api key** column; Sprite validates it against the live
  API before saving. You can skip this and add it later in Settings.
- **Splice** needs no key.

Credentials are stored in plaintext in your config file and are only ever
sent to their own service. Clear them in Settings at any time.

## Keyboard

| Key | Action |
| --- | --- |
| <kbd>space</kbd> | Play / pause |
| <kbd>↑</kbd> <kbd>↓</kbd> | Previous / next sample |
| <kbd>←</kbd> <kbd>→</kbd> | Previous / next sample |
| click waveform | Seek |

## Splice and bot protection

Splice's API sits behind a bot check and frequently returns **HTTP 403** to
non-browser clients. When that happens Sprite says so plainly instead of
showing an empty list. This is Splice-side and affects every third-party client,
including the original Splicerr. Looperman and Freesound are unaffected.

## Building from source

Requires [Node](https://nodejs.org), [pnpm](https://pnpm.io), [Rust](https://rustup.rs),
and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
git clone https://github.com/Benzom666/looperman-sprite
cd looperman-sprite
pnpm install
pnpm tauri dev
```

To produce an installable bundle:

```sh
pnpm tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

## Credits

Looperman Sprite is a derivative work and would not exist without:

- **[Sprite](https://github.com/Benzom666/sprite)** — the Freesound-based app
  this was built from
- **[Splicerr](https://github.com/Robert-K/splicerr)** by
  [Kosro](https://github.com/Robert-K) — the original project
- **[Splicedd](https://github.com/ascpixi/splicedd)** by
  [ascpixi](https://github.com/ascpixi) — the project Splicerr was based on
- **[Looperman](https://www.looperman.com)** — the free community loop
  library this app searches

Built with [SvelteKit](https://svelte.dev), [Tauri](https://tauri.app) and
[bits-ui](https://bits-ui.com). Type is [IBM Plex](https://www.ibm.com/plex/).
Icons are [Lucide](https://lucide.dev).

See [NOTICE.md](NOTICE.md) for full attribution and third-party licenses.

## License

MIT. Samples themselves keep their own licenses — Looperman loops stay
royalty-free under [Looperman's terms](https://www.looperman.com/help/terms),
and Freesound samples under their Creative Commons licenses. Check before
shipping anything.
