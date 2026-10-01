# Store entrance media

Place the approved entrance background at:

- `frontend/public/media/store-entrance.mp4`

Runtime requirements:

- MP4/H.264, no audio track
- 16:9 background footage
- transitions are short dip-to-black/fade-to-black transitions, not cross-dissolves
- keep the video itself clean; darkness/readability is applied by the CSS scrim in `customer-home-premium.css`
- no baked-in text, buttons, logos, or UI
- `StoreEntrance.tsx` falls back to a bundled grocery still if the video is unavailable or the user prefers reduced motion

Recommended web target: 960×540 to 1280×720, approximately 0.7–1.5 Mbps depending on final visual quality.

Prepare an approved source file with:

```bash
npm run storefront:entrance:prepare -- frontend/public/media/store-entrance-source.mp4
```

The preparation command removes audio, converts the known scene changes to short fade-to-black transitions, scales to a web-safe 960×540 H.264 stream, and enables MP4 fast-start.
