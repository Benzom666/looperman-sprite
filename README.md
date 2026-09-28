<div align="center">

# Sprite

**Search a free sample library, audition it with the keyboard, drag it into your DAW.**

A desktop app for producers. No subscription, no account.

![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-000?logo=apple&logoColor=white) ![Windows](https://img.shields.io/badge/Windows-coming%20soon-lightgrey) ![Linux](https://img.shields.io/badge/Linux-coming%20soon-lightgrey) ![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## What it does

Sprite indexes free, openly-licensed samples and gets them out of your browser
and into your DAW.

- **Search** Freesound's 700,000+ Creative Commons sounds, filter by key, tempo
  and type, and narrow by tags.
- **Audition** with the keyboard. <kbd>space</kbd> plays, <kbd>↑</kbd>/<kbd>↓</kbd>
  step through the list, and clicking a waveform seeks.
- **Drag** any sound straight onto a DAW track. Sprite saves it as a 16-bit WAV
  in your samples folder, ready to use.

Splice remains supported as a second source, though see
[Splice and bot protection](#splice-and-bot-protection).

## Install

**macOS (Apple Silicon):** download the `.dmg` from
[Releases](https://github.com/Benzom666/sprite/releases), drag Sprite to your
Applications folder, and open it.

The app is not notarized, so Gatekeeper will complain on first launch. Either:

- right-click the app and choose **Open**, or
- run `xattr -d com.apple.quarantine /Applications/Sprite.app`

## First run

Sprite walks you through three steps: where to save samples, which library to
search, and a free API key.

The key comes from [freesound.org/apiv2/apply](https://freesound.org/apiv2/apply).
Sign in, request a credential, and copy the **Client secret / Api key** column.
Sprite validates it against the live API before saving, so you find out
immediately if the paste was wrong.

The key is stored in plaintext in your config file and is only ever sent to
Freesound as an `Authorization` header. Clear it in Settings at any time.

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
including the original Splicerr. Freesound is unaffected and is the default.

## Building from source

Requires [Node](https://nodejs.org), [pnpm](https://pnpm.io), [Rust](https://rustup.rs),
and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
git clone https://github.com/Benzom666/sprite
cd sprite
pnpm install
pnpm tauri dev
```

To produce an installable bundle:

```sh
pnpm tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

## Credits

Sprite is a derivative work and would not exist without:

- **[Splicerr](https://github.com/Robert-K/splicerr)** by
  [Kosro](https://github.com/Robert-K) — the original project
- **[Splicedd](https://github.com/ascpixi/splicedd)** by
  [ascpixi](https://github.com/ascpixi) — the project Splicerr was based on

Built with [SvelteKit](https://svelte.dev), [Tauri](https://tauri.app) and
[bits-ui](https://bits-ui.com). Type is [IBM Plex](https://www.ibm.com/plex/).
Icons are [Lucide](https://lucide.dev).

See [NOTICE.md](NOTICE.md) for full attribution and third-party licenses.

## License

MIT. Samples themselves keep their own licenses — check Freesound before
shipping anything.
