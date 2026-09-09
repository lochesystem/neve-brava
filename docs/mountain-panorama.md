# Mountain panorama pilot

Vale Bravo uses `public/images/scenery/alpine-sunset-v1.png`, generated with the built-in image_gen tool (not CLI). Other courses retain their original skies. The original sky also remains as a loading/error fallback.

One unlit inward-facing sphere, one texture, no cube-map conversion or post-processing. Only camera translation is copied; orientation remains world-fixed. Procedural clouds and cones are hidden when the panorama is active. Fog is tinted lavender to blend the terrain into the painted horizon. Gameplay, terrain and obstacles are unchanged.

Asset: 1774 × 887, approximately 1.2 MB PNG; approximately 8 MB GPU RGBA memory including mipmaps. Real-device performance still needs validation. A generated panorama is not a guarantee of mathematically seamless edges; inspect the wrap in motion before extending this to other tracks.

## Final generation prompt

Use case: stylized-concept. Asset type: seamless 360-degree equirectangular skybox texture for a mobile stylized snowboarding game. Generate a 2:1 landscape panorama, ideally 2048x1024. Painted snowy alpine mountain range at late afternoon, charming high-quality animated game art, defined irregular rocky peaks with snow-covered ridges, blue lavender shadows and gentle peach golden highlights. Technical projection: full 360 degrees longitude and 180 degrees latitude, horizon exactly halfway down image. Mountain peaks mostly between 35% and 49% image height, distant mountain foothills fading into pale blue lavender mist at 55%; bottom half simple soft mist without foreground objects. Upper third mostly clear gradient blue sky with sparse soft painted clouds, no hard sun disk. Left and right edges must join seamlessly with matching mountain contours and sky colors. Zenith and nadir simple uniform colors for spherical mapping. NO trees, houses, ground-level objects, characters, track, text, borders, UI or watermark. Mountains varied and organically sculpted, not triangular icons. Panorama is a distant environment, not a framed scenic illustration.
