# QR Error Correction Tester

A static React + TypeScript web app to visually test QR code error correction robustness.

## What This App Does

- Generates a QR code from input text
- Lets you control QR error correction level (`L`, `M`, `Q`, `H`)
- Applies a mask over the QR code to simulate damage/occlusion
- Shows whether the masked QR is still decodable:
  - `✅ Readable`
  - `❌ Unreable`
- Keeps app state in the URL query string (permalink-ready)

## Tech Stack

- Vite
- React + TypeScript
- Primer React
- `qrcode` (generation)
- `jsqr` (decode check)

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Notes

- This project is a static site; no backend is required.
- Mask color is fixed to `rgb(113, 75, 75)`.
