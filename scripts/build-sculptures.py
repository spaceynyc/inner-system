"""Author the three hollow, individually articulated glass sculptures in Blender.

Run: blender --background --python scripts/build-sculptures.py
Original procedural artwork for THE INNER SYSTEM. No external model assets.
"""
import bpy
import bmesh
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
(ROOT / 'art').mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

glass = bpy.data.materials.new('Midnight optical glass')
glass.use_nodes = True
bsdf = glass.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (0.76, 0.82, 1.0, 1.0)
bsdf.inputs['Roughness'].default_value = 0.065
bsdf.inputs['IOR'].default_value = 1.46
bsdf.inputs['Transmission Weight'].default_value = 1.0
bsdf.inputs['Coat Weight'].default_value = 0.75

bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.72)
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()
ico_v = [v.co.copy() for v in bm.verts]
ico_f = [[v.index for v in face.verts] for face in bm.faces]
bm.free()

def ordered_face(indices, verts, normal):
    center = sum((verts[i] for i in indices), Vector()) / len(indices)
    u = (verts[indices[0]] - center).normalized()
    v = normal.cross(u).normalized()
    return sorted(indices, key=lambda i: math.atan2((verts[i] - center).dot(v), (verts[i] - center).dot(u)))

dual_v = [(sum((ico_v[i] for i in face), Vector()) / 3).normalized() * 1.72 for face in ico_f]
dual_f = []
for i, vertex in enumerate(ico_v):
    adjacent = [j for j, face in enumerate(ico_f) if i in face]
    dual_f.append(ordered_face(adjacent, dual_v, vertex.normalized()))

oct_v = [Vector(p) * 1.85 for p in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]]
oct_f = [(0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)]

for name, verts, faces in [('icosahedron', ico_v, ico_f), ('dodecahedron', dual_v, dual_f), ('octahedron', oct_v, oct_f)]:
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    objects = []
    for index, face in enumerate(faces):
        center = sum((verts[i] for i in face), Vector()) / len(face)
        coords = [(verts[i] - center) * 0.992 for i in face]
        # Correct outward orientation before solidification.
        normal = (coords[1] - coords[0]).cross(coords[2] - coords[0])
        if normal.dot(center) < 0:
            coords.reverse()
        mesh = bpy.data.meshes.new(f'{name}_facet_{index:02d}')
        mesh.from_pydata(coords, [], [list(range(len(coords)))])
        mesh.update()
        obj = bpy.data.objects.new(f'facet_{index:02d}', mesh)
        collection.objects.link(obj)
        obj.location = center
        obj.data.materials.append(glass)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        solidify = obj.modifiers.new('Optical thickness', 'SOLIDIFY')
        solidify.thickness = 0.145
        solidify.offset = -1.0
        bevel = obj.modifiers.new('Polished edges', 'BEVEL')
        bevel.width = 0.065
        bevel.segments = 5
        bevel.affect = 'EDGES'
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        # Flat broad facets with smooth micro-bevels preserve the optical silhouette.
        for polygon in obj.data.polygons:
            polygon.use_smooth = polygon.area < 0.16
        weighted = obj.modifiers.new('Facet normals', 'WEIGHTED_NORMAL')
        weighted.keep_sharp = True
        weighted.weight = 50
        bpy.ops.object.modifier_apply(modifier=weighted.name)
        obj.select_set(False)
        objects.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / f'{name}.glb'), export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    for obj in objects:
        obj.select_set(False)
    print(f'EXPORTED {name}: {len(objects)} optical facets')

for collection in bpy.data.collections:
    if collection.name in ('dodecahedron', 'octahedron'):
        collection.hide_viewport = True
        collection.hide_render = True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'art' / 'inner-system-sculptures.blend'))
print('Sculpture authoring complete.')
