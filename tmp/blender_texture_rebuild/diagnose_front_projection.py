import bpy
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view


OUT = Path(r"E:\Dev\Dread_Stone_Black\output\blender_texture_rebuild")
IMAGE_PATH = OUT / "projection_views" / "front_projection.png"
scene = bpy.context.scene
mesh_obj = next(obj for obj in bpy.data.objects if obj.type == "MESH")
mesh = mesh_obj.data


def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True

camera_data = bpy.data.cameras.new("DiagnosticCamera")
camera = bpy.data.objects.new("DiagnosticCamera", camera_data)
bpy.context.collection.objects.link(camera)
camera.data.type = "ORTHO"
camera.data.ortho_scale = mesh_obj.dimensions.z / 0.90
camera.location = (0.0, 3.0, 0.0)
look_at(camera, (0, 0, 0))
scene.camera = camera
bpy.context.view_layer.update()

uv = mesh.uv_layers.get("DIAG_FRONT") or mesh.uv_layers.new(name="DIAG_FRONT")
for loop in mesh.loops:
    world_co = mesh_obj.matrix_world @ mesh.vertices[loop.vertex_index].co
    projected = world_to_camera_view(scene, camera, world_co)
    uv.data[loop.index].uv = (projected.x, projected.y)

image = bpy.data.images.load(str(IMAGE_PATH), check_existing=False)
image.colorspace_settings.name = "sRGB"
image.alpha_mode = "STRAIGHT"

material = bpy.data.materials.new("DiagnosticFrontProjection")
material.use_nodes = True
nodes = material.node_tree.nodes
links = material.node_tree.links
nodes.clear()

output = nodes.new("ShaderNodeOutputMaterial")
emission = nodes.new("ShaderNodeEmission")
tex = nodes.new("ShaderNodeTexImage")
tex.image = image
tex.extension = "CLIP"
uv_node = nodes.new("ShaderNodeUVMap")
uv_node.uv_map = "DIAG_FRONT"
links.new(uv_node.outputs["UV"], tex.inputs["Vector"])
links.new(tex.outputs["Color"], emission.inputs["Color"])
links.new(emission.outputs["Emission"], output.inputs["Surface"])

mesh_obj.material_slots[0].material = material
scene.render.filepath = str(OUT / "diagnostic_front_projection.png")
bpy.ops.render.render(write_still=True)
print("Front projection diagnostic rendered")
