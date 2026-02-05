"""
Blender 5.0 Python script to merge avatar with Mixamo animations.

Usage:
    blender --background --python scripts/merge_avatar_animations.py

Follows the Don McCurdy workflow: import base character AND animations as FBX
so bone orientations match. Then import GLB morph targets separately.

Blender 5.0 uses layered actions:
- action.layers[].strips[].channelbags[].fcurves[]
"""

import bpy
from pathlib import Path

# Configuration
PROJECT_ROOT = Path(__file__).parent.parent
AVATAR_GLB_PATH = PROJECT_ROOT / "assets" / "sample_avatar.glb"
AVATAR_FBX_PATH = PROJECT_ROOT / "avatars_and_animations" / "mesh_for_mixamo_72940d11f8.fbx"
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

    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.armatures:
        if block.users == 0:
            bpy.data.armatures.remove(block)
    for block in bpy.data.actions:
        if block.users == 0:
            bpy.data.actions.remove(block)


def import_fbx_avatar(fbx_path: Path):
    """Import the base character as FBX (same bone convention as animations)."""
    print(f"Importing base character (FBX): {fbx_path}")
    bpy.ops.import_scene.fbx(
        filepath=str(fbx_path),
        use_anim=False,
        ignore_leaf_bones=True,
        automatic_bone_orientation=True,
    )

    armature = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break

    if not armature:
        raise RuntimeError("No armature found in FBX avatar!")

    bone_count = len(armature.data.bones)
    mesh_count = len([c for c in armature.children if c.type == 'MESH'])
    print(f"Found armature: {armature.name} ({bone_count} bones, {mesh_count} meshes)")

    return armature


def import_glb_morph_targets(glb_path: Path, fbx_armature):
    """Import GLB avatar and transfer morph target meshes to the FBX armature."""
    print(f"\nImporting GLB for morph targets: {glb_path}")
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    glb_armature = None
    glb_meshes = []
    for obj in bpy.context.selected_objects:
        if obj.type == 'ARMATURE':
            glb_armature = obj
        elif obj.type == 'MESH':
            glb_meshes.append(obj)

    if not glb_armature:
        print("  Warning: No armature in GLB, skipping morph target transfer")
        return

    # Find meshes with shape keys (morph targets)
    morph_meshes = [m for m in glb_meshes if m.data.shape_keys]
    print(f"  Found {len(morph_meshes)} meshes with morph targets")

    # Delete FBX meshes — we'll use GLB meshes instead (they have morph targets)
    fbx_meshes = [c for c in fbx_armature.children if c.type == 'MESH']
    for mesh in fbx_meshes:
        print(f"  Removing FBX mesh: {mesh.name}")
        bpy.data.objects.remove(mesh, do_unlink=True)

    # Re-parent GLB meshes to the FBX armature
    for mesh in glb_meshes:
        # Clear existing parent
        mesh.parent = None
        mesh.matrix_world = mesh.matrix_world.copy()

        # Parent to FBX armature with armature deform (preserving vertex groups)
        mesh.parent = fbx_armature
        # Add armature modifier if not present
        has_armature_mod = any(m.type == 'ARMATURE' for m in mesh.modifiers)
        if not has_armature_mod:
            mod = mesh.modifiers.new(name='Armature', type='ARMATURE')
            mod.object = fbx_armature

        shape_key_count = len(mesh.data.shape_keys.key_blocks) if mesh.data.shape_keys else 0
        print(f"  Re-parented: {mesh.name} ({shape_key_count} shape keys)")

    # Delete GLB armature
    bpy.data.objects.remove(glb_armature, do_unlink=True)
    print("  Deleted GLB armature")


def import_animation(fbx_path: Path, armature):
    """Import a Mixamo FBX animation and transfer it to the base armature."""
    print(f"\nImporting animation: {fbx_path.name}")

    bpy.ops.import_scene.fbx(
        filepath=str(fbx_path),
        use_anim=True,
        ignore_leaf_bones=True,
        automatic_bone_orientation=True,
    )

    imported_armature = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'ARMATURE':
            imported_armature = obj
            break

    if not imported_armature:
        print(f"  Warning: No armature in {fbx_path.name}, skipping")
        return None

    if not imported_armature.animation_data or not imported_armature.animation_data.action:
        print(f"  Warning: No animation data in {fbx_path.name}, skipping")
        bpy.data.objects.remove(imported_armature)
        return None

    action = imported_armature.animation_data.action
    animation_name = fbx_path.stem.replace(" ", "_").replace("-", "_")
    action.name = animation_name

    keyframe_count = get_keyframe_count(action)
    fcurve_count = get_fcurve_count(action)
    print(f"  Action: {action.name}, fcurves: {fcurve_count}, keyframes: {keyframe_count}")

    if not armature.animation_data:
        armature.animation_data_create()

    track = armature.animation_data.nla_tracks.new()
    track.name = animation_name
    start_frame = int(action.frame_range[0])
    strip = track.strips.new(animation_name, start_frame, action)
    strip.name = animation_name
    print(f"  Stashed in NLA track: {track.name}")

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
    print("AVATAR + ANIMATION MERGER")
    print("=" * 60)

    clear_scene()

    # Step 1: Import base character as FBX (same bone convention as animations)
    armature = import_fbx_avatar(AVATAR_FBX_PATH)

    # Step 2: Import GLB and transfer morph target meshes to FBX armature
    import_glb_morph_targets(AVATAR_GLB_PATH, armature)

    # Step 3: Import animations
    if SELECTED_ANIMATIONS:
        fbx_files = [ANIMATIONS_DIR / name for name in SELECTED_ANIMATIONS]
        fbx_files = [f for f in fbx_files if f.exists()]
    else:
        fbx_files = [
            f for f in ANIMATIONS_DIR.glob("*.fbx")
            if f.name != AVATAR_FBX_PATH.name
        ]

    print(f"\nFound {len(fbx_files)} animation files to import")

    imported_count = 0
    for fbx_path in fbx_files:
        action = import_animation(fbx_path, armature)
        if action:
            imported_count += 1

    print(f"\nSuccessfully imported {imported_count} animations")

    # Step 4: Verify and export
    if not verify_animations(armature):
        print("\nWARNING: Some animations may not export correctly!")

    export_glb(OUTPUT_PATH, armature)

    print("\n" + "=" * 60)
    print("DONE!")
    print("=" * 60)


if __name__ == "__main__":
    main()
