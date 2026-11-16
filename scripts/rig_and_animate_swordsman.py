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
    mesh.name = "ElvenSwordsman_Body"

    # 2. Normalize height and ground feet
    z_coords = [v.co.z for v in mesh.data.vertices]
    min_z = min(z_coords)
    max_z = max(z_coords)
    height = max_z - min_z
    target_height = 1.86  # Noble imposing elven knight height

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
    arm.name = "Swordsman_Armature"

    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones

    # Clear default bone
    for b in list(eb):
        eb.remove(b)

    # Scale factor from 1.76m archer template to 1.86m swordsman template
    sf = target_height / 1.76

    # Anatomical bone definitions tailored to the 1.86m elven knight A-pose mesh landmarks
    bones_def = {
        'Hips': ((0, -0.06 * sf, 0.91 * sf), (0, -0.05 * sf, 1.05 * sf), None),
        'Spine': ((0, -0.05 * sf, 1.05 * sf), (0, -0.03 * sf, 1.25 * sf), 'Hips'),
        'Chest': ((0, -0.03 * sf, 1.25 * sf), (0, -0.01 * sf, 1.45 * sf), 'Spine'),
        'Neck': ((0, -0.01 * sf, 1.45 * sf), (0, 0.00, 1.56 * sf), 'Chest'),
        'Head': ((0, 0.00, 1.56 * sf), (0, 0.00, 1.76 * sf), 'Neck'),
        # Arms - elven knight broad gothic pauldrons and 45 degree A-pose
        'Shoulder.L': ((0.06 * sf, 0.00, 1.42 * sf), (0.190 * sf, 0.016 * sf, 1.415 * sf), 'Chest'),
        'UpperArm.L': ((0.190 * sf, 0.016 * sf, 1.415 * sf), (0.320 * sf, -0.044 * sf, 1.172 * sf), 'Shoulder.L'),
        'ForeArm.L': ((0.320 * sf, -0.044 * sf, 1.172 * sf), (0.465 * sf, -0.156 * sf, 0.954 * sf), 'UpperArm.L'),
        'Hand.L': ((0.465 * sf, -0.156 * sf, 0.954 * sf), (0.510 * sf, -0.200 * sf, 0.880 * sf), 'ForeArm.L'),
        'Shoulder.R': ((-0.06 * sf, 0.00, 1.42 * sf), (-0.190 * sf, 0.016 * sf, 1.415 * sf), 'Chest'),
        'UpperArm.R': ((-0.190 * sf, 0.016 * sf, 1.415 * sf), (-0.320 * sf, -0.044 * sf, 1.172 * sf), 'Shoulder.R'),
        'ForeArm.R': ((-0.320 * sf, -0.044 * sf, 1.172 * sf), (-0.465 * sf, -0.156 * sf, 0.954 * sf), 'UpperArm.R'),
        'Hand.R': ((-0.465 * sf, -0.156 * sf, 0.954 * sf), (-0.510 * sf, -0.200 * sf, 0.880 * sf), 'ForeArm.R'),
        # Legs - matching hip socket, knee bend, ankle joint, and armored boots
        'UpperLeg.L': ((0.108 * sf, -0.086 * sf, 0.912 * sf), (0.118 * sf, -0.068 * sf, 0.512 * sf), 'Hips'),
        'LowerLeg.L': ((0.118 * sf, -0.068 * sf, 0.512 * sf), (0.142 * sf, -0.100 * sf, 0.114 * sf), 'UpperLeg.L'),
        'Foot.L': ((0.142 * sf, -0.100 * sf, 0.114 * sf), (0.158 * sf, -0.204 * sf, 0.020 * sf), 'LowerLeg.L'),
        'UpperLeg.R': ((-0.108 * sf, -0.086 * sf, 0.912 * sf), (-0.118 * sf, -0.068 * sf, 0.512 * sf), 'Hips'),
        'LowerLeg.R': ((-0.118 * sf, -0.068 * sf, 0.512 * sf), (-0.142 * sf, -0.100 * sf, 0.114 * sf), 'UpperLeg.R'),
        'Foot.R': ((-0.142 * sf, -0.100 * sf, 0.114 * sf), (-0.158 * sf, -0.204 * sf, 0.020 * sf), 'LowerLeg.R'),
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

    # 5. Build Smooth Game Animations (Idle, Walk, Run, Combo1, Combo2, Combo3, Sheathe)
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

    # =========================================================================
    # ACTION 1: Idle (48 frames, 2.0s loop @ 24fps)
    # Noble elven stance identical to archer: calm chest breathing, arms close along sides
    # =========================================================================
    idle_act = bpy.data.actions.new(name="Idle")
    arm.animation_data.action = idle_act

    for frame in range(1, 49):
        t = (frame - 1) / 47.0
        breath = math.sin(t * math.pi * 2)
        sway = math.cos(t * math.pi * 2)

        set_rot('Spine', -0.5 + breath * 0.8, sway * 0.2, 0, frame)
        set_rot('Chest', -0.5 + breath * 1.2, -sway * 0.3, 0, frame)
        set_rot('Head', 0.5 - breath * 0.5, sway * 0.2, 0, frame)

        # Arms resting along sides: UpperArm adducts by 29 deg
        set_rot('UpperArm.L', -1.0 + breath * 0.4, 0, 29.0 + sway * 0.4, frame)
        set_rot('ForeArm.L', -3.0, 0, 0, frame)
        set_rot('Hand.L', 0, 0, 0, frame)

        set_rot('UpperArm.R', -1.0 + breath * 0.4, 0, -29.0 - sway * 0.4, frame)
        set_rot('ForeArm.R', -3.0, 0, 0, frame)
        set_rot('Hand.R', 0, 0, 0, frame)

        # Legs brought together into graceful parallel stance (rz = 4.5 / -4.5)
        set_rot('UpperLeg.L', 0, 0, 4.5, frame)
        set_rot('LowerLeg.L', 2.0, 0, -0.5, frame)
        set_rot('Foot.L', -2.0, 0, -4.0, frame)
        set_rot('UpperLeg.R', 0, 0, -4.5, frame)
        set_rot('LowerLeg.R', 2.0, 0, 0.5, frame)
        set_rot('Foot.R', -2.0, 0, 4.0, frame)

        set_pos('Hips', 0, sway * 0.003, breath * 0.008, frame)
        set_rot('Hips', 0, sway * 0.4, 0, frame)

    # =========================================================================
    # ACTION 2: Walk (40 frames, 1.66s loop @ 24fps)
    # Full authentic humanoid walk stride identical to archer
    # =========================================================================
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

    # =========================================================================
    # ACTION 3: Run (24 frames, 1.0s loop @ 24fps)
    # Powerful athletic elven sprint identical to archer
    # =========================================================================
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

    # =========================================================================
    # ACTION 4: Attack1_HorizontalSlash (32 frames / 1.33s @ 24fps)
    # Combo 0: Heavy, wide 210-degree sweeping cleave with full body torque
    # =========================================================================
    atk1_act = bpy.data.actions.new(name="Attack1_HorizontalSlash")
    arm.animation_data.action = atk1_act

    for frame in range(1, 33):
        p = (frame - 1) / 31.0
        
        if p <= 0.32:
            # Phase 1: Heavy Windup & Coil (frames 1-10)
            w = p / 0.32
            # Coil torso deep to the right
            set_rot('Hips', 0, -w * 14.0, 0, frame)
            set_rot('Spine', -w * 3.0, -w * 22.0, 0, frame)
            set_rot('Chest', -w * 5.0, -w * 32.0, 0, frame)
            set_rot('Head', 0, w * 16.0, 0, frame)

            # Cock greatsword arm far back across right flank
            set_rot('UpperArm.R', -w * 45.0, w * 48.0, -28.0 - w * 18.0, frame)
            set_rot('ForeArm.R', -4.0 - w * 82.0, 0, 0, frame)
            set_rot('Hand.R', 0, w * 28.0, 0, frame)

            # Left arm balances forward across chest
            set_rot('UpperArm.L', -w * 32.0, 0, 28.0 - w * 10.0, frame)
            set_rot('ForeArm.L', -4.0 - w * 30.0, 0, 0, frame)
            set_pos('Hips', 0, -w * 0.03, -w * 0.01, frame)

        elif p <= 0.62:
            # Phase 2: Massive 210-degree Horizontal Cleave (frames 11-19)
            w = (p - 0.32) / 0.30
            # Torso uncoils with devastating rotational momentum from right (-32 deg) to left (+36 deg)
            yaw = -32.0 + w * 68.0
            set_rot('Hips', 0, -14.0 + w * 28.0, 0, frame)
            set_rot('Spine', -3.0 + w * 5.0, -22.0 + w * 44.0, 0, frame)
            set_rot('Chest', -5.0 + w * 8.0, yaw, 0, frame)
            set_rot('Head', 0, 16.0 - w * 32.0, 0, frame)

            # Powerful full-extension sweep cutting across entire frontal semicircle
            set_rot('UpperArm.R', -45.0 + w * 30.0, 48.0 - w * 96.0, -46.0 + w * 84.0, frame)
            set_rot('ForeArm.R', -86.0 + w * 74.0, 0, 0, frame)
            set_rot('Hand.R', 0, 28.0 - w * 56.0, 0, frame)

            set_rot('UpperArm.L', -32.0 + w * 18.0, 0, 18.0 + w * 16.0, frame)
            set_rot('ForeArm.L', -34.0 + w * 15.0, 0, 0, frame)
            set_pos('Hips', 0, -0.03 + w * 0.06, -0.01 + w * 0.02, frame)

        else:
            # Phase 3: Weighted Follow-Through & Return to Combat Stance (frames 20-32)
            w = (p - 0.62) / 0.38
            set_rot('Hips', 0, 14.0 * (1.0 - w), 0, frame)
            set_rot('Spine', 2.0 * (1.0 - w), 22.0 * (1.0 - w), 0, frame)
            set_rot('Chest', 3.0 * (1.0 - w), 36.0 * (1.0 - w), 0, frame)
            set_rot('Head', 0, -16.0 * (1.0 - w), 0, frame)

            set_rot('UpperArm.R', -15.0 * (1.0 - w) - 1.0 * w, -48.0 * (1.0 - w), 38.0 * (1.0 - w) - 28.0 * w, frame)
            set_rot('ForeArm.R', -12.0 * (1.0 - w) - 4.0 * w, 0, 0, frame)
            set_rot('Hand.R', 0, -28.0 * (1.0 - w), 0, frame)

            set_rot('UpperArm.L', -14.0 * (1.0 - w) - 1.0 * w, 0, 34.0 * (1.0 - w) + 28.0 * w, frame)
            set_rot('ForeArm.L', -19.0 * (1.0 - w) - 4.0 * w, 0, 0, frame)
            set_pos('Hips', 0, 0.03 * (1.0 - w), 0.01 * (1.0 - w), frame)

        # Wide athletic stance throughout swing
        set_rot('UpperLeg.L', 0, 0, 4.0, frame)
        set_rot('LowerLeg.L', 4.0, 0, -0.5, frame)
        set_rot('Foot.L', -2.0, 0, -3.5, frame)
        set_rot('UpperLeg.R', 0, 0, -4.0, frame)
        set_rot('LowerLeg.R', 4.0, 0, 0.5, frame)
        set_rot('Foot.R', -2.0, 0, 3.5, frame)

    # =========================================================================
    # ACTION 5: Attack2_DiagonalSlash (32 frames / 1.33s @ 24fps)
    # Combo 1: Low crouch into explosive rising diagonal uppercut cleave
    # =========================================================================
    atk2_act = bpy.data.actions.new(name="Attack2_DiagonalSlash")
    arm.animation_data.action = atk2_act

    for frame in range(1, 33):
        p = (frame - 1) / 31.0
        
        if p <= 0.32:
            # Phase 1: Deep Athletic Crouch Windup (frames 1-10)
            w = p / 0.32
            set_pos('Hips', 0, -w * 0.02, -w * 0.08, frame) # Dip down 8cm
            set_rot('Hips', 0, w * 16.0, 0, frame)
            set_rot('Spine', 0, w * 20.0, 0, frame)
            set_rot('Chest', w * 6.0, w * 28.0, 0, frame)
            set_rot('Head', 0, -w * 14.0, 0, frame)

            # Drop greatsword low near left knee
            set_rot('UpperArm.R', w * 35.0, -w * 32.0, -28.0 + w * 12.0, frame)
            set_rot('ForeArm.R', -4.0 - w * 62.0, 0, 0, frame)
            set_rot('Hand.R', 0, -w * 22.0, 0, frame)

            set_rot('UpperArm.L', -w * 22.0, 0, 28.0 + w * 8.0, frame)
            set_rot('ForeArm.L', -4.0 - w * 25.0, 0, 0, frame)

        elif p <= 0.62:
            # Phase 2: Explosive Rising Diagonal Cleave (frames 11-19)
            w = (p - 0.32) / 0.30
            # Thrust upward from crouch (+0.10m elevation lift)
            set_pos('Hips', 0, -0.02 + w * 0.04, -0.08 + w * 0.12, frame)
            set_rot('Hips', 0, 16.0 - w * 32.0, 0, frame)
            set_rot('Spine', 6.0 - w * 12.0, 20.0 - w * 42.0, 0, frame)
            set_rot('Chest', 6.0 - w * 20.0, 28.0 - w * 60.0, 0, frame)
            set_rot('Head', 0, -14.0 + w * 28.0, 0, frame)

            # Drive blade violently upwards from low-left to high-right
            set_rot('UpperArm.R', 35.0 - w * 120.0, -32.0 + w * 82.0, -16.0 - w * 26.0, frame)
            set_rot('ForeArm.R', -66.0 + w * 52.0, 0, 0, frame)
            set_rot('Hand.R', 0, -22.0 + w * 44.0, 0, frame)

            set_rot('UpperArm.L', -22.0 + w * 8.0, 0, 36.0 - w * 14.0, frame)
            set_rot('ForeArm.L', -29.0 + w * 12.0, 0, 0, frame)

        else:
            # Phase 3: Apex Float & Return to Guard (frames 20-32)
            w = (p - 0.62) / 0.38
            set_pos('Hips', 0, 0.02 * (1.0 - w), 0.04 * (1.0 - w), frame)
            set_rot('Hips', 0, -16.0 * (1.0 - w), 0, frame)
            set_rot('Spine', -6.0 * (1.0 - w), -22.0 * (1.0 - w), 0, frame)
            set_rot('Chest', -14.0 * (1.0 - w), -32.0 * (1.0 - w), 0, frame)
            set_rot('Head', 0, 14.0 * (1.0 - w), 0, frame)

            set_rot('UpperArm.R', -85.0 * (1.0 - w) - 1.0 * w, 50.0 * (1.0 - w), -42.0 * (1.0 - w) - 28.0 * w, frame)
            set_rot('ForeArm.R', -14.0 * (1.0 - w) - 4.0 * w, 0, 0, frame)
            set_rot('Hand.R', 0, 22.0 * (1.0 - w), 0, frame)

            set_rot('UpperArm.L', -14.0 * (1.0 - w) - 1.0 * w, 0, 22.0 * (1.0 - w) + 28.0 * w, frame)
            set_rot('ForeArm.L', -17.0 * (1.0 - w) - 4.0 * w, 0, 0, frame)

        # Lower body stance
        set_rot('UpperLeg.L', 0, 0, 3.5, frame)
        set_rot('LowerLeg.L', 4.0, 0, -0.5, frame)
        set_rot('Foot.L', -2.0, 0, -3.0, frame)
        set_rot('UpperLeg.R', 0, 0, -3.5, frame)
        set_rot('LowerLeg.R', 4.0, 0, 0.5, frame)
        set_rot('Foot.R', -2.0, 0, 3.0, frame)

    # =========================================================================
    # ACTION 6: Attack3_VerticalCleave (36 frames / 1.50s @ 24fps)
    # Combo 2: Heroic airborne leap (+0.24m jump!) & crushing 2-handed vertical executioner cleave
    # =========================================================================
    atk3_act = bpy.data.actions.new(name="Attack3_VerticalCleave")
    arm.animation_data.action = atk3_act

    for frame in range(1, 37):
        p = (frame - 1) / 35.0

        if p <= 0.38:
            # Phase 1: Airborne Leap & 2-Handed Overhead Raise (frames 1-13)
            w = p / 0.38
            # Jump hop up 0.24m!
            hop = math.sin(w * math.pi * 0.5) * 0.24
            set_pos('Hips', 0, w * 0.05, hop, frame)

            set_rot('Hips', -w * 12.0, 0, 0, frame)
            set_rot('Spine', -w * 14.0, 0, 0, frame)
            set_rot('Chest', -w * 22.0, 0, 0, frame)
            set_rot('Head', w * 16.0, 0, 0, frame)

            # Both hands raise high above helmet in 2-handed overhead grip
            set_rot('UpperArm.R', -w * 122.0, 0, -28.0 + w * 14.0, frame)
            set_rot('ForeArm.R', -4.0 - w * 78.0, 0, 0, frame)

            set_rot('UpperArm.L', -w * 118.0, 0, 28.0 - w * 6.0, frame)
            set_rot('ForeArm.L', -4.0 - w * 78.0, 0, 0, frame)

            # Tuck legs up during airborne flight
            set_rot('UpperLeg.L', -w * 24.0, 0, 3.5, frame)
            set_rot('LowerLeg.L', 4.0 + w * 42.0, 0, -0.5, frame)
            set_rot('Foot.L', -2.0 - w * 14.0, 0, -3.0, frame)

            set_rot('UpperLeg.R', -w * 24.0, 0, -3.5, frame)
            set_rot('LowerLeg.R', 4.0 + w * 42.0, 0, 0.5, frame)
            set_rot('Foot.R', -2.0 - w * 14.0, 0, 3.0, frame)

        elif p <= 0.64:
            # Phase 2: Crushing Downward Cleave & Earth-Shattering Impact (frames 14-22)
            w = (p - 0.38) / 0.26
            hop = (1.0 - w) * 0.24
            set_pos('Hips', 0, 0.05 - w * 0.03, hop, frame)

            # Torso pitches forcefully forward with full body mass
            set_rot('Hips', -12.0 + w * 24.0, 0, 0, frame)
            set_rot('Spine', -14.0 + w * 32.0, 0, 0, frame)
            set_rot('Chest', -22.0 + w * 50.0, 0, 0, frame)
            set_rot('Head', 16.0 - w * 22.0, 0, 0, frame)

            # Both arms slam straight down with immense force
            set_rot('UpperArm.R', -122.0 + w * 110.0, 0, -14.0 + w * 8.0, frame)
            set_rot('ForeArm.R', -82.0 + w * 76.0, 0, 0, frame)

            set_rot('UpperArm.L', -118.0 + w * 106.0, 0, 22.0 - w * 8.0, frame)
            set_rot('ForeArm.L', -82.0 + w * 76.0, 0, 0, frame)

            # Wide solid foot plant, knees absorb shock
            set_rot('UpperLeg.L', -24.0 + w * 34.0, 0, 4.0, frame)
            set_rot('LowerLeg.L', 46.0 - w * 26.0, 0, -0.5, frame)
            set_rot('Foot.L', -16.0 + w * 14.0, 0, -3.5, frame)

            set_rot('UpperLeg.R', -24.0 + w * 34.0, 0, -4.0, frame)
            set_rot('LowerLeg.R', 46.0 - w * 26.0, 0, 0.5, frame)
            set_rot('Foot.R', -16.0 + w * 14.0, 0, 3.5, frame)

        else:
            # Phase 3: Impact Recovery & Rise to Stance (frames 23-36)
            w = (p - 0.64) / 0.36
            set_pos('Hips', 0, 0.02 * (1.0 - w), 0, frame)

            set_rot('Hips', 12.0 * (1.0 - w), 0, 0, frame)
            set_rot('Spine', 18.0 * (1.0 - w), 0, 0, frame)
            set_rot('Chest', 28.0 * (1.0 - w), 0, 0, frame)
            set_rot('Head', -6.0 * (1.0 - w), 0, 0, frame)

            set_rot('UpperArm.R', -12.0 * (1.0 - w) - 1.0 * w, 0, -6.0 * (1.0 - w) - 28.0 * w, frame)
            set_rot('ForeArm.R', -6.0 * (1.0 - w) - 4.0 * w, 0, 0, frame)

            set_rot('UpperArm.L', -12.0 * (1.0 - w) - 1.0 * w, 0, 14.0 * (1.0 - w) + 28.0 * w, frame)
            set_rot('ForeArm.L', -6.0 * (1.0 - w) - 4.0 * w, 0, 0, frame)

            set_rot('UpperLeg.L', 10.0 * (1.0 - w), 0, 3.0, frame)
            set_rot('LowerLeg.L', 20.0 * (1.0 - w) + 2.0 * w, 0, -0.5, frame)
            set_rot('Foot.L', -2.0, 0, -2.5, frame)

            set_rot('UpperLeg.R', 10.0 * (1.0 - w), 0, -3.0, frame)
            set_rot('LowerLeg.R', 20.0 * (1.0 - w) + 2.0 * w, 0, 0.5, frame)
            set_rot('Foot.R', -2.0, 0, 2.5, frame)

    # Alias for Attack3_Thrust
    atk3_thrust = atk3_act.copy()
    atk3_thrust.name = "Attack3_Thrust"

    # =========================================================================
    # ACTION 7: Sheathe (28 frames / 1.16s @ 24fps)
    # Knight smoothly guides greatsword to right shoulder, inserts blade into back scabbard, lowers empty arm
    # =========================================================================
    sheathe_act = bpy.data.actions.new(name="Sheathe")
    arm.animation_data.action = sheathe_act

    for frame in range(1, 29):
        p = (frame - 1) / 27.0

        if p <= 0.50:
            # Phase 1 (frames 1-14): Hand guides sword hilt up to back scabbard socket
            w = p / 0.50
            set_rot('Spine', -w * 2.0, -w * 8.0, 0, frame)
            set_rot('Chest', -w * 4.0, -w * 14.0, 0, frame)
            set_rot('Head', 0, w * 10.0, 0, frame)

            # Right arm raises to right shoulder scabbard entrance
            set_rot('UpperArm.R', -w * 48.0, w * 28.0, -28.0 - w * 12.0, frame)
            set_rot('ForeArm.R', -4.0 - w * 72.0, 0, 0, frame)
            set_rot('Hand.R', 0, w * 15.0, 0, frame)

            set_rot('UpperArm.L', -w * 12.0, 0, 28.0, frame)
            set_rot('ForeArm.L', -4.0, 0, 0, frame)

        else:
            # Phase 2 (frames 15-28): Sword is docked; right hand releases hilt and lowers smoothly
            w = (p - 0.50) / 0.50
            set_rot('Spine', -2.0 * (1.0 - w), -8.0 * (1.0 - w), 0, frame)
            set_rot('Chest', -4.0 * (1.0 - w), -14.0 * (1.0 - w), 0, frame)
            set_rot('Head', 0, 10.0 * (1.0 - w), 0, frame)

            set_rot('UpperArm.R', -48.0 * (1.0 - w) - 1.0 * w, 28.0 * (1.0 - w), -40.0 * (1.0 - w) - 28.0 * w, frame)
            set_rot('ForeArm.R', -76.0 * (1.0 - w) - 4.0 * w, 0, 0, frame)
            set_rot('Hand.R', 0, 15.0 * (1.0 - w), 0, frame)

            set_rot('UpperArm.L', -12.0 * (1.0 - w) - 1.0 * w, 0, 28.0, frame)
            set_rot('ForeArm.L', -4.0, 0, 0, frame)

        set_rot('UpperLeg.L', 0, 0, 3.0, frame)
        set_rot('LowerLeg.L', 2.0, 0, -0.5, frame)
        set_rot('Foot.L', -2.0, 0, -2.5, frame)
        set_rot('UpperLeg.R', 0, 0, -3.0, frame)
        set_rot('LowerLeg.R', 2.0, 0, 0.5, frame)
        set_rot('Foot.R', -2.0, 0, 2.5, frame)

    # Push all NLA tracks so glTF exporter includes all clips
    actions = [idle_act, walk_act, run_act, atk1_act, atk2_act, atk3_act, atk3_thrust, sheathe_act]
    for act in actions:
        track = arm.animation_data.nla_tracks.new()
        track.name = act.name
        track.strips.new(act.name, 1, act)

    print(f"Exporting rigged & animated GLB to: {output_glb}")
    os.makedirs(os.path.dirname(os.path.abspath(output_glb)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output_glb,
        export_format='GLB',
        use_selection=False,
        export_apply=False,
        export_animations=True,
        export_nla_strips=True,
        export_current_frame=False,
    )
    print("SUCCESS: Rigged & animated Elven Swordsman exported!")

if __name__ == '__main__':
    import sys
    pattern = r"D:\ComfyUIData\output\3d\*Swordsman*.glb"
    matches = glob.glob(pattern)
    if matches:
        in_glb = matches[0]
    else:
        in_glb = r"D:\ComfyUIData\output\3d\ElvenSwordsman_00001.glb"
    out_glb = r"c:\Users\Dakado\Desktop\dakadoro\Kaldgard Online\public\models\elven_swordsman_animated.glb"

    rig_and_animate(in_glb, out_glb)
