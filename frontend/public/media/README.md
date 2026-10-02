# Store entrance media

The storefront entrance uses the approved final Gemini MP4 without modifying its bytes.

Canonical runtime video:

- `frontend/public/media/store-entrance.mp4`

Entrance logo:

- `StoreEntrance.tsx` reuses the same `YsabelleBrandMark` component used by the customer header.
- This intentionally removes the separate entrance-logo asset path and its failure mode.

## Runtime behavior

The video now uses normal browser autoplay + muted + inline + native loop playback.

There is no scene fade compositor, no pause choreography, no seeking, and no re-encoding. The source MP4 plays exactly as generated.

The approved dark shader/scrim and the light 1.2px presentation blur remain separate CSS layers in `customer-home-premium.css`. Neither is baked into the video.

The only remaining transition is the page-exit fade when the customer clicks **Get Started**.

## Asset verification

Verify the approved video:

```bash
npm run storefront:entrance:verify
```

Reduced-motion users receive the static grocery fallback instead of autoplay video.

Approved source:

- `gemini_generated_video_9a2cd402.mp4`
- Size: `5,417,920` bytes
- SHA256: `53360d489f4303761658cc62cc5984f4ea43116b470ae7e63d263c48497e4df3`
