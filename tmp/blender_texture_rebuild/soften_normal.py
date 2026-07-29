import bpy
from pathlib import Path


OUT = Path(r"E:\Dev\Dread_Stone_Black\output\blender_texture_rebuild")
mesh_obj = next(obj for obj in bpy.data.objects if obj.type == "MESH")
material = mesh_obj.material_slots[0].material
normal_node = material.node_tree.nodes.get("Normal Map")
normal_node.inputs["Strength"].default_value = 0.25

for polygon in mesh_obj.data.polygons:
    polygon.use_smooth = True

blend_path = OUT / "folsomsavage_retextured_v2_softnormal.blend"
glb_path = OUT / "folsomsavage_retextured_v2_softnormal.glb"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), copy=True)

for obj in bpy.context.selected_objects:
    obj.select_set(False)
mesh_obj.select_set(True)
bpy.context.view_layer.objects.active = mesh_obj
bpy.ops.export_scene.gltf(
    filepath=str(glb_path),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
)
print(f"Saved {blend_path}")
print(f"Saved {glb_path}")
