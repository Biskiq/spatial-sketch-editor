// RR-3/5/6 Probe 2 — synthesize one tiny, truthful positive part/capability fixture.
// Disposable research input, written with the already-installed @gltf-transform 4.4.1 (no download).
// Usage (repo root): node broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/capability/make_fixture.mjs
//
// Specimen hierarchy (node order is the authored order):
//   Specimen (group)
//   ├─ Body        mesh, extras {partHint}, material Default + KHR_materials_variants Walnut/Ebony
//   ├─ LidHinge    group at y=1 (explicit pivot) → Lid mesh
//   ├─ Foot        mesh at x=-0.3  ┐ duplicate node names sharing one mesh
//   ├─ Foot        mesh at x=+0.3  ┘
//   └─ Anchor.Dial empty leaf with extras {note} (an author's annotation marker)
// Animation LidOpen: LidHinge rotation, two LINEAR keys at 0 s and 1 s.
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsVariants } from '@gltf-transform/extensions';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('./fixtures/part-specimen.glb', import.meta.url));
mkdirSync(fileURLToPath(new URL('./fixtures/', import.meta.url)), { recursive: true });

const doc = new Document();
doc.createBuffer();
const variantsExt = doc.createExtension(KHRMaterialsVariants);

const tri = (name) => {
	const position = doc.createAccessor(`${name}-pos`).setType('VEC3').setArray(new Float32Array([0, 0, 0, 0.2, 0, 0, 0, 0.2, 0]));
	return position;
};
const mDefault = doc.createMaterial('Default').setBaseColorFactor([0.8, 0.8, 0.8, 1]);
const mWalnut = doc.createMaterial('Walnut').setBaseColorFactor([0.36, 0.22, 0.12, 1]);
const mEbony = doc.createMaterial('Ebony').setBaseColorFactor([0.05, 0.04, 0.04, 1]);

const bodyPrim = doc.createPrimitive().setAttribute('POSITION', tri('body')).setMaterial(mDefault);
const walnut = variantsExt.createVariant('Walnut');
const ebony = variantsExt.createVariant('Ebony');
bodyPrim.setExtension(
	'KHR_materials_variants',
	variantsExt
		.createMappingList()
		.addMapping(variantsExt.createMapping().addVariant(walnut).setMaterial(mWalnut))
		.addMapping(variantsExt.createMapping().addVariant(ebony).setMaterial(mEbony))
);
const bodyMesh = doc.createMesh('BodyMesh').addPrimitive(bodyPrim);
const lidMesh = doc.createMesh('LidMesh').addPrimitive(doc.createPrimitive().setAttribute('POSITION', tri('lid')).setMaterial(mDefault));
const footMesh = doc.createMesh('FootMesh').addPrimitive(doc.createPrimitive().setAttribute('POSITION', tri('foot')).setMaterial(mDefault));

const body = doc.createNode('Body').setMesh(bodyMesh).setExtras({ partHint: 'body' });
const lid = doc.createNode('Lid').setMesh(lidMesh);
const hinge = doc.createNode('LidHinge').setTranslation([0, 1, 0]).addChild(lid);
const footA = doc.createNode('Foot').setMesh(footMesh).setTranslation([-0.3, 0, 0]);
const footB = doc.createNode('Foot').setMesh(footMesh).setTranslation([0.3, 0, 0]);
const anchor = doc.createNode('Anchor.Dial').setTranslation([0, 0.8, 0.2]).setExtras({ note: 'author annotation marker' });
const root = doc.createNode('Specimen').addChild(body).addChild(hinge).addChild(footA).addChild(footB).addChild(anchor);
doc.createScene('Specimen').addChild(root);

const times = doc.createAccessor('lid-t').setType('SCALAR').setArray(new Float32Array([0, 1]));
const rots = doc.createAccessor('lid-r').setType('VEC4').setArray(new Float32Array([0, 0, 0, 1, -0.7071068, 0, 0, 0.7071068]));
const sampler = doc.createAnimationSampler().setInput(times).setOutput(rots).setInterpolation('LINEAR');
const channel = doc.createAnimationChannel().setTargetNode(hinge).setTargetPath('rotation').setSampler(sampler);
doc.createAnimation('LidOpen').addSampler(sampler).addChannel(channel);

await new NodeIO().registerExtensions([KHRMaterialsVariants]).write(out, doc);
console.log(out);
