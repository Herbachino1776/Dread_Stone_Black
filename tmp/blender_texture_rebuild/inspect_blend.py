import bpy
import json
from pathlib import Path


def image_info(image):
    return {
        "name": image.name,
        "size": list(image.size),
        "channels": image.channels,
        "filepath": bpy.path.abspath(image.filepath) if image.filepath else "",
        "source": image.source,
        "packed": image.packed_file is not None,
        "colorspace": image.colorspace_settings.name,
    }


def node_info(node):
    result = {
        "name": node.name,
        "type": node.bl_idname,
        "label": node.label,
    }
    if node.bl_idname == "ShaderNodeTexImage" and node.image:
        result["image"] = node.image.name
    return result


scene = bpy.context.scene
report = {
    "blender_version": bpy.app.version_string,
    "blend_path": bpy.data.filepath,
    "scene": scene.name,
    "render_engine": scene.render.engine,
    "objects": [],
    "materials": [],
    "images": [image_info(image) for image in bpy.data.images],
}

for obj in bpy.data.objects:
    entry = {
        "name": obj.name,
        "type": obj.type,
        "location": list(obj.location),
        "rotation_euler": list(obj.rotation_euler),
        "scale": list(obj.scale),
        "hide_render": obj.hide_render,
    }
    if obj.type == "MESH":
        mesh = obj.data
        entry.update(
            {
                "vertices": len(mesh.vertices),
                "edges": len(mesh.edges),
                "polygons": len(mesh.polygons),
                "uv_layers": [layer.name for layer in mesh.uv_layers],
                "active_uv": mesh.uv_layers.active.name if mesh.uv_layers.active else None,
                "material_slots": [slot.material.name if slot.material else None for slot in obj.material_slots],
                "bounds": [list(corner) for corner in obj.bound_box],
            }
        )
    report["objects"].append(entry)

for material in bpy.data.materials:
    entry = {
        "name": material.name,
        "use_nodes": material.use_nodes,
        "blend_method": getattr(material, "surface_render_method", None),
        "nodes": [],
        "links": [],
    }
    if material.use_nodes and material.node_tree:
        entry["nodes"] = [node_info(node) for node in material.node_tree.nodes]
        entry["links"] = [
            {
                "from": f"{link.from_node.name}.{link.from_socket.name}",
                "to": f"{link.to_node.name}.{link.to_socket.name}",
            }
            for link in material.node_tree.links
        ]
    report["materials"].append(entry)

out_path = Path(r"E:\Dev\Dread_Stone_Black\output\blender_texture_rebuild\blend_inventory.json")
out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
