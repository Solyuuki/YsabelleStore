# Store entrance media

The cinematic storefront entrance uses the approved original Gemini MP4 without modifying its bytes.

Canonical runtime video:

- `frontend/public/media/store-entrance.mp4`

Canonical entrance logo:

- `frontend/public/brand/store-entrance-logo.png`

## Runtime choreography

`StoreEntrance.tsx` keeps the MP4 playing continuously. It does **not** pause, trim, seek, or re-encode the source during scene fades.

A separate compositor layer follows the video's playback clock and performs fade-through-black over the inspected scene-change windows:

- 1.88s → 2.12s: aisle → refrigerators
- 3.95s → 4.55s: refrigerators → snacks
- 5.75s → 6.25s: snacks → personal care
- 7.88s → 8.12s: personal care → household
- 9.25s → 9.70s: household → cooking/pantry
- 9.72s → end and 0.00s → 0.34s: smooth loop boundary

The curtain opacity is derived from `video.currentTime` every animation frame, so the black fade moves with the original footage rather than stopping it.

The approved dark shader/scrim is also a separate CSS layer. It is never baked into the MP4.

## Asset verification

Install/verify the approved video:

```bash
npm run storefront:entrance:install
npm run storefront:entrance:verify
```

Install/verify the approved logo:

```bash
npm run storefront:entrance:logo:install
npm run storefront:entrance:logo:verify
```

Reduced-motion users receive the static grocery fallback instead of autoplay video.
