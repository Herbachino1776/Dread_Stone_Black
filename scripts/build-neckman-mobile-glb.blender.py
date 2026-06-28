import bpy
from pathlib import Path

REPO = Path(r"E:\Dev\Dread_Stone_Black")

SRC_DIR = REPO / "public" / "assets" / "enemies" / "neck_man"
OUT = SRC_DIR / "neck_man_folsom_mobile.glb"

SOURCES = {
    "idle": SRC_DIR / "neckman_01_optimized_idle.glb",
    "walk": SRC_DIR / "neckman_01_optimized_walk.glb",
    "punch_right": SRC_DIR / "neckman_01_optimized_punch_right.glb",
    "die": SRC_DIR / "neckman_01_optimized_die.glb",
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_glb(path):
    before_objects = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)

    bpy.ops.import_scene.gltf(filepath=str(path))

    new_objects = [obj for obj in bpy.data.objects if obj not in before_objects]
    new_actions = [act for act in bpy.data.actions if act not in before_actions]

    armatures = [obj for obj in new_objects if obj.type == "ARMATURE"]
    meshes = [obj for obj in new_objects if obj.type == "MESH"]

    if not armatures:
        raise RuntimeError(f"No armature found in {path}")

    return {
        "objects": new_objects,
        "armature": armatures[0],
        "meshes": meshes,
        "actions": new_actions,
    }


def find_action(import_result):
    if import_result["actions"]:
        return import_result["actions"][0]

    armature = import_result["armature"]
    if armature.animation_data and armature.animation_data.action:
        return armature.animation_data.action

    raise RuntimeError(f"No animation action found on {armature.name}")


def stash_action_on_armature(armature, action, name):
    action.name = name
    action.use_fake_user = True

    if not armature.animation_data:
        armature.animation_data_create()

    armature.animation_data.action = action

    # Remove existing NLA track with this name if re-running script.
    for track in list(armature.animation_data.nla_tracks):
        if track.name == name:
            armature.animation_data.nla_tracks.remove(track)

    track = armature.animation_data.nla_tracks.new()
    track.name = name

    start = int(action.frame_range[0])
    strip = track.strips.new(name, start, action)
    strip.name = name


def delete_imported_objects(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        if obj.name in bpy.data.objects:
            obj.select_set(True)
    bpy.ops.object.delete()

    # Keep all imported actions alive after deleting temporary rigs.
    for action in bpy.data.actions:
        action.use_fake_user = True


def export_glb(filepath):
    bpy.ops.object.select_all(action="SELECT")

    props = bpy.ops.export_scene.gltf.get_rna_type().properties
    prop_names = {prop.identifier for prop in props}

    kwargs = {
        "filepath": str(filepath),
        "export_format": "GLB",
        "use_selection": True,
        "export_animations": True,
    }

    # Blender version compatibility.
    if "export_nla_strips" in prop_names:
        kwargs["export_nla_strips"] = True
    if "export_all_actions" in prop_names:
        kwargs["export_all_actions"] = True
    if "export_force_sampling" in prop_names:
        kwargs["export_force_sampling"] = True
    if "export_frame_range" in prop_names:
        kwargs["export_frame_range"] = False
    if "export_animation_mode" in prop_names:
        kwargs["export_animation_mode"] = "NLA_TRACKS"

    bpy.ops.export_scene.gltf(**kwargs)


def main():
    clear_scene()

    for state, path in SOURCES.items():
        if not path.exists():
            raise FileNotFoundError(f"Missing {state} source GLB: {path}")

    print("Importing idle as canonical Neckman body...")
    idle_import = import_glb(SOURCES["idle"])

    canonical_armature = idle_import["armature"]
    canonical_armature.name = "neckman_armature"

    for mesh in idle_import["meshes"]:
        mesh.name = "neckman_mesh"

    idle_action = find_action(idle_import)
    stash_action_on_armature(canonical_armature, idle_action, "idle")

    for state in ["walk", "punch_right", "die"]:
        print(f"Importing {state} only to copy its animation...")
        imported = import_glb(SOURCES[state])
        action = find_action(imported)
        stash_action_on_armature(canonical_armature, action, state)

        print(f"Deleting duplicate {state} rig/mesh, keeping action...")
        delete_imported_objects(imported["objects"])

    OUT.parent.mkdir(parents=True, exist_ok=True)

    print(f"Exporting canonical GLB to: {OUT}")
    export_glb(OUT)

    print("")
    print("DONE.")
    print(f"Created: {OUT}")
    print("Expected final asset:")
    print("  one Neckman mesh")
    print("  one armature")
    print("  four clips/actions: idle, walk, punch_right, die")


if __name__ == "__main__":
    main()
