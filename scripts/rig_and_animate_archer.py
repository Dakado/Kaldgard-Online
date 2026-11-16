import bpy
import math
import mathutils
import os
import glob

def dist_to_segment(p, a, b):
    ab = b - a
    ap = p - a
    dot_ab = ab.dot(ab)
    if dot_ab < 1e-8:
        return (p - a).length
    t = max(0.0, min(1.0, ap.dot(ab) / dot_ab))
    return (p - (a + ab * t)).length

def rig_and_animate(input_glb: str, output_glb: str):
    print(f"Loading GLB from: {input_glb}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=input_glb)

    # 1. Find imported mesh
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes:
        raise RuntimeError("No mesh objects found in imported GLB")
    
    # If multiple parts, join them into a single unified mesh for clean skinning
    if len(meshes) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for m in meshes:
            m.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
    
    mesh = bpy.context.view_layer.objects.active
    mesh.name = "ElvenArcher_Body"

    # 2. Normalize height and ground feet
    z_coords = [v.co.z for v in mesh.data.vertices]
    min_z = min(z_coords)
    max_z = max(z_coords)
    height = max_z - min_z
    target_height = 1.76

    scale = target_height / height
    mesh.scale = (scale, scale, scale)
    bpy.ops.object.transform_apply(scale=True)

    # Center X and Y, ground Z at 0
    verts = mesh.data.vertices
    min_x = min(v.co.x for v in verts)
    max_x = max(v.co.x for v in verts)
    min_y = min(v.co.y for v in verts)
    max_y = max(v.co.y for v in verts)
    min_z = min(v.co.z for v in verts)

    mesh.location = (
        -((min_x + max_x) / 2),
        -((min_y + max_y) / 2),
        -min_z
    )
    bpy.ops.object.transform_apply(location=True, rotation=True)

    # 3. Create Humanoid A-Pose Armature
    bpy.ops.object.armature_add(location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = "Archer_Armature"

    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones

    # Clear default bone
    for b in list(eb):
        eb.remove(b)

    # Anatomical bone definitions tailored to the 1.76m elven A-pose mesh landmarks
    bones_def = {
        'Hips': ((0, -0.08, 0.91), (0, -0.07, 1.05), None),
        'Spine': ((0, -0.07, 1.05), (0, -0.04, 1.25), 'Hips'),
        'Chest': ((0, -0.04, 1.25), (0, -0.02, 1.45), 'Spine'),
        'Neck': ((0, -0.02, 1.45), (0, -0.01, 1.56), 'Chest'),
        'Head': ((0, -0.01, 1.56), (0, -0.01, 1.76), 'Neck'),
        # Arms - exact positions matching raw mesh shoulder, elbow, and palm centers
        'Shoulder.L': ((0.06, 0.00, 1.42), (0.180, 0.016, 1.415), 'Chest'),
        'UpperArm.L': ((0.180, 0.016, 1.415), (0.309, -0.044, 1.172), 'Shoulder.L'),
        'ForeArm.L': ((0.309, -0.044, 1.172), (0.450, -0.156, 0.954), 'UpperArm.L'),
        'Hand.L': ((0.450, -0.156, 0.954), (0.490, -0.200, 0.880), 'ForeArm.L'),
        'Shoulder.R': ((-0.06, 0.00, 1.42), (-0.180, 0.016, 1.415), 'Chest'),
        'UpperArm.R': ((-0.180, 0.016, 1.415), (-0.309, -0.044, 1.172), 'Shoulder.R'),
        'ForeArm.R': ((-0.309, -0.044, 1.172), (-0.450, -0.156, 0.954), 'UpperArm.R'),
        'Hand.R': ((-0.450, -0.156, 0.954), (-0.490, -0.200, 0.880), 'ForeArm.R'),
        # Legs - matching hip socket, knee bend, ankle joint, and forward toe
        'UpperLeg.L': ((0.103, -0.096, 0.912), (0.112, -0.078, 0.512), 'Hips'),
        'LowerLeg.L': ((0.112, -0.078, 0.512), (0.140, -0.110, 0.114), 'UpperLeg.L'),
        'Foot.L': ((0.140, -0.110, 0.114), (0.157, -0.204, 0.020), 'LowerLeg.L'),
        'UpperLeg.R': ((-0.103, -0.096, 0.912), (-0.112, -0.078, 0.512), 'Hips'),
        'LowerLeg.R': ((-0.112, -0.078, 0.512), (-0.140, -0.110, 0.114), 'UpperLeg.R'),
        'Foot.R': ((-0.140, -0.110, 0.114), (-0.157, -0.204, 0.020), 'LowerLeg.R'),
    }

    created = {}
    for name, (h, t, parent) in bones_def.items():
        b = eb.new(name)
        b.head = h
        b.tail = t
        created[name] = b

    for name, (_, _, parent) in bones_def.items():
        if parent:
            created[name].parent = created[parent]

    bpy.ops.object.mode_set(mode='OBJECT')

    # 4. Smooth Geometric Distance Skinning (Deterministic, 100% robust, zero weighting failures)
    print("Computing smooth geometric skinning weights for", len(mesh.data.vertices), "vertices...")
    vgroups = {name: mesh.vertex_groups.new(name=name) for name in bones_def}
    bone_segs = {
        name: (mathutils.Vector(bones_def[name][0]), mathutils.Vector(bones_def[name][1]))
        for name in bones_def
    }

    weights_dict = {name: [] for name in bones_def}

    for i, v in enumerate(mesh.data.vertices):
        pt = v.co
        best_bones = []
        for bname, (p1, p2) in bone_segs.items():
            # Avoid cross-talk across lateral midline
            if '.L' in bname and pt.x < -0.04: continue
            if '.R' in bname and pt.x > 0.04: continue
            d = dist_to_segment(pt, p1, p2)
            best_bones.append((bname, d))
        
        best_bones.sort(key=lambda x: x[1])
        top = best_bones[:3]
        total_w = sum(1.0 / (d**2 + 0.005) for _, d in top)
        for bname, d in top:
            w = (1.0 / (d**2 + 0.005)) / total_w
            if w > 0.04:
                weights_dict[bname].append((i, w))

    # Apply batch weights to vertex groups
    for bname, items in weights_dict.items():
        vg = vgroups[bname]
        for idx, w in items:
            vg.add([idx], w, 'REPLACE')

    # Ensure Armature modifier is set and parented
    mesh.parent = arm
    mod = mesh.modifiers.new(name='Armature', type='ARMATURE')
    mod.object = arm

    print("Geometric skinning complete! All 19 vertex groups weighted cleanly.")

    # 5. Build Smooth Game Animations (Idle, Walk, Run, Shoot_Bow)
    arm.animation_data_create()
    pb = arm.pose.bones
    for b in pb:
        b.rotation_mode = 'QUATERNION'

    def set_rot(bone_name, rx, ry, rz, frame):
        if bone_name in pb:
            p = pb[bone_name]
            p.rotation_mode = 'QUATERNION'
            euler = mathutils.Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ')
            p.rotation_quaternion = euler.to_quaternion()
            p.keyframe_insert(data_path="rotation_quaternion", frame=frame)

    def set_pos(bone_name, px, py, pz, frame):
        if bone_name in pb:
            p = pb[bone_name]
            p.location = (px, py, pz)
            p.keyframe_insert(data_path="location", frame=frame)

    # --- ACTION 1: Idle (48 frames, 2.0s loop @ 24fps) ---
    idle_act = bpy.data.actions.new(name="Idle")
    arm.animation_data.action = idle_act

    for frame in range(1, 49):
        t = (frame - 1) / 47.0
        breath = math.sin(t * math.pi * 2)
        sway = math.cos(t * math.pi * 2)

        set_rot('Spine', -1.0 + breath * 1.2, sway * 0.3, 0, frame)
        set_rot('Chest', -0.5 + breath * 2.0, -sway * 0.5, 0, frame)
        set_rot('Neck', -breath * 0.6, 0, 0, frame)
        set_rot('Head', 0.5 - breath * 0.8, sway * 0.4, 0, frame)

        # Arms hanging naturally straight down along the body (rz = 29 / -29 adducts arms close to hips)
        set_rot('UpperArm.L', -1.0 + breath * 0.4, 0, 29.0 + sway * 0.4, frame)
        set_rot('ForeArm.L', -3.0, 0, 0, frame)
        set_rot('Hand.L', 0, 0, 0, frame)

        set_rot('UpperArm.R', -1.0 + breath * 0.4, 0, -29.0 - sway * 0.4, frame)
        set_rot('ForeArm.R', -3.0, 0, 0, frame)
        set_rot('Hand.R', 0, 0, 0, frame)

        # Legs brought together into graceful feminine parallel stance (rz = 4.5 / -4.5)
        set_rot('UpperLeg.L', 0, 0, 4.5, frame)
        set_rot('LowerLeg.L', 2.0, 0, -0.5, frame)
        set_rot('Foot.L', -2.0, 0, -4.0, frame)
        set_rot('UpperLeg.R', 0, 0, -4.5, frame)
        set_rot('LowerLeg.R', 2.0, 0, 0.5, frame)
        set_rot('Foot.R', -2.0, 0, 4.0, frame)

        set_pos('Hips', 0, sway * 0.003, breath * 0.008, frame)
        set_rot('Hips', 0, sway * 0.4, 0, frame)

    # --- ACTION 2: Walk (40 frames, 1.66s loop @ 24fps) ---
    walk_act = bpy.data.actions.new(name="Walk")
    arm.animation_data.action = walk_act

    for frame in range(1, 41):
        phase = ((frame - 1) / 40.0) * math.pi * 2
        sinP = math.sin(phase)
        cosP = math.cos(phase)

        # Full authentic humanoid walk stride (-30 deg to +18 deg), feet parallel and aligned
        set_rot('UpperLeg.L', -sinP * 25.0 - 4.0, 0, 3.5, frame)
        set_rot('UpperLeg.R', sinP * 25.0 - 4.0, 0, -3.5, frame)

        # Biomechanical knee flexion: smooth 26 deg bend during forward swing
        kneeL = 4.0 + max(0.0, sinP) * 22.0 + max(0.0, -cosP) * 5.0
        kneeR = 4.0 + max(0.0, -sinP) * 22.0 + max(0.0, cosP) * 5.0
        set_rot('LowerLeg.L', kneeL, 0, -0.5, frame)
        set_rot('LowerLeg.R', kneeR, 0, 0.5, frame)

        # Heel-strike & toe push-off
        set_rot('Foot.L', -sinP * 12.0 - 2.0, 0, -3.0, frame)
        set_rot('Foot.R', sinP * 12.0 - 2.0, 0, 3.0, frame)

        # Arms hang relaxed straight down along hips, swinging gently by only ±4.5 deg (no flailing)
        set_rot('UpperArm.L', -sinP * 4.5 - 1.0, 0, 29.0, frame)
        set_rot('UpperArm.R', sinP * 4.5 - 1.0, 0, -29.0, frame)
        set_rot('ForeArm.L', -3.0, 0, 0, frame)
        set_rot('ForeArm.R', -3.0, 0, 0, frame)

        # Natural pelvic bobbing & torso twist
        set_pos('Hips', 0, 0, -abs(sinP) * 0.024 + 0.012, frame)
        set_rot('Hips', 0, 0, sinP * 1.0, frame)
        set_rot('Spine', -1.0, 0, -sinP * 0.8, frame)
        set_rot('Chest', -0.5, 0, -sinP * 1.0, frame)
        set_rot('Head', 0.5, 0, sinP * 0.4, frame)

    # --- ACTION 3: Run (24 frames, 1.0s loop @ 24fps) ---
    run_act = bpy.data.actions.new(name="Run")
    arm.animation_data.action = run_act

    for frame in range(1, 25):
        phase = ((frame - 1) / 24.0) * math.pi * 2
        sinP = math.sin(phase)
        cosP = math.cos(phase)

        # Powerful athletic run stride (-44 deg forward to +32 deg back)
        set_rot('UpperLeg.L', -sinP * 38.0 - 6.0, 0, 4.0, frame)
        set_rot('UpperLeg.R', sinP * 38.0 - 6.0, 0, -4.0, frame)

        # Dynamic high knee drive & back kick recovery
        kneeL = 6.0 + max(0.0, sinP) * 36.0 + max(0.0, -cosP) * 10.0
        kneeR = 6.0 + max(0.0, -sinP) * 36.0 + max(0.0, cosP) * 10.0
        set_rot('LowerLeg.L', kneeL, 0, -0.5, frame)
        set_rot('LowerLeg.R', kneeR, 0, 0.5, frame)

        set_rot('Foot.L', -sinP * 15.0 - 2.0, 0, -3.5, frame)
        set_rot('Foot.R', sinP * 15.0 - 2.0, 0, 3.5, frame)

        # Athletic arm swing held close to the ribs, not flailing wide
        set_rot('UpperArm.L', -sinP * 11.0 - 4.0, 0, 28.0, frame)
        set_rot('UpperArm.R', sinP * 11.0 - 4.0, 0, -28.0, frame)
        set_rot('ForeArm.L', -14.0, 0, 0, frame)
        set_rot('ForeArm.R', -14.0, 0, 0, frame)

        # Athletic forward lean & vertical spring
        set_rot('Hips', 8.0, 0, sinP * 1.5, frame)
        set_rot('Spine', -3.0, 0, -sinP * 1.5, frame)
        set_rot('Chest', -2.0, 0, -sinP * 2.0, frame)
        set_rot('Head', 2.0, 0, sinP * 0.8, frame)
        set_pos('Hips', 0, 0, -abs(sinP) * 0.045 + 0.022, frame)

    # --- ACTION 4: Shoot_Bow (24 frames, 1.0s @ 24fps) ---
    shoot_act = bpy.data.actions.new(name="Shoot_Bow")
    arm.animation_data.action = shoot_act

    def key_planted_legs(frame, knee_boost=0.0):
        # Solid grounded archery stance with legs close and parallel
        set_rot('UpperLeg.L', -6.0, 0, 3.5, frame)
        set_rot('LowerLeg.L', 8.0 + knee_boost, 0, -0.5, frame)
        set_rot('Foot.L', -2.0, 0, -3.0, frame)
        set_rot('UpperLeg.R', 6.0, 0, -3.5, frame)
        set_rot('LowerLeg.R', 8.0 + knee_boost, 0, 0.5, frame)
        set_rot('Foot.R', -2.0, 0, 3.0, frame)

    # Frame 1: Stance preparation & Arrow Nocking in front of chest (Hand.R is forward at bow shelf, NOT in belly)
    key_planted_legs(1)
    set_rot('UpperArm.L', -50, -18, 18, 1)
    set_rot('ForeArm.L', 0, 0, 0, 1)
    set_rot('Hand.L', 0, 0, 0, 1)
    set_rot('UpperArm.R', -65, -15, -15, 1)
    set_rot('ForeArm.R', -30, 0, 0, 1)
    set_rot('Hand.R', 0, 0, 0, 1)
    set_rot('Hips', 0, 0, -2, 1)
    set_rot('Chest', 0, 0, -3, 1)
    set_rot('Head', 0, 0, 5, 1)
    set_pos('Hips', 0, 0, 0, 1)

    # Frame 3: Bow extends forward, right hand starts drawing straight back
    key_planted_legs(3)
    set_rot('UpperArm.L', -68, -20, 18, 3)
    set_rot('ForeArm.L', 0, 0, 0, 3)
    set_rot('Hand.L', 0, 0, 0, 3)
    set_rot('UpperArm.R', -40, -20, -25, 3)
    set_rot('ForeArm.R', -65, 0, 0, 3)
    set_rot('Hand.R', 0, 0, 0, 3)
    set_rot('Hips', 0, 0, -3, 3)
    set_rot('Chest', -1, 0, -4, 3)
    set_rot('Head', 0, 0, 7, 3)

    # Frame 6: Half Draw along arrow path
    key_planted_legs(6)
    set_rot('UpperArm.L', -78, -24, 18, 6)
    set_rot('ForeArm.L', 0, 0, 0, 6)
    set_rot('Hand.L', 0, 0, 0, 6)
    set_rot('UpperArm.R', -15, -25, -30, 6)
    set_rot('ForeArm.R', -95, 0, 0, 6)
    set_rot('Hand.R', 0, 0, 0, 6)
    set_rot('Hips', 0, 0, -4, 6)
    set_rot('Chest', -1, 0, -5, 6)
    set_rot('Head', 0, 0, 9, 6)

    # Frame 8-14: Full Draw Tension Hold (bow aiming straight forward horizontally, draw elbow back & right)
    for f in range(8, 15):
        key_planted_legs(f, knee_boost=1.0)
        # Left arm raises and aims straight forward horizontally (level with shoulder)
        set_rot('UpperArm.L', -81, -25, 18, f)
        set_rot('ForeArm.L', 0, 0, 0, f)
        set_rot('Hand.L', 0, 0, 0, f)
        # Right arm draws string naturally to chin level (elbow pulling back & right)
        set_rot('UpperArm.R', 15, -25, -35, f)
        set_rot('ForeArm.R', -125, 0, 0, f)
        set_rot('Hand.R', 0, 0, 0, f)
        set_rot('Hips', 0, 0, -4, f)
        set_rot('Chest', -1, 0, -6, f)
        set_rot('Head', 0, 0, 10, f)
        set_pos('Hips', 0, 0, -0.015, f)

    # Frame 15: RELEASE SNAP! (String loose, recoil kick, hand anchored at jawline)
    key_planted_legs(15, knee_boost=0.5)
    set_rot('UpperArm.L', -83, -25, 16, 15)  # Bow arm kicks slightly forward on loose
    set_rot('ForeArm.L', 0, 0, 0, 15)
    set_rot('Hand.L', 0, 0, 0, 15)
    set_rot('UpperArm.R', 22, -20, -38, 15)  # Hand anchored at cheek/jaw
    set_rot('ForeArm.R', -125, 0, 0, 15)
    set_rot('Hand.R', 0, 0, 0, 15)
    set_rot('Hips', 0, 0, -3, 15)
    set_rot('Chest', -1, 0, -5, 15)
    set_rot('Head', 0, 0, 8, 15)
    set_pos('Hips', 0, 0, -0.010, 15)

    # Frame 17: Follow-through recoil
    key_planted_legs(17)
    set_rot('UpperArm.L', -75, -20, 18, 17)
    set_rot('ForeArm.L', 0, 0, 0, 17)
    set_rot('Hand.L', 0, 0, 0, 17)
    set_rot('UpperArm.R', 18, -18, -35, 17)
    set_rot('ForeArm.R', -110, 0, 0, 17)
    set_rot('Hand.R', 0, 0, 0, 17)
    set_rot('Hips', 0, 0, -2, 17)
    set_rot('Chest', 0, 0, -4, 17)
    set_rot('Head', 0, 0, 7, 17)

    # Frame 20: Outside Lower (hand swings down along the OUTSIDE of the right hip, NOT through belly)
    key_planted_legs(20)
    set_rot('UpperArm.L', -40, -10, 24, 20)
    set_rot('ForeArm.L', 0, 0, 0, 20)
    set_rot('Hand.L', 0, 0, 0, 20)
    set_rot('UpperArm.R', 5, -10, -25, 20)
    set_rot('ForeArm.R', -20, 0, 0, 20)
    set_rot('Hand.R', 0, 0, 0, 20)
    set_rot('Hips', 0, 0, -1, 20)
    set_rot('Chest', 0, 0, -2, 20)
    set_rot('Head', 0, 0, 4, 20)

    # Frame 24: Settle back smoothly to ready stance
    key_planted_legs(24)
    set_rot('UpperArm.L', -2, 0, 29, 24)
    set_rot('ForeArm.L', -3, 0, 0, 24)
    set_rot('Hand.L', 0, 0, 0, 24)
    set_rot('UpperArm.R', -2, 0, -29, 24)
    set_rot('ForeArm.R', -3, 0, 0, 24)
    set_rot('Hand.R', 0, 0, 0, 24)
    set_rot('Hips', 0, 0, 0, 24)
    set_rot('Chest', 0, 0, 0, 24)
    set_rot('Head', 0, 0, 0, 24)
    set_pos('Hips', 0, 0, 0, 24)

    # Ensure actions persist for glTF export
    for act in [idle_act, walk_act, run_act, shoot_act]:
        act.use_fake_user = True

    # 6. Export Rigged GLB
    os.makedirs(os.path.dirname(output_glb), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output_glb,
        export_format='GLB',
        use_selection=False,
        export_apply=False,
        export_animations=True,
        export_all_influences=True,
    )
    print(f"Successfully exported rigged animated archer to: {output_glb}")

if __name__ == '__main__':
    in_file = r"D:\ComfyUIData\output\3d\ElvenArcherAPose_00001.glb"
    out_file = r"c:\Users\Dakado\Desktop\dakadoro\Kaldgard Online\public\models\elven_archer_animated.glb"
    rig_and_animate(in_file, out_file)
