# Store entrance media

The storefront entrance uses the approved original Gemini MP4 without modifying its bytes.

Canonical runtime video:

- `frontend/public/media/store-entrance.mp4`

Entrance logo:

- `StoreEntrance.tsx` reuses the same `YsabelleBrandMark` component used by the customer header.
- This intentionally removes the separate entrance-logo asset path and its failure mode.

## Runtime behavior

The video now uses normal browser autoplay + muted + inline + native loop playback.

There is no scene fade compositor, no pause choreography, no seeking, and no re-encoding. The source MP4 plays exactly as generated.

The approved dark shader/scrim remains a separate CSS layer in `customer-home-premium.css`. It is not baked into the video.

The only remaining transition is the page-exit fade when the customer clicks **Get Started**.

## Asset verification

Verify the approved video:

```bash
npm run storefront:entrance:verify
```

Reduced-motion users receive the static grocery fallback instead of autoplay video.
