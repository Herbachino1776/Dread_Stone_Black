import bpy
import math
from mathutils import Vector
from pathlib import Path


OUT = Path(r"E:\Dev\Dread_Stone_Black\output\blender_texture_rebuild")
OUT.mkdir(parents=True, exist_ok=True)


def save_image(image_name, filename, colorspace=None):
    image = bpy.data.images.get(image_name)
    if image is None:
        raise RuntimeError(f"Missing image: {image_name}")
    if colorspace:
        image.colorspace_settings.name = colorspace
    image.filepath_raw = str(OUT / filename)
    image.file_format = "PNG"
    image.save()


def look_at(camera, point):
    direction = Vector(point) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


save_image("Image_0", "spar3d_base_color_4096.png", "sRGB")
save_image("Image_1", "spar3d_normal_4096.png", "Non-Color")

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.render.image_settings.color_depth = "8"

mesh_obj = next(obj for obj in bpy.data.objects if obj.type == "MESH")
mesh_obj.select_set(True)
bpy.context.view_layer.objects.active = mesh_obj

# Export the real UV layout that corresponds to the packed SPAR3D atlas.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
try:
    bpy.ops.uv.export_layout(
        filepath=str(OUT / "spar3d_uv_layout_4096.svg"),
        export_all=True,
        modified=False,
        mode="SVG",
        size=(4096, 4096),
        opacity=0.35,
    )
finally:
    bpy.ops.object.mode_set(mode="OBJECT")

# Camera and neutral lighting for diagnostic projections.
camera_data = bpy.data.cameras.new("RebuildCamera")
camera = bpy.data.objects.new("RebuildCamera", camera_data)
bpy.context.collection.objects.link(camera)
scene.camera = camera
camera.data.type = "ORTHO"
camera.data.ortho_scale = 1.12

world = scene.world or bpy.data.worlds.new("RebuildWorld")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.06, 0.06, 0.06, 1.0)
bg.inputs["Strength"].default_value = 0.55

key_data = bpy.data.lights.new("Key", type="AREA")
key = bpy.data.objects.new("Key", key_data)
bpy.context.collection.objects.link(key)
key.data.energy = 700
key.data.shape = "DISK"
key.data.size = 2.5
key.location = (1.8, -2.4, 2.0)
look_at(key, (0, 0, 0.05))

fill_data = bpy.data.lights.new("Fill", type="AREA")
fill = bpy.data.objects.new("Fill", fill_data)
bpy.context.collection.objects.link(fill)
fill.data.energy = 450
fill.data.size = 2.5
fill.location = (-2.0, -1.5, 1.0)
look_at(fill, (0, 0, 0.05))

rim_data = bpy.data.lights.new("Rim", type="AREA")
rim = bpy.data.objects.new("Rim", rim_data)
bpy.context.collection.objects.link(rim)
rim.data.energy = 550
rim.data.size = 2.0
rim.location = (0.0, 2.0, 1.7)
look_at(rim, (0, 0, 0.05))

views = {
    "front": (0.0, -3.0, 0.02),
    "front_left": (-1.5, -2.598, 0.02),
    "left": (-3.0, 0.0, 0.02),
    "back": (0.0, 3.0, 0.02),
    "right": (3.0, 0.0, 0.02),
    "front_right": (1.5, -2.598, 0.02),
}

for name, position in views.items():
    camera.location = position
    look_at(camera, (0, 0, 0.0))
    scene.render.filepath = str(OUT / f"mesh_{name}.png")
    bpy.ops.render.render(write_still=True)

print(f"Extracted maps and rendered {len(views)} views to {OUT}")
