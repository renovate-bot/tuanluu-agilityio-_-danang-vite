"""/* ===== Xử lý mô hình VinFast VF 3 (Sketchfab, CC BY 4.0) thành public/car/vf3.glb cho chế độ Lái xe (D-034) ===== */

Cách chạy (máy người phát triển, không cần cho build):
    npm run gen:car
    # tức: node scripts/people/blender.mjs scripts/car/convert.py   (Blender 4.5; không ở đường dẫn mặc định thì đặt biến BLENDER)
    # bỏ ảnh xem trước:  npm run gen:car -- -- --no-preview   (npm nuốt dấu -- đầu; blender.mjs chuyển phần còn lại sau tên script
    #                    cho Blender, nên tham số của script phải đứng sau dấu -- thứ hai; hoặc: node scripts/people/blender.mjs scripts/car/convert.py -- --no-preview)

Nguồn: scripts/car/vinfast_vf3.glb (tải từ Sketchfab, tác giả Hoàng Huy, CC-BY-4.0; ghi nguồn ở public/car/LICENSE-VF3.txt).
Mô hình thô: 10 lưới, mũi xe hướng -Y (Blender, sau khi nạp glb), 2,41 m dài; bánh là lưới vật liệu BANH (4 nhóm cụm rời)
cùng mâm Material.003 và các mảnh DEN_NHAM nằm trong hộp bánh; hai tấm biển số (Object_12, Object_13: Material.005,
Material.004) dán ảnh JPEG 2 MB mỗi tấm. Script làm:
    1. xoá hai lưới biển số + vật liệu + ảnh chỉ dùng cho chúng (logo chữ V và chữ VF3 nằm trong ảnh của vật liệu TRUOC /
       material, không phải biển số, nên giữ nguyên);
    2. gộp mọi lưới ở toạ độ thế giới, tách bốn bánh: thành phần liên thông (theo đỉnh) nào nằm trọn trong hộp quanh một
       bánh (tâm theo hộp bao các cụm BANH, |x| từ mép trong lốp ra ngoài) thì thuộc bánh đó; phần còn lại là `body`;
    3. đổi hướng: mũi +X, trục bánh = Y Blender (= Z glTF), phóng đều để dài đúng 3,19 m, gốc ở giữa hai trục, đáy lốp y = 0;
    4. nút: `vf3` (rỗng) -> `body`, `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr` (gốc ở tâm bánh);
    5. đổi tên vật liệu: Material.001 -> paint (sơn thân), TRUOC -> lamp_head (mặt đèn trước, có emissive), material -> lamp_tail
       (mặt đèn sau). Nguồn không có vật liệu đèn riêng ngoài hai tấm này: mỗi tấm là ảnh dán chứa cả đèn, logo V và (sau) chữ
       VF3, nên lamp_* gồm cả logo (người dùng giữ logo);
    6. gọn dung lượng: cạnh dài ảnh <= 1024; ảnh có alpha giữ PNG, ảnh còn lại JPEG chất lượng 85; bỏ bộ UV thứ hai (lightmap nguồn);
       bốn bánh giống hệt nhau nên dùng chung một lưới (bánh bên phải xoay 180 độ quanh trục đứng);
    7. gộp hai vật liệu đen giống hệt nhau (Material, DEN_NHAM: đen, metallic 0, roughness 0,5) thành DEN_NHAM trước khi tách,
       để `body` còn <= 5 primitive (= lệnh vẽ) và mỗi lưới bánh <= 3.
Giao diện cho bên dùng (Task 6, chiều quay bánh): wheel_fl, wheel_rl không xoay; wheel_fr, wheel_rr xoay 180 độ quanh Y (dùng chung
lưới), nên Z cục bộ của hai bánh phải hướng -Z thế giới. Cùng một góc quay quanh Z cục bộ làm bánh phải lăn NGƯỢC: bánh trái
quay góc +theta thì bánh phải phải quay góc -theta (xe tiến thì theta = quãng đường / bán kính theo chiều đã chọn cho bánh trái).
Cuối script nạp lại chính file glb đầu ra, in bảng (tam giác, byte, hộp bao từng nút) và vẽ ảnh xem trước vào
scripts/car/.cache/preview/{front,rear,side,night}.png.
"""
import bpy, bmesh, os, sys, math
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

# ===== Đường dẫn, thông số =====
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(HERE, 'vinfast_vf3.glb')
OUT = os.path.join(REPO, 'public', 'car', 'vf3.glb')
PREV = os.path.join(HERE, '.cache', 'preview')
LENGTH = 3.19               # m, chiều dài VF 3 (CONFIG.drive.car.length)
TEX_MAX = 1024              # px, cạnh dài tối đa của ảnh
JPEG_Q = 85                 # chất lượng JPEG
PLATE_MATS = ('Material.004', 'Material.005')     # hai biển số (Object_13, Object_12)
RENAME = {'Material.001': 'paint', 'TRUOC': 'lamp_head', 'material': 'lamp_tail'}
WHEEL_PAD = 0.03            # m, nới hộp bánh quanh hộp bao các cụm BANH (đơn vị thô, trước phóng)
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []     # tham số của script: chỉ phần sau dấu --
NO_PREVIEW = '--no-preview' in ARGV


# ===== Nạp, bỏ biển số, gộp =====
def bsdf(m):
    nd = [n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']
    assert len(nd) == 1 and not nd[0].inputs['Base Color'].links, f'vật liệu {m.name} không đơn giản'
    i = nd[0].inputs
    return tuple(i['Base Color'].default_value) + (i['Metallic'].default_value, i['Roughness'].default_value) + tuple(i['Emission Color'].default_value) + (i['Emission Strength'].default_value, i['Alpha'].default_value)


def merge_blacks():
    """Gán mặt dùng `Material` sang `DEN_NHAM` khi hai vật liệu cùng thông số (không thì dừng)"""
    a, b = bpy.data.materials['Material'], bpy.data.materials['DEN_NHAM']
    pa, pb = bsdf(a), bsdf(b)
    assert all(abs(x - y) < 1e-4 for x, y in zip(pa, pb)), f'Material và DEN_NHAM khác thông số, không gộp được: {pa} / {pb}'
    for o in bpy.data.objects:
        if o.type != 'MESH' or a.name not in [m.name if m else '' for m in o.data.materials]: continue
        ia = [m.name if m else '' for m in o.data.materials].index('Material')
        if 'DEN_NHAM' not in [m.name if m else '' for m in o.data.materials]: o.data.materials.append(b)
        ib = [m.name if m else '' for m in o.data.materials].index('DEN_NHAM')
        for p in o.data.polygons:
            if p.material_index == ia: p.material_index = ib
    print('  gop Material -> DEN_NHAM', pa)


def load_and_join():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.data.materials[0].name in PLATE_MATS]:
        bpy.data.objects.remove(o, do_unlink=True)
    for n in PLATE_MATS: bpy.data.materials.remove(bpy.data.materials[n])
    for im in [im for im in bpy.data.images if im.users == 0]: bpy.data.images.remove(im)
    merge_blacks()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in meshes:                                           # bỏ cha, giữ vị trí thế giới
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    car = bpy.context.view_layer.objects.active
    for o in [o for o in bpy.data.objects if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
    return car


# ===== Thành phần liên thông (theo đỉnh) của lưới =====
def components(bm):
    comp = {}; out = []
    for v in bm.verts:
        if v.index in comp: continue
        st = [v]; comp[v.index] = len(out); vs = []
        while st:
            a = st.pop(); vs.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in comp: comp[b.index] = len(out); st.append(b)
        out.append(vs)
    return comp, out


def bbox(vs):
    return [min(v.co[i] for v in vs) for i in range(3)], [max(v.co[i] for v in vs) for i in range(3)]


# ===== Tách bốn bánh =====
def split_wheels(car):
    """Trả về (body, {k: đối tượng bánh}, {k: tâm bánh thô}); toạ độ thô: mũi -Y, trái +X"""
    bm = bmesh.new(); bm.from_mesh(car.data); bm.verts.ensure_lookup_table()
    comp, comps = components(bm)
    banh = next(i for i, m in enumerate(car.data.materials) if m.name == 'BANH')
    tires = sorted({comp[f.verts[0].index] for f in bm.faces if f.material_index == banh})
    boxes = [bbox(comps[c]) for c in tires]
    ymid = sum((a[1] + b[1]) / 2 for a, b in boxes) / len(boxes)
    quad = {}
    for mn, mx in boxes:
        k = ('f' if (mn[1] + mx[1]) / 2 < ymid else 'r') + ('l' if (mn[0] + mx[0]) / 2 > 0 else 'r')   # mũi -Y; trái +X
        quad.setdefault(k, []).append((mn, mx))
    assert sorted(quad) == ['fl', 'fr', 'rl', 'rr'], 'BANH không chia được thành bốn góc phần tư: ' + str({k: len(v) for k, v in quad.items()})
    cen, half, xin = {}, {}, {}
    for k, bs in quad.items():
        mn = [min(b[0][i] for b in bs) for i in range(3)]; mx = [max(b[1][i] for b in bs) for i in range(3)]
        cen[k] = Vector(((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2))
        half[k] = max(mx[1] - mn[1], mx[2] - mn[2]) / 2 + WHEEL_PAD
        xin[k] = min(abs(mn[0]), abs(mx[0]))
    # thành phần nào nằm trọn trong hộp bánh thì thuộc bánh đó
    owner = {}
    for ci, vs in enumerate(comps):
        mn, mx = bbox(vs)
        for k in cen:
            s = 1 if k[1] == 'l' else -1
            if (min(mn[0] * s, mx[0] * s) >= xin[k] - 0.01 and mn[1] >= cen[k].y - half[k] and mx[1] <= cen[k].y + half[k]
                    and mn[2] >= cen[k].z - half[k] and mx[2] <= cen[k].z + half[k]): owner[ci] = k; break
    code = {'fl': 1, 'fr': 2, 'rl': 3, 'rr': 4}
    lay = bm.faces.layers.int.new('own')                       # chủ của mặt, ghi một lần (chỉ số đỉnh đổi sau mỗi lần tách)
    for f in bm.faces: f[lay] = code.get(owner.get(comp[f.verts[0].index]), 0)
    bm.to_mesh(car.data); bm.free()
    parts = {}
    for k in ('fl', 'fr', 'rl', 'rr'):
        bpy.context.view_layer.objects.active = car
        bm = bmesh.new(); bm.from_mesh(car.data); bm.faces.ensure_lookup_table(); lay = bm.faces.layers.int['own']
        n = 0
        for f in bm.faces:
            f.select = f[lay] == code[k]; n += f.select
        bm.to_mesh(car.data); bm.free()
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
        w = [o for o in bpy.context.selected_objects if o != car][0]
        w.name = 'wheel_' + k; w.data.name = 'wheel_' + k; parts[k] = w
        bpy.ops.object.select_all(action='DESELECT'); car.select_set(True)
        print(f'  banh {k}: {n} mat, tam tho {tuple(round(c, 3) for c in cen[k])}')
    car.name = 'body'; car.data.name = 'body'
    return car, parts, cen


# ===== Đổi hướng / tỉ lệ / gốc, đặt cây nút, đổi tên vật liệu, thu ảnh =====
def tree(pts):
    t = KDTree(len(pts))
    for i, p in enumerate(pts): t.insert(p, i)
    t.balance(); return t


def far(pts, t):
    return max(t.find(p)[2] for p in pts)       # khoảng cách lớn nhất từ một điểm của pts tới điểm gần nhất trong cây t


def finish(body, wheels, cen):
    objs = [body] + list(wheels.values())
    ys = [v.co.y for o in objs for v in o.data.vertices]
    s = LENGTH / (max(ys) - min(ys))
    ox = sum(c.x for c in cen.values()) / 4; oy = sum(c.y for c in cen.values()) / 4
    zb = min(v.co.z for o in wheels.values() for v in o.data.vertices)         # đáy lốp
    T = Matrix.Scale(s, 4) @ Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Translation((-ox, -oy, -zb))
    for o in objs: o.data.transform(T)
    root = bpy.data.objects.new('vf3', None); bpy.context.scene.collection.objects.link(root)
    body.parent = root
    for k, w in wheels.items():                                 # đặt gốc ở tâm bánh
        c = T @ cen[k]
        w.data.transform(Matrix.Translation(-c)); w.location = c; w.parent = root
    # bốn bánh giống hệt nhau (kiểm bằng toạ độ đỉnh): dùng chung một lưới của bánh trái-trước, bánh bên phải xoay 180 độ quanh trục đứng
    ref = wheels['fl'].data
    for k, w in wheels.items():
        if k == 'fl': continue
        flip = k[1] == 'r'
        fx = -1 if flip else 1
        A = [Vector((fx * v.co.x, fx * v.co.y, v.co.z)) for v in w.data.vertices]; B = [v.co.copy() for v in ref.vertices]
        diff = max(far(A, tree(B)), far(B, tree(A)))       # lệch lớn nhất (hai chiều) giữa hai tập đỉnh
        print(f'  bánh {k} so với fl: lệch lớn nhất {diff:.4f} m')
        if diff < 0.002:
            old = w.data; w.data = ref; bpy.data.meshes.remove(old)
            if flip: w.rotation_mode = 'XYZ'; w.rotation_euler = (0, 0, math.pi)
    for o in objs:                                              # chỉ giữ bộ UV đầu (bộ sau là lightmap của nguồn, không dùng)
        while len(o.data.uv_layers) > 1: o.data.uv_layers.remove(o.data.uv_layers[len(o.data.uv_layers) - 1])
    for m in bpy.data.materials:
        if m.name in RENAME: m.name = RENAME[m.name]
    # ảnh: thu cạnh dài; ảnh có alpha (32 bit) giữ PNG, còn lại JPEG
    tmp = os.path.join(HERE, '.cache', 'tex'); os.makedirs(tmp, exist_ok=True)
    for im in list(bpy.data.images):
        if max(im.size) > TEX_MAX:
            r = TEX_MAX / max(im.size); im.scale(max(1, int(im.size[0] * r)), max(1, int(im.size[1] * r)))
        alpha = im.depth == 32
        path = os.path.join(tmp, im.name + ('.png' if alpha else '.jpg'))
        st = bpy.context.scene.render.image_settings; st.file_format = 'PNG' if alpha else 'JPEG'; st.quality = JPEG_Q; st.color_mode = 'RGBA' if alpha else 'RGB'
        im.save_render(path, scene=bpy.context.scene)                         # mã hoá lại thật (đổi file_format thôi thì xuất giữ byte PNG gốc)
        new = bpy.data.images.load(path); name = im.name; new.pack()
        for m in bpy.data.materials:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image == im: n.image = new
        bpy.data.images.remove(im); new.name = name
        print(f'  anh {name}: {new.size[0]}x{new.size[1]} -> {"PNG" if alpha else "JPEG"} {os.path.getsize(path)} byte')
    return s


def export():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True, export_image_format='AUTO',
                              export_jpeg_quality=JPEG_Q, export_cameras=False, export_lights=False, export_animations=False,
                              export_tangents=False, export_texcoords=True, export_normals=True)


# ===== Ảnh xem trước: nạp lại chính glb đầu ra =====
def preview():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=OUT)
    sc = bpy.context.scene
    os.makedirs(PREV, exist_ok=True)
    sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.render.resolution_x, sc.render.resolution_y = 800, 560
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.001)); pl = bpy.context.active_object      # mặt đường
    pm = bpy.data.materials.new('road'); pm.diffuse_color = (0.25, 0.25, 0.27, 1); pl.data.materials.append(pm)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    tgt = bpy.data.objects.new('tgt', None); tgt.location = (0, 0, 0.7); sc.collection.objects.link(tgt)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 40
    tc = cam.constraints.new('TRACK_TO'); tc.target = tgt; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
    for name, pos, day in (('front', (5.2, 2.2, 1.6), True), ('rear', (-5.2, -2.2, 1.6), True), ('side', (0.5, -6.0, 1.2), True), ('night', (5.2, 2.2, 1.0), False)):
        bg.inputs[0].default_value = (0.55, 0.65, 0.8, 1) if day else (0.01, 0.012, 0.02, 1)
        bg.inputs[1].default_value = 1.0 if day else 0.5
        sun.data.energy = 3.5 if day else 0.0
        cam.location = pos; sc.render.filepath = os.path.join(PREV, name + '.png'); bpy.ops.render.render(write_still=True)
        print('  anh xem truoc:', sc.render.filepath)


# ===== Bảng kết quả =====
def report():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=OUT)
    tris = 0
    for o in bpy.data.objects:
        if o.type == 'MESH':
            tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
            ws = [o.matrix_world @ v.co for v in o.data.vertices]
            print('  %-10s mat %5d  vl %s  x %.3f..%.3f  y %.3f..%.3f  z %.3f..%.3f' % (o.name, len(o.data.polygons), [m.name for m in o.data.materials], min(w.x for w in ws), max(w.x for w in ws), min(w.y for w in ws), max(w.y for w in ws), min(w.z for w in ws), max(w.z for w in ws)))
        else: print('  nut', o.name, tuple(round(c, 3) for c in o.matrix_world.translation))
    print('  tong tam giac', tris, ' byte', os.path.getsize(OUT))


car = load_and_join()
body, wheels, cen = split_wheels(car)
s = finish(body, wheels, cen)
print(f'  phong deu x{s:.4f}')
export()
report()
if not NO_PREVIEW: preview()
