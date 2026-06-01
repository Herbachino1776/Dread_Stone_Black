# 3D Model Assets

Upload GLB/GLTF model assets here.

Recommended path pattern:

```text
public/assets/models/<asset_name>.glb
```

First uploaded test model target:

```text
public/assets/models/dread_stone_black_test_model_01.glb
```

Notes:

- Prefer `.glb` for game-ready single-file 3D assets.
- Keep mobile performance in mind.
- Generated meshes should be optimized/decimated before heavy use.
- Set origin and scale in Blender when possible.
- Use these assets through Three.js `GLTFLoader`.
