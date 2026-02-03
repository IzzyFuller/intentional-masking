"""
Blender 5.0 Python script to merge avatar with Mixamo animations.

Usage:
    blender --background --python scripts/merge_avatar_animations.py

Or run from within Blender's scripting tab.

Key settings to preserve keyframes:
- Always Sample Animation: ENABLED
- Sampling Rate: 1
- Group By NLA Track: DISABLED

Blender 5.0 uses layered actions:
- action.layers[].strips[].channelbags[].fcurves[]
"""

import bpy
from pathlib import Path

# Configuration - adjust these paths as needed
PROJECT_ROOT = Path(__file__).parent.parent
AVATAR_PATH = PROJECT_ROOT / "assets" / "sample_avatar.glb"
ANIMATIONS_DIR = PROJECT_ROOT / "avatars_and_animations"
OUTPUT_PATH = PROJECT_ROOT / "assets" / "sample_avatar_animated.glb"

# Which animations to include (None = all FBX files)
SELECTED_ANIMATIONS = [
    "Talking.fbx",
    "Idle.fbx",
    "Standing Arguing.fbx",
    "Standing Greeting.fbx",
]


def get_fcurve_count(action):
    """Get fcurve count from Blender 5.0 layered action."""
    count = 0
    for layer in action.layers:
        for strip in layer.strips:
            for cb in strip.channelbags:
                count += len(cb.fcurves)
    return count


def get_keyframe_count(action):
    """Get keyframe count from first fcurve of Blender 5.0 layered action."""
    for layer in action.layers:
        for strip in layer.strips:
            for cb in strip.channelbags:
                if cb.fcurves:
                    return len(cb.fcurves[0].keyframe_points)
    return 0


def clear_scene():
    """Remove all objects from scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Clear orphan data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.armatures:
        if block.users == 0:
            bpy.data.armatures.remove(block)
    for block in bpy.data.actions:
        if block.users == 0:
            bpy.data.actions.remove(block)


def import_avatar(avatar_path: Path):
    """Import the GLB avatar."""
    print(f"Importing avatar: {avatar_path}")
    bpy.ops.import_scene.gltf(filepath=str(avatar_path))

    # Find the armature
    armature = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break

    if not armature:
        raise RuntimeError("No armature found in avatar!")

    print(f"Found armature: {armature.name}")

    # Rename bones to match Mixamo naming convention (add mixamorig: prefix)
    # This is required because Mixamo animations target bones with this prefix
    print("Renaming bones to match Mixamo convention...")
    renamed_count = 0
    for bone in armature.data.bones:
        if not bone.name.startswith("mixamorig:"):
            old_name = bone.name
            bone.name = f"mixamorig:{old_name}"
            renamed_count += 1
    print(f"  Renamed {renamed_count} bones (added mixamorig: prefix)")

    return armature


def import_animation(fbx_path: Path, armature):
    """Import a Mixamo FBX animation and transfer it to the avatar armature."""
    print(f"\nImporting animation: {fbx_path.name}")

    # Import the FBX
    bpy.ops.import_scene.fbx(
        filepath=str(fbx_path),
        use_anim=True,
        ignore_leaf_bones=True,
        automatic_bone_orientation=True,
    )

    # Find the imported armature (it's selected after import)
    imported_armature = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'ARMATURE':
            imported_armature = obj
            break

    if not imported_armature:
        print(f"  Warning: No armature in {fbx_path.name}, skipping")
        return None

    # Get the action from the imported armature
    if not imported_armature.animation_data or not imported_armature.animation_data.action:
        print(f"  Warning: No animation data in {fbx_path.name}, skipping")
        bpy.data.objects.remove(imported_armature)
        return None

    action = imported_armature.animation_data.action

    # Rename the action to something meaningful
    animation_name = fbx_path.stem.replace(" ", "_").replace("-", "_")
    action.name = animation_name

    # Count keyframes to verify (Blender 5.0 API)
    keyframe_count = get_keyframe_count(action)
    fcurve_count = get_fcurve_count(action)
    print(f"  Action: {action.name}, fcurves: {fcurve_count}, keyframes: {keyframe_count}")

    # Transfer the action to the main armature
    # First, ensure the main armature has animation data
    if not armature.animation_data:
        armature.animation_data_create()

    # Stash the action in NLA so it gets exported
    # This is CRITICAL - actions must be stashed or they won't export!
    track = armature.animation_data.nla_tracks.new()
    track.name = animation_name

    # Add the action as a strip
    start_frame = int(action.frame_range[0])
    strip = track.strips.new(animation_name, start_frame, action)
    strip.name = animation_name

    print(f"  Stashed in NLA track: {track.name}")

    # Delete the imported armature (we only needed its action)
    bpy.data.objects.remove(imported_armature, do_unlink=True)

    return action


def verify_animations(armature):
    """Verify all animations are properly set up for export."""
    print("\n=== VERIFICATION ===")

    if not armature.animation_data:
        print("ERROR: No animation data on armature!")
        return False

    nla_tracks = armature.animation_data.nla_tracks
    print(f"NLA tracks: {len(nla_tracks)}")

    all_good = True
    for track in nla_tracks:
        print(f"\nTrack: {track.name}")
        for strip in track.strips:
            action = strip.action
            if action:
                # Blender 5.0 API
                kf_count = get_keyframe_count(action)
                fc_count = get_fcurve_count(action)
                print(f"  Strip: {strip.name}, fcurves: {fc_count}, keyframes: {kf_count}")
                if kf_count <= 2:
                    print(f"  WARNING: Only {kf_count} keyframes - animation may be empty!")
                    all_good = False
            else:
                print(f"  Strip: {strip.name}, NO ACTION!")
                all_good = False

    return all_good


def export_glb(output_path: Path, armature):
    """Export as GLB with proper settings to preserve keyframes."""
    print(f"\n=== EXPORTING TO {output_path} ===")

    # Select the armature and its children (mesh)
    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    for child in armature.children:
        child.select_set(True)
    bpy.context.view_layer.objects.active = armature

    # Export with CRITICAL settings (Blender 5.0 API)
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format='GLB',

        # Animation settings - CRITICAL!
        export_animations=True,
        export_animation_mode='ACTIONS',  # Export all actions
        export_nla_strips=True,  # Include NLA strips

        # Sampling - CRITICAL for preserving keyframes!
        export_force_sampling=True,  # "Always Sample Animation" - MUST BE TRUE!
        export_bake_animation=True,  # Bake animations

        # Skinning & Mesh
        export_skins=True,
        export_morph=True,  # Export shape keys/morph targets
        export_texcoords=True,
        export_normals=True,

        # Only export selected
        use_selection=True,
    )

    print(f"Exported to: {output_path}")


def main():
    print("=" * 60)
    print("AVATAR + ANIMATION MERGER")
    print("=" * 60)

    # Clear scene
    clear_scene()

    # Import avatar
    armature = import_avatar(AVATAR_PATH)

    # Find animation files
    if SELECTED_ANIMATIONS:
        fbx_files = [ANIMATIONS_DIR / name for name in SELECTED_ANIMATIONS]
        fbx_files = [f for f in fbx_files if f.exists()]
    else:
        fbx_files = list(ANIMATIONS_DIR.glob("*.fbx"))

    print(f"\nFound {len(fbx_files)} animation files to import")

    # Import each animation
    imported_count = 0
    for fbx_path in fbx_files:
        action = import_animation(fbx_path, armature)
        if action:
            imported_count += 1

    print(f"\nSuccessfully imported {imported_count} animations")

    # Verify
    if not verify_animations(armature):
        print("\nWARNING: Some animations may not export correctly!")

    # Export
    export_glb(OUTPUT_PATH, armature)

    print("\n" + "=" * 60)
    print("DONE!")
    print("=" * 60)


if __name__ == "__main__":
    main()
