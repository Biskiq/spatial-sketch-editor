/**
 * P1 count census — console snippet.
 *
 * Paste this on the editor's project list **before opening a World** (or paste
 * it, then switch to another World). `perfRenderer` hands the renderer over at
 * creation; the wrapper remembers the scene it last rendered so the census can
 * count lights, materials, textures and shadow casters without a product change.
 *
 * Then, with the fixed Stage view on screen:
 *
 *   __BISKIQ_CENSUS_READ__('stage')
 *
 * and after entering Visitor Preview:
 *
 *   __BISKIQ_CENSUS_READ__('preview')
 *
 * The returned object is plain JSON. It records `renderer.info` values for the
 * last presented frame, not an average.
 */
(() => {
	window.__BISKIQ_PERF__ = { enabled: true };
	const census = (window.__BISKIQ_CENSUS__ = window.__BISKIQ_CENSUS__ || {});
	window.__BISKIQ_PERF_ON_RENDERER__ = (renderer, surface) => {
		census[surface] = renderer;
		if (renderer.__biskiqCensusWrapped) return;
		renderer.__biskiqCensusWrapped = true;
		const original = renderer.render.bind(renderer);
		renderer.render = (scene, camera) => {
			census.scene = scene;
			census.camera = camera;
			return original(scene, camera);
		};
	};

	const FORMATS = {
		1023: 'RGB',
		1024: 'RGBA',
		1025: 'R',
		1026: 'Depth',
		1027: 'DepthStencil',
		1030: 'RG',
		1031: 'RGInteger',
		1032: 'RGBAInteger',
		1033: 'RedInteger'
	};
	const TYPES = {
		1009: { name: 'UnsignedByte', bytes: 1 },
		1010: { name: 'Byte', bytes: 1 },
		1011: { name: 'Short', bytes: 2 },
		1012: { name: 'UnsignedShort', bytes: 2 },
		1013: { name: 'Int', bytes: 4 },
		1014: { name: 'UnsignedInt', bytes: 4 },
		1015: { name: 'Float', bytes: 4 },
		1016: { name: 'HalfFloat', bytes: 2 },
		1017: { name: 'Double', bytes: 8 },
		1019: { name: 'UnsignedShort4444', bytes: 2 },
		1020: { name: 'UnsignedInt248', bytes: 4 },
		1021: { name: 'UnsignedInt101111', bytes: 4 }
	};
	const COMPONENTS = { R: 1, RG: 2, RGB: 3, RGBA: 4, Depth: 1, DepthStencil: 1, RedInteger: 1, RGInteger: 2, RGBAInteger: 4 };
	const TEXTURE_SLOTS = [
		'map',
		'normalMap',
		'bumpMap',
		'roughnessMap',
		'metalnessMap',
		'aoMap',
		'emissiveMap',
		'alphaMap',
		'displacementMap',
		'lightMap',
		'specularMap',
		'specularColorMap',
		'specularIntensityMap',
		'clearcoatMap',
		'clearcoatRoughnessMap',
		'clearcoatNormalMap',
		'iridescenceMap',
		'iridescenceThicknessMap',
		'sheenColorMap',
		'sheenRoughnessMap',
		'transmissionMap',
		'thicknessMap',
		'anisotropyMap',
		'envMap'
	];

	function estimateTextureBytes(texture) {
		if (!texture) return { bytes: 0, format: 'none', type: 'none', width: 0, height: 0 };
		if (texture.isCompressedTexture && Array.isArray(texture.mipmaps)) {
			let bytes = 0;
			for (const mip of texture.mipmaps) bytes += mip.data?.byteLength ?? 0;
			const format = `compressed:${texture.format}`;
			return {
				bytes,
				format,
				type: 'compressed',
				width: texture.image?.width ?? 0,
				height: texture.image?.height ?? 0
			};
		}
		const format = FORMATS[texture.format] ?? `format:${texture.format}`;
		const type = TYPES[texture.type] ?? { name: `type:${texture.type}`, bytes: 4 };
		const components = COMPONENTS[format] ?? 4;
		const width = texture.image?.width ?? 0;
		const height = texture.image?.height ?? 0;
		const base = width * height * components * type.bytes;
		const mipFactor = texture.generateMipmaps === false ? 1 : 4 / 3;
		return { bytes: Math.round(base * mipFactor), format, type: type.name, width, height };
	}

	window.__BISKIQ_CENSUS_READ__ = (surface = 'stage') => {
		const renderer = census[surface];
		const scene = census.scene;
		if (!renderer) return { error: `no renderer captured for surface "${surface}"` };
		if (!scene) return { error: 'no rendered scene captured yet' };

		const meshes = [];
		const materials = new Map();
		const lights = [];
		const objects = { mesh: 0, instanced: 0, batched: 0, group: 0, other: 0 };
		let objectsTotal = 0;
		scene.updateMatrixWorld();
		scene.traverseVisible((object) => {
			objectsTotal += 1;
			if (object.isLight) {
				lights.push(object);
				return;
			}
			if (object.isMesh) {
				meshes.push(object);
				objects.mesh += 1;
				if (object.isInstancedMesh) objects.instanced += 1;
				else if (object.isBatchedMesh) objects.batched += 1;
				const materialList = Array.isArray(object.material) ? object.material : [object.material];
				for (const material of materialList) {
					if (material) materials.set(material.uuid, material);
				}
				return;
			}
			if (object.isGroup) objects.group += 1;
			else objects.other += 1;
		});

		const lightsByType = {};
		let shadowCastingLights = 0;
		const shadowMaps = [];
		for (const light of lights) {
			lightsByType[light.type] = (lightsByType[light.type] ?? 0) + 1;
			if (light.castShadow) {
				shadowCastingLights += 1;
				const size = light.shadow?.mapSize;
				if (size) {
					const faces = light.type === 'PointLight' ? 6 : 1;
					shadowMaps.push({
						type: light.type,
						width: size.x,
						height: size.y,
						faces,
						estimatedBytes: size.x * size.y * 4 * faces
					});
				}
			}
		}

		const textures = new Map();
		for (const material of materials.values()) {
			for (const slot of TEXTURE_SLOTS) {
				const texture = material[slot];
				if (!texture) continue;
				if (!textures.has(texture.uuid)) {
					textures.set(texture.uuid, { slot, ...estimateTextureBytes(texture) });
				}
			}
		}
		const texturesByFormat = {};
		let textureBytes = 0;
		for (const texture of textures.values()) {
			textureBytes += texture.bytes;
			const key = `${texture.format}/${texture.type}`;
			const entry = (texturesByFormat[key] = texturesByFormat[key] || {
				count: 0,
				bytes: 0,
				example: `${texture.width}×${texture.height}`
			});
			entry.count += 1;
			entry.bytes += texture.bytes;
		}
		const shadowBytes = shadowMaps.reduce((sum, map) => sum + map.estimatedBytes, 0);

		const info = renderer.info;
		const programs = Array.isArray(info.programs)
			? info.programs.length
			: typeof info.memory?.programs === 'number'
				? info.memory.programs
				: null;
		const triangleCount = meshes.reduce((sum, mesh) => {
			const geometry = mesh.geometry;
			const perInstance = geometry?.index ? geometry.index.count / 3 : (geometry?.attributes?.position?.count ?? 0) / 3;
			const count = mesh.isInstancedMesh ? mesh.count : mesh.isBatchedMesh ? (mesh._instanceInfo?.length ?? mesh.count ?? 1) : 1;
			return sum + perInstance * count;
		}, 0);

		return {
			surface,
			capturedAt: new Date().toISOString(),
			renderer: {
				constructor: renderer.constructor?.name ?? 'unknown',
				info: {
					calls: info.render.calls,
					drawCalls: info.render.drawCalls ?? null,
					triangles: info.render.triangles,
					points: info.render.points,
					lines: info.render.lines,
					programs,
					memoryTextures: info.memory?.textures ?? null,
					memoryGeometries: info.memory?.geometries ?? null
				}
			},
			objects: { total: objectsTotal, ...objects, meshes: meshes.length, materials: materials.size },
			lighting: {
				total: lights.length,
				byType: lightsByType,
				shadowCastingLights,
				shadowCasters: meshes.filter((mesh) => mesh.castShadow).length,
				shadowMaps
			},
			textures: {
				count: textures.size,
				estimatedBytes: textureBytes,
				byFormat: texturesByFormat,
				shadowMapEstimatedBytes: shadowBytes,
				estimatedTotalBytes: textureBytes + shadowBytes
			},
			geometryTrianglesFromScene: Math.round(triangleCount)
		};
	};

	console.info('P1 census installed. Open a World, hold a fixed Stage view, then run __BISKIQ_CENSUS_READ__(\'stage\').');
})();
