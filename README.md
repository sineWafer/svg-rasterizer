# SVG Rasterizer

Small static web app that uses the browser to render SVG files, which can then be exported as raster graphics.

- Supports SVGs with [SMIL](https://developer.mozilla.org/docs/Web/SVG/Guides/SVG_animation_with_SMIL) animation by freezing computed DOM attribute values before rendering to the canvas for display and export.
- The output image can be resized and its aspect ratio can be changed.
- Animation start time, duration, and frame rate or total frame count can be adjusted.
- The entire animation sequence can be exported as a zip file, as well as individual frames.
- Animation influence can be toggled off for animated SVGs, though viewing them like this is usually not intended.