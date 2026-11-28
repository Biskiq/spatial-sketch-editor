#!/usr/bin/env node
/**
 * D8c.1 probe derivatives.
 *
 * Reads the retained Poly Haven 1K sets from D8C_RETENTION and writes:
 *   <slug>/probe-stripped.glb  — every material's baked emission removed (P2)
 *
 * Sources are never modified. Nothing here is a production asset: the probe
 * GLBs stay in the retention store and are served to the local harness only.
 */
import { NodeIO } from '@gltf-transform/core';
import {
	KHRMaterialsEmissiveStrength,
	KHRMaterialsTransmission
} from '@gltf-transform/extensions';
import { join } from 'node:path';
import { existsSync, statSync } from 'node:fs';

const ROOT = process.env.D8C_RETENTION;
if (!ROOT) throw new Error('D8C_RETENTION must name the fixture retention store');
const SLUGS = [
  'hanging_industrial_lamp',
  'modern_ceiling_lamp_01',
  'lantern_chandelier_01',
  'industrial_wall_sconce',
];

const io = new NodeIO().registerExtensions([
	KHRMaterialsEmissiveStrength,
	KHRMaterialsTransmission
]);

for (const slug of SLUGS) {
  const source = join(ROOT, slug, 'probe-source.glb');
  if (!existsSync(source)) throw new Error(`missing ${source}`);
  const document = await io.read(source);
  const root = document.getRoot();
  const before = root
    .listMaterials()
    .map((material) => ({
      name: material.getName(),
      emissive: material.getEmissiveFactor(),
      emissiveTexture: material.getEmissiveTexture()?.getURI() ?? null,
      strength:
        material.getExtension('KHR_materials_emissive_strength')?.getEmissiveStrength() ?? null,
    }));
  for (const material of root.listMaterials()) {
    material.setEmissiveFactor([0, 0, 0]);
    material.setEmissiveTexture(null);
    const extension = material.getExtension('KHR_materials_emissive_strength');
    if (extension !== null) material.setExtension('KHR_materials_emissive_strength', null);
  }
  const destination = join(ROOT, slug, 'probe-stripped.glb');
  await io.write(destination, document);
  console.log(`\n${slug}`);
  for (const row of before) {
    console.log(
      `  ${row.name}: emissive=${JSON.stringify(row.emissive)} texture=${row.emissiveTexture} strength=${row.strength}`,
    );
  }
  console.log(`  stripped ${statSync(destination).size} bytes`);
}
