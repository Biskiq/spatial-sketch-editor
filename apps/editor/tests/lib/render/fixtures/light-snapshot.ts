/**
 * E10/R6 — a complete, order-independent reading of every Light a world realizes.
 *
 * The parity oracle for the resolved-light refactor: each realized light is read
 * as plain data — kind, colour, intensity in the T2.S0 units, range and decay,
 * cone, shadow flag and the full shadow configuration including the shadow
 * camera's frustum and projection — together with its world placement and its
 * target's world position. Numbers are rounded to twelve significant digits so
 * a legitimately identical transform chain cannot fail on float noise while any
 * real difference still does.
 */
import {
	DirectionalLight,
	HemisphereLight,
	Light,
	OrthographicCamera,
	PerspectiveCamera,
	PointLight,
	SpotLight,
	Vector3,
	type Object3D
} from 'three';

export type LightReading = Record<string, unknown>;

function round(value: number): number {
	return value === 0 ? 0 : Number(value.toPrecision(12));
}

function vec(value: Vector3): number[] {
	return [round(value.x), round(value.y), round(value.z)];
}

function worldOf(node: Object3D): number[] {
	return vec(new Vector3().setFromMatrixPosition(node.matrixWorld));
}

function cameraReading(camera: OrthographicCamera | PerspectiveCamera): LightReading {
	const common = {
		type: camera.type,
		near: round(camera.near),
		far: round(camera.far),
		zoom: round(camera.zoom),
		projection: camera.projectionMatrix.elements.map(round)
	};
	if (camera instanceof OrthographicCamera) {
		return {
			...common,
			left: round(camera.left),
			right: round(camera.right),
			top: round(camera.top),
			bottom: round(camera.bottom)
		};
	}
	return { ...common, fov: round(camera.fov), aspect: round(camera.aspect) };
}

function shadowReading(light: PointLight | SpotLight | DirectionalLight): LightReading {
	const shadow = light.shadow;
	return {
		mapSize: [shadow.mapSize.x, shadow.mapSize.y],
		bias: round(shadow.bias),
		normalBias: round(shadow.normalBias),
		radius: round(shadow.radius),
		blurSamples: shadow.blurSamples,
		intensity: round(shadow.intensity),
		autoUpdate: shadow.autoUpdate,
		...('focus' in shadow ? { focus: round((shadow as { focus: number }).focus) } : {}),
		camera: cameraReading(shadow.camera as OrthographicCamera | PerspectiveCamera)
	};
}

export function readLight(light: Light): LightReading {
	const base: LightReading = {
		type: light.type,
		color: light.color.getHexString(),
		intensity: round(light.intensity),
		position: worldOf(light),
		visible: light.visible,
		layers: light.layers.mask,
		castShadow: light.castShadow
	};
	if (light instanceof HemisphereLight) {
		return { ...base, groundColor: light.groundColor.getHexString() };
	}
	if (light instanceof PointLight) {
		return { ...base, distance: round(light.distance), decay: round(light.decay), shadow: shadowReading(light) };
	}
	if (light instanceof SpotLight) {
		return {
			...base,
			distance: round(light.distance),
			decay: round(light.decay),
			angle: round(light.angle),
			penumbra: round(light.penumbra),
			target: worldOf(light.target),
			targetInScene: light.target.parent !== null,
			shadow: shadowReading(light)
		};
	}
	if (light instanceof DirectionalLight) {
		return {
			...base,
			target: worldOf(light.target),
			targetInScene: light.target.parent !== null,
			shadow: shadowReading(light)
		};
	}
	return base;
}

/** Every Light under `world`, read and sorted so traversal order cannot matter. */
export function lightSnapshot(world: Object3D): LightReading[] {
	world.updateMatrixWorld(true);
	const lights: Light[] = [];
	world.traverse((node) => {
		if ((node as Light).isLight) lights.push(node as Light);
	});
	return lights
		.map(readLight)
		.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
