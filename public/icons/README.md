Favicon generation source image path:

- public/icons/tomato.png

Recommended source image:

- Square PNG, at least 512x512
- Transparent background optional

Generate favicon and app icon assets with:

- npm run generate:icons

Generated files (written to public/icons):

- favicon-16x16.png
- favicon-32x32.png
- favicon.ico
- apple-touch-icon.png
- android-chrome-192x192.png
- android-chrome-512x512.png

If public/icons/tomato.png is missing, the generation script exits successfully and prints a reminder to add the source image and rerun the command.
