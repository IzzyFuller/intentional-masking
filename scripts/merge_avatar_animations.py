"""
Blender 5.0 Python script to merge avatar with Mixamo animations.

Usage:
    blender --background --python scripts/merge_avatar_animations.py

Uses constraint-based animation transfer: imports GLB avatar as target,
then for each FBX animation adds bone constraints (WORLD space) and bakes.
Blender's constraint system handles the FBX (Y-up + 90deg X object rotation)
to GLB (Z-up) coordinate conversion automatically.

Blender 5.0 uses layered actions:
- action.layers[].strips[].channelbags[].fcurves[]
"""

import bpy
from pathlib import Path

# Configuration
PROJECT_ROOT = Path(__file__).parent.parent
AVATAR_GLB_PATH = PROJECT_ROOT / "assets" / "sample_avatar.glb"
ANIMATIONS_DIR = PROJECT_ROOT / "avatars_and_animations"
OUTPUT_PATH = PROJECT_ROOT / "assets" / "sample_avatar_animated.glb"

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

    for collection in [bpy.data.meshes, bpy.data.armatures, bpy.data.actions]:
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def import_glb_avatar(glb_path: Path):
    """Import the GLB avatar as the target armature (keeps morph targets)."""
    print(f"Importing GLB avatar: {glb_path}")
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    armature = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break

    if not armature:
        raise RuntimeError("No armature found in GLB avatar!")

    bone_count = len(armature.data.bones)
    mesh_count = len([c for c in armature.children if c.type == 'MESH'])
    morph_count = sum(
        len(c.data.shape_keys.key_blocks) if c.data.shape_keys else 0
        for c in armature.children if c.type == 'MESH'
    )
    print(f"Found armature: {armature.name} ({bone_count} bones, {mesh_count} meshes, {morph_count} morph targets)")

    return armature


def import_and_transfer_animation(fbx_path: Path, target_armature):
    """Import FBX animation and transfer to target via bone constraints.

    Uses Blender's constraint system to handle coordinate space conversion:
    - Copy Rotation (WORLD -> WORLD) on all matching bones
    - Copy Location (WORLD -> WORLD) on Hips only
    - Bake with visual_keying to capture constraint-evaluated poses
    """
    animation_name = fbx_path.stem.replace(" ", "_").replace("-", "_")
    print(f"\nImporting animation: {fbx_path.name} -> {animation_name}")

    # Import FBX animation as source
    bpy.ops.import_scene.fbx(
        filepath=str(fbx_path),
        use_anim=True,
        ignore_leaf_bones=True,
        automatic_bone_orientation=True,
    )

    source_armature = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'ARMATURE' and obj != target_armature:
            source_armature = obj
            break

    if not source_armature:
        print(f"  Warning: No armature in {fbx_path.name}, skipping")
        return None

    if not source_armature.animation_data or not source_armature.animation_data.action:
        print(f"  Warning: No animation data in {fbx_path.name}, skipping")
        bpy.data.objects.remove(source_armature, do_unlink=True)
        return None

    source_action = source_armature.animation_data.action
    frame_start = int(source_action.frame_range[0])
    frame_end = int(source_action.frame_range[1])
    print(f"  Source: {source_armature.name}, frames {frame_start}-{frame_end}")

    # Add constraints from target bones to source bones
    bpy.ops.object.select_all(action='DESELECT')
    target_armature.select_set(True)
    bpy.context.view_layer.objects.active = target_armature
    bpy.ops.object.mode_set(mode='POSE')

    source_bone_names = {b.name for b in source_armature.data.bones}
    constrained_count = 0

    for pose_bone in target_armature.pose.bones:
        if pose_bone.name not in source_bone_names:
            continue

        # Copy Rotation in world space
        c_rot = pose_bone.constraints.new('COPY_ROTATION')
        c_rot.target = source_armature
        c_rot.subtarget = pose_bone.name
        c_rot.target_space = 'WORLD'
        c_rot.owner_space = 'WORLD'

        # Copy Location only on root bone (Hips)
        if pose_bone.name == "Hips":
            c_loc = pose_bone.constraints.new('COPY_LOCATION')
            c_loc.target = source_armature
            c_loc.subtarget = pose_bone.name
            c_loc.target_space = 'WORLD'
            c_loc.owner_space = 'WORLD'

        constrained_count += 1

    print(f"  Constrained {constrained_count} bones")

    # Bake the constrained animation onto target
    bpy.context.scene.frame_set(frame_start)
    source_armature.animation_data.action = source_action

    bpy.ops.nla.bake(
        frame_start=frame_start,
        frame_end=frame_end,
        only_selected=False,
        visual_keying=True,
        clear_constraints=True,
        bake_types={'POSE'},
    )

    # Name and stash the baked action
    baked_action = target_armature.animation_data.action
    if not baked_action:
        print(f"  Warning: Bake produced no action for {fbx_path.name}")
        bpy.ops.object.mode_set(mode='OBJECT')
        bpy.data.objects.remove(source_armature, do_unlink=True)
        return None

    baked_action.name = animation_name
    fcurve_count = get_fcurve_count(baked_action)
    keyframe_count = get_keyframe_count(baked_action)
    print(f"  Baked: {fcurve_count} fcurves, {keyframe_count} keyframes")

    # Stash in NLA track
    track = target_armature.animation_data.nla_tracks.new()
    track.name = animation_name
    track.strips.new(animation_name, frame_start, baked_action)
    target_armature.animation_data.action = None
    print(f"  Stashed in NLA track: {track.name}")

    bpy.ops.object.mode_set(mode='OBJECT')

    # Clean up source armature and its children
    for child in list(source_armature.children):
        bpy.data.objects.remove(child, do_unlink=True)
    bpy.data.objects.remove(source_armature, do_unlink=True)

    return baked_action


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
    """Export as GLB with animations and morph targets."""
    print(f"\n=== EXPORTING TO {output_path} ===")

    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    for child in armature.children:
        child.select_set(True)
    bpy.context.view_layer.objects.active = armature

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format='GLB',
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_nla_strips=True,
        export_force_sampling=True,
        export_bake_animation=True,
        export_skins=True,
        export_morph=True,
        export_texcoords=True,
        export_normals=True,
        use_selection=True,
    )

    print(f"Exported to: {output_path}")


def main():
    print("=" * 60)
    print("AVATAR + ANIMATION MERGER (constraint-based transfer)")
    print("=" * 60)

    clear_scene()

    # Step 1: Import GLB avatar as target (keeps morph targets)
    armature = import_glb_avatar(AVATAR_GLB_PATH)

    # Step 2: Import and transfer each animation via constraints
    if SELECTED_ANIMATIONS:
        fbx_files = [ANIMATIONS_DIR / name for name in SELECTED_ANIMATIONS]
        fbx_files = [f for f in fbx_files if f.exists()]
    else:
        fbx_files = list(ANIMATIONS_DIR.glob("*.fbx"))

    print(f"\nFound {len(fbx_files)} animation files to import")

    imported_count = 0
    for fbx_path in fbx_files:
        action = import_and_transfer_animation(fbx_path, armature)
        if action:
            imported_count += 1

    print(f"\nSuccessfully transferred {imported_count} animations")

    # Step 3: Verify and export
    if not verify_animations(armature):
        print("\nWARNING: Some animations may not export correctly!")

    export_glb(OUTPUT_PATH, armature)

    print("\n" + "=" * 60)
    print("DONE!")
    print("=" * 60)


if __name__ == "__main__":
    main()
