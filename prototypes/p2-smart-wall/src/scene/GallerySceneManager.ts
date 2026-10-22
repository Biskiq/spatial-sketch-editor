import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  AmbientPreset,
  ArtworkItem,
  GalleryLight,
  PairwiseGapRelation,
  RevisionSnapshot,
  SnapGuide,
  SpatialConflict,
  SplineControlPoint,
} from '../core/types';
import {
  WALL_HEIGHT,
  WALL_THICKNESS,
  WallSplineEngine,
} from '../core/WallSplineEngine';
import { createFramedArtworkMesh } from './ProceduralArtworks';

export interface ProjectedHudPoint {
  x: number;
  y: number;
  visible: boolean;
  distance: number;
}

export interface HudProjectionData {
  controlPoints: {
    id: string;
    index: number;
    screen: ProjectedHudPoint;
    worldX: number;
    worldZ: number;
  }[];
  artworks: {
    id: string;
    center: ProjectedHudPoint;
    topCenter: ProjectedHudPoint;
    bottomCenter: ProjectedHudPoint;
    rightEdgeCenter: ProjectedHudPoint;
    standoffHandle: ProjectedHudPoint;
  }[];
  gaps: {
    pairKey: string;
    relation: PairwiseGapRelation;
    midpoint: ProjectedHudPoint;
    leftEdge: ProjectedHudPoint;
    rightEdge: ProjectedHudPoint;
    polylineScreen: { x: number; y: number }[];
  }[];
  lights: {
    id: string;
    targetCenter: ProjectedHudPoint;
    fixtureScreen: ProjectedHudPoint;
    coneRimRight: ProjectedHudPoint;
    penumbraRimTop: ProjectedHudPoint;
    incidenceDeg: number;
  }[];
  conflicts: {
    conflict: SpatialConflict;
    screen: ProjectedHudPoint;
  }[];
  ghostArtworks: {
    id: string;
    title: string;
    screen: ProjectedHudPoint;
    movedDistance: number;
  }[];
  rackScreen: ProjectedHudPoint;
}

export function kelvinToColor(kelvin: number): THREE.Color {
  // Smooth gallery color temperature mapping from 2600K warm tungsten to 5600K cool daylight
  const t = Math.max(0, Math.min(1, (kelvin - 2600) / (5600 - 2600)));
  const r = 1.0;
  const g = 0.82 + 0.17 * Math.pow(t, 0.75);
  const b = 0.62 + 0.38 * Math.pow(t, 0.9);
  return new THREE.Color(r, g, b);
}

export class GallerySceneManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();

  // Scene groups
  private wallMesh: THREE.Mesh;
  private wallBaseboardMesh: THREE.Mesh;
  private wallCrestLine: THREE.Line;
  private floorSplineLine: THREE.Line;
  private eyeLevelLine: THREE.Line;
  private snapGuidesGroup: THREE.Group;
  private controlHandlesGroup: THREE.Group;
  private artworksGroup: THREE.Group;
  private lightsGroup: THREE.Group;
  private stagingRackGroup: THREE.Group;
  private ghostGroup: THREE.Group;

  // Ambient / environment lights
  private hemiLight: THREE.HemisphereLight;
  private dirFillLight: THREE.DirectionalLight;
  private floorMesh: THREE.Mesh;

  // Cached mesh maps
  private artworkMeshes = new Map<string, THREE.Group>();
  private controlHandleMeshes = new Map<string, THREE.Group>();
  private lightObjects = new Map<
    string,
    {
      spot: THREE.SpotLight;
      targetObj: THREE.Object3D;
      fixtureGroup: THREE.Group;
      coneMesh: THREE.Mesh;
      sightLine: THREE.Line;
    }
  >();
  private trackRailMesh: THREE.Mesh | null = null;

  // Current state references
  private currentSpline: WallSplineEngine;
  private currentArtworks: ArtworkItem[] = [];
  private currentLights: GalleryLight[] = [];
  private currentGaps: PairwiseGapRelation[] = [];
  private currentConflicts: SpatialConflict[] = [];
  private currentGuides: SnapGuide[] = [];
  private currentEyeLevel = 1.52;
  private currentGhostSnapshot: RevisionSnapshot | null = null;
  private showGhostOverlay = false;

  // Selection & hover states
  private selectedArtworkId: string | null = null;
  private hoveredArtworkId: string | null = null;
  private selectedLightId: string | null = null;
  private hoveredControlPointId: string | null = null;
  private wallEditMode = false;
  private showLightBeams = true;

  // Drag state
  private activeDrag:
    | {
        kind: 'artwork';
        artworkId: string;
        grabOffsetU: number;
        grabOffsetH: number;
        startedFromRack: boolean;
      }
    | {
        kind: 'control-point';
        pointId: string;
        pointIndex: number;
      }
    | {
        kind: 'light-target';
        lightId: string;
      }
    | {
        kind: 'light-track';
        lightId: string;
      }
    | {
        kind: 'eye-level';
      }
    | null = null;

  // Smooth camera transition target
  private cameraAnim: {
    active: boolean;
    targetPos: THREE.Vector3;
    targetLookAt: THREE.Vector3;
  } = {
    active: false,
    targetPos: new THREE.Vector3(),
    targetLookAt: new THREE.Vector3(),
  };

  private animFrameId = 0;

  // Callbacks to React state
  private callbacks: {
    onSelectArtwork: (id: string | null) => void;
    onSelectLight: (id: string | null) => void;
    onDragArtwork: (
      artId: string,
      desiredU: number,
      desiredH: number,
      bypassSnaps: boolean,
      dropToRack: boolean
    ) => void;
    onDragStart: (label: string) => void;
    onDragEnd: () => void;
    onMoveControlPoint: (pointId: string, x: number, z: number) => void;
    onUpdateLightTarget: (
      lightId: string,
      u: number,
      h: number,
      hitArtworkId?: string
    ) => void;
    onUpdateLightTrackOffset: (lightId: string, newTrackOffsetU: number) => void;
    onUpdateEyeLevel: (newHeight: number) => void;
    onProjectionUpdate: (data: HudProjectionData) => void;
  };

  constructor(
    container: HTMLElement,
    initialSpline: WallSplineEngine,
    callbacks: GallerySceneManager['callbacks']
  ) {
    this.container = container;
    this.currentSpline = initialSpline;
    this.callbacks = callbacks;

    // 1. Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#171615');
    this.scene.fog = new THREE.FogExp2('#171615', 0.025);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    this.camera.position.set(0.2, 1.95, 6.9);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    // 2. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.48, 0.15);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.492; // Stay above floor
    this.controls.minPolarAngle = 0.08;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 18.5;
    this.controls.update();

    // 3. Environment & Gallery Floor
    this.hemiLight = new THREE.HemisphereLight(0xf6f2eb, 0x2a2724, 0.72);
    this.scene.add(this.hemiLight);

    this.dirFillLight = new THREE.DirectionalLight(0xfffaf0, 0.45);
    this.dirFillLight.position.set(3.5, 8.0, 7.0);
    this.scene.add(this.dirFillLight);

    const floorGeo = new THREE.PlaneGeometry(46, 46);
    floorGeo.rotateX(-Math.PI * 0.5);
    const floorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#23211f'),
      roughness: 0.62,
      metalness: 0.08,
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    // Subtle architectural floor grid rings
    const gridHelper = new THREE.GridHelper(24, 24, 0x3b3733, 0x2b2825);
    gridHelper.position.y = 0.002;
    this.scene.add(gridHelper);

    // 4. Initialize Wall & Scene Groups
    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ece7df'),
      roughness: 0.86,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    this.wallMesh = new THREE.Mesh(new THREE.BufferGeometry(), wallMat);
    this.wallMesh.castShadow = true;
    this.wallMesh.receiveShadow = true;
    this.wallMesh.name = 'exhibition-wall';
    this.scene.add(this.wallMesh);

    const baseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1917'),
      roughness: 0.5,
      metalness: 0.2,
    });
    this.wallBaseboardMesh = new THREE.Mesh(new THREE.BufferGeometry(), baseMat);
    this.scene.add(this.wallBaseboardMesh);

    this.wallCrestLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xd8cec0,
        transparent: true,
        opacity: 0.45,
      })
    );
    this.scene.add(this.wallCrestLine);

    this.floorSplineLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xe59f4c,
        transparent: true,
        opacity: 0.65,
      })
    );
    this.scene.add(this.floorSplineLine);

    this.eyeLevelLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: 0xc29353,
        dashSize: 0.12,
        gapSize: 0.08,
        transparent: true,
        opacity: 0.55,
      })
    );
    this.scene.add(this.eyeLevelLine);

    this.snapGuidesGroup = new THREE.Group();
    this.scene.add(this.snapGuidesGroup);

    this.controlHandlesGroup = new THREE.Group();
    this.scene.add(this.controlHandlesGroup);

    this.artworksGroup = new THREE.Group();
    this.scene.add(this.artworksGroup);

    this.lightsGroup = new THREE.Group();
    this.scene.add(this.lightsGroup);

    this.stagingRackGroup = new THREE.Group();
    this.buildStagingRackGeometry();
    this.scene.add(this.stagingRackGroup);

    this.ghostGroup = new THREE.Group();
    this.scene.add(this.ghostGroup);

    this.rebuildWallGeometry(initialSpline);
    this.bindEvents();
    this.startLoop();
  }

  private buildStagingRackGeometry() {
    // Minimalist oak gallery floor rack where unhung frames lean
    const oakMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7a5f43'),
      roughness: 0.55,
      metalness: 0.05,
    });
    const padMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2a2826'),
      roughness: 0.9,
    });

    // Base runners
    const runnerGeo = new THREE.BoxGeometry(1.75, 0.04, 0.72);
    const runner = new THREE.Mesh(runnerGeo, oakMat);
    runner.position.set(0, 0.02, 0);
    runner.castShadow = true;
    runner.receiveShadow = true;
    runner.userData = { isStagingRack: true };
    this.stagingRackGroup.add(runner);

    // Non-slip felt strips
    const feltGeo = new THREE.BoxGeometry(1.65, 0.045, 0.08);
    for (const zOff of [-0.18, 0.18]) {
      const felt = new THREE.Mesh(feltGeo, padMat);
      felt.position.set(0, 0.022, zOff);
      felt.userData = { isStagingRack: true };
      this.stagingRackGroup.add(felt);
    }

    // Angled backrest uprights
    const uprightGeo = new THREE.BoxGeometry(0.05, 1.05, 0.05);
    for (const xOff of [-0.72, 0, 0.72]) {
      const up = new THREE.Mesh(uprightGeo, oakMat);
      up.position.set(xOff, 0.52, -0.26);
      up.rotation.x = -0.18;
      up.castShadow = true;
      up.userData = { isStagingRack: true };
      this.stagingRackGroup.add(up);
    }

    // Horizontal top crossbar
    const barGeo = new THREE.BoxGeometry(1.68, 0.045, 0.045);
    const bar = new THREE.Mesh(barGeo, oakMat);
    bar.position.set(0, 0.92, -0.34);
    bar.castShadow = true;
    bar.userData = { isStagingRack: true };
    this.stagingRackGroup.add(bar);
  }

  /**
   * Generates the extruded 3D curved wall mesh, shadow-gap baseboard, eye-level line,
   * and conformal ceiling lighting track directly from `WallSplineEngine`.
   */
  private rebuildWallGeometry(spline: WallSplineEngine) {
    const samples = spline.samples;
    const count = samples.length;
    if (count < 2) return;

    const baseReveal = 0.035; // 3.5cm architectural shadow reveal at floor
    const H = WALL_HEIGHT;
    const T = WALL_THICKNESS;

    // Build front face, back face, top face, bottom face, and left/right end caps
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let vertOffset = 0;

    // 1. Front Curved Face (count * 2 vertices)
    for (let i = 0; i < count; i++) {
      const s = samples[i];
      // Bottom vertex
      positions.push(s.x, baseReveal, s.z);
      normals.push(s.nx, 0, s.nz);
      uvs.push(s.u * 0.5, 0);
      // Top vertex
      positions.push(s.x, H, s.z);
      normals.push(s.nx, 0, s.nz);
      uvs.push(s.u * 0.5, H * 0.5);
    }
    for (let i = 0; i < count - 1; i++) {
      const a = vertOffset + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
    vertOffset += count * 2;

    // 2. Back Curved Face (offset by -N * T)
    for (let i = 0; i < count; i++) {
      const s = samples[i];
      const bx = s.x - s.nx * T;
      const bz = s.z - s.nz * T;
      positions.push(bx, baseReveal, bz);
      normals.push(-s.nx, 0, -s.nz);
      uvs.push(s.u * 0.5, 0);

      positions.push(bx, H, bz);
      normals.push(-s.nx, 0, -s.nz);
      uvs.push(s.u * 0.5, H * 0.5);
    }
    for (let i = 0; i < count - 1; i++) {
      const a = vertOffset + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    vertOffset += count * 2;

    // 3. Top Crest Ribbon
    for (let i = 0; i < count; i++) {
      const s = samples[i];
      const bx = s.x - s.nx * T;
      const bz = s.z - s.nz * T;
      positions.push(s.x, H, s.z);
      normals.push(0, 1, 0);
      uvs.push(s.u * 0.5, 0);

      positions.push(bx, H, bz);
      normals.push(0, 1, 0);
      uvs.push(s.u * 0.5, 1);
    }
    for (let i = 0; i < count - 1; i++) {
      const a = vertOffset + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
    vertOffset += count * 2;

    // 4. Left & Right End Caps
    const sFirst = samples[0];
    const sLast = samples[count - 1];
    // Left cap (normal -T)
    const lVerts = [
      [sFirst.x, baseReveal, sFirst.z],
      [sFirst.x, H, sFirst.z],
      [sFirst.x - sFirst.nx * T, H, sFirst.z - sFirst.nz * T],
      [sFirst.x - sFirst.nx * T, baseReveal, sFirst.z - sFirst.nz * T],
    ];
    for (const v of lVerts) {
      positions.push(v[0], v[1], v[2]);
      normals.push(-sFirst.tx, 0, -sFirst.tz);
      uvs.push(0, 0);
    }
    indices.push(
      vertOffset,
      vertOffset + 1,
      vertOffset + 2,
      vertOffset,
      vertOffset + 2,
      vertOffset + 3
    );
    vertOffset += 4;

    // Right cap (normal +T)
    const rVerts = [
      [sLast.x, baseReveal, sLast.z],
      [sLast.x - sLast.nx * T, baseReveal, sLast.z - sLast.nz * T],
      [sLast.x - sLast.nx * T, H, sLast.z - sLast.nz * T],
      [sLast.x, H, sLast.z],
    ];
    for (const v of rVerts) {
      positions.push(v[0], v[1], v[2]);
      normals.push(sLast.tx, 0, sLast.tz);
      uvs.push(0, 0);
    }
    indices.push(
      vertOffset,
      vertOffset + 1,
      vertOffset + 2,
      vertOffset,
      vertOffset + 2,
      vertOffset + 3
    );

    const newWallGeo = new THREE.BufferGeometry();
    newWallGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    newWallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    newWallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    newWallGeo.setIndex(indices);

    this.wallMesh.geometry.dispose();
    this.wallMesh.geometry = newWallGeo;

    // Recessed Baseboard Plinth (0 .. baseReveal, recessed 2cm inward)
    const basePos: number[] = [];
    const baseInd: number[] = [];
    for (let i = 0; i < count; i++) {
      const s = samples[i];
      const fx = s.x - s.nx * 0.025;
      const fz = s.z - s.nz * 0.025;
      basePos.push(fx, 0, fz, fx, baseReveal, fz);
    }
    for (let i = 0; i < count - 1; i++) {
      const a = i * 2;
      baseInd.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const baseGeo = new THREE.BufferGeometry();
    baseGeo.setAttribute('position', new THREE.Float32BufferAttribute(basePos, 3));
    baseGeo.setIndex(baseInd);
    baseGeo.computeVertexNormals();
    this.wallBaseboardMesh.geometry.dispose();
    this.wallBaseboardMesh.geometry = baseGeo;

    // Crest & Floor Spline Indicator Lines
    const crestPts: THREE.Vector3[] = [];
    const floorPts: THREE.Vector3[] = [];
    const eyePts: THREE.Vector3[] = [];

    for (let i = 0; i < count; i += 3) {
      const s = samples[i];
      crestPts.push(new THREE.Vector3(s.x, H + 0.003, s.z));
      floorPts.push(
        new THREE.Vector3(s.x + s.nx * 0.08, 0.008, s.z + s.nz * 0.08)
      );
      eyePts.push(
        new THREE.Vector3(
          s.x + s.nx * 0.005,
          this.currentEyeLevel,
          s.z + s.nz * 0.005
        )
      );
    }

    this.wallCrestLine.geometry.dispose();
    this.wallCrestLine.geometry = new THREE.BufferGeometry().setFromPoints(crestPts);

    this.floorSplineLine.geometry.dispose();
    this.floorSplineLine.geometry = new THREE.BufferGeometry().setFromPoints(
      floorPts
    );

    this.eyeLevelLine.geometry.dispose();
    this.eyeLevelLine.geometry = new THREE.BufferGeometry().setFromPoints(eyePts);
    this.eyeLevelLine.computeLineDistances();

    // Rebuild conformal overhead lighting track rail (mirrors wall curve at setback 1.38m, height 3.22m)
    const trackCurvePts: THREE.Vector3[] = [];
    for (let i = 0; i < count; i += 6) {
      const s = samples[i];
      trackCurvePts.push(
        new THREE.Vector3(s.x + s.nx * 1.38, WALL_HEIGHT - 0.02, s.z + s.nz * 1.38)
      );
    }
    if (trackCurvePts.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(trackCurvePts);
      const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.016, 8, false);
      if (!this.trackRailMesh) {
        const railMat = new THREE.MeshStandardMaterial({
          color: 0x2c2926,
          metalness: 0.7,
          roughness: 0.35,
        });
        this.trackRailMesh = new THREE.Mesh(tubeGeo, railMat);
        this.scene.add(this.trackRailMesh);
      } else {
        this.trackRailMesh.geometry.dispose();
        this.trackRailMesh.geometry = tubeGeo;
      }
    }

    // Position the Floor Staging Rack gracefully beside the right end of the wall
    this.stagingRackGroup.position.set(
      sLast.x + sLast.tx * 1.35 + sLast.nx * 0.95,
      0,
      sLast.z + sLast.tz * 1.35 + sLast.nz * 0.95
    );
    const rackYaw = Math.atan2(sLast.nx, sLast.nz) - 0.38;
    this.stagingRackGroup.rotation.set(0, rackYaw, 0);

    // Sync control point 3D handles on the floor
    this.syncControlHandles(spline.controlPoints);
  }

  private syncControlHandles(points: SplineControlPoint[]) {
    const activeIds = new Set(points.map((p) => p.id));
    for (const [id, mesh] of this.controlHandleMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.controlHandlesGroup.remove(mesh);
        this.controlHandleMeshes.delete(id);
      }
    }

    points.forEach((pt, index) => {
      let handleGroup = this.controlHandleMeshes.get(pt.id);
      if (!handleGroup) {
        handleGroup = new THREE.Group();
        handleGroup.userData = { controlPointId: pt.id, controlPointIndex: index };

        // Outer ring on floor
        const ringGeo = new THREE.RingGeometry(0.11, 0.155, 32);
        ringGeo.rotateX(-Math.PI * 0.5);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xe59f4c,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.012;
        ring.name = 'handle-ring';
        ring.userData = { controlPointId: pt.id, controlPointIndex: index };
        handleGroup.add(ring);

        // Tactile center puck
        const puckGeo = new THREE.CylinderGeometry(0.085, 0.095, 0.036, 24);
        const puckMat = new THREE.MeshStandardMaterial({
          color: 0xe59f4c,
          roughness: 0.28,
          metalness: 0.5,
          emissive: 0x3d2508,
        });
        const puck = new THREE.Mesh(puckGeo, puckMat);
        puck.position.y = 0.018;
        puck.name = 'handle-puck';
        puck.userData = { controlPointId: pt.id, controlPointIndex: index };
        handleGroup.add(puck);

        // Invisible larger hit sphere for effortless grabbing in 3D
        const hitGeo = new THREE.SphereGeometry(0.28, 12, 12);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.position.y = 0.1;
        hitMesh.userData = { controlPointId: pt.id, controlPointIndex: index };
        handleGroup.add(hitMesh);

        this.controlHandlesGroup.add(handleGroup);
        this.controlHandleMeshes.set(pt.id, handleGroup);
      }

      handleGroup.userData.controlPointIndex = index;
      // Place slightly in front of the wall spline at that control point so it's easy to grab
      const proj = this.currentSpline.worldToIntrinsic(pt.x, 0, pt.z);
      const offset = 0.14;
      handleGroup.position.set(
        pt.x + proj.sample.nx * offset,
        0,
        pt.z + proj.sample.nz * offset
      );

      // Highlight if hovered or in wallEditMode
      const isHovered = this.hoveredControlPointId === pt.id;
      const scale = isHovered ? 1.28 : this.wallEditMode ? 1.15 : 0.92;
      handleGroup.scale.setScalar(scale);
    });
  }

  /**
   * Synchronizes all scene data from React state into the Three.js scene.
   */
  public syncState(params: {
    spline: WallSplineEngine;
    artworks: ArtworkItem[];
    lights: GalleryLight[];
    gaps: PairwiseGapRelation[];
    conflicts: SpatialConflict[];
    guides: SnapGuide[];
    eyeLevelDatum: number;
    selectedArtworkId: string | null;
    selectedLightId: string | null;
    wallEditMode: boolean;
    showLightBeams: boolean;
    ambientPreset: AmbientPreset;
    ghostSnapshot: RevisionSnapshot | null;
    showGhostOverlay: boolean;
  }) {
    const splineChanged = this.currentSpline !== params.spline;
    this.currentSpline = params.spline;
    this.currentArtworks = params.artworks;
    this.currentLights = params.lights;
    this.currentGaps = params.gaps;
    this.currentConflicts = params.conflicts;
    this.currentGuides = params.guides;
    this.currentEyeLevel = params.eyeLevelDatum;
    this.selectedArtworkId = params.selectedArtworkId;
    this.selectedLightId = params.selectedLightId;
    this.wallEditMode = params.wallEditMode;
    this.showLightBeams = params.showLightBeams;
    this.currentGhostSnapshot = params.ghostSnapshot;
    this.showGhostOverlay = params.showGhostOverlay;

    if (splineChanged) {
      this.rebuildWallGeometry(params.spline);
    } else {
      // Update eye-level line height if changed
      const eyePts: THREE.Vector3[] = [];
      for (let i = 0; i < params.spline.samples.length; i += 3) {
        const s = params.spline.samples[i];
        eyePts.push(
          new THREE.Vector3(
            s.x + s.nx * 0.005,
            this.currentEyeLevel,
            s.z + s.nz * 0.005
          )
        );
      }
      this.eyeLevelLine.geometry.dispose();
      this.eyeLevelLine.geometry = new THREE.BufferGeometry().setFromPoints(eyePts);
      this.eyeLevelLine.computeLineDistances();
      this.syncControlHandles(params.spline.controlPoints);
    }

    this.applyAmbientPreset(params.ambientPreset);
    this.syncArtworkMeshes(params.artworks, params.spline);
    this.syncLightObjects(params.lights, params.spline);
    this.syncSnapGuideLines(params.guides, params.spline);
    this.syncGhostOverlay(params.ghostSnapshot, params.showGhostOverlay);
  }

  private applyAmbientPreset(preset: AmbientPreset) {
    if (preset === 'daylight-museum') {
      this.scene.background = new THREE.Color('#23211f');
      this.scene.fog = new THREE.FogExp2('#23211f', 0.02);
      this.hemiLight.intensity = 1.05;
      this.hemiLight.color.set('#faf7f2');
      this.dirFillLight.intensity = 0.65;
    } else if (preset === 'opening-night') {
      this.scene.background = new THREE.Color('#171615');
      this.scene.fog = new THREE.FogExp2('#171615', 0.025);
      this.hemiLight.intensity = 0.62;
      this.hemiLight.color.set('#f4ebdc');
      this.dirFillLight.intensity = 0.35;
    } else {
      // 'dramatic-nocturne'
      this.scene.background = new THREE.Color('#0e0d0c');
      this.scene.fog = new THREE.FogExp2('#0e0d0c', 0.032);
      this.hemiLight.intensity = 0.25;
      this.hemiLight.color.set('#d8d0c5');
      this.dirFillLight.intensity = 0.12;
    }
  }

  private syncArtworkMeshes(artworks: ArtworkItem[], spline: WallSplineEngine) {
    const activeIds = new Set(artworks.map((a) => a.id));
    for (const [id, mesh] of this.artworkMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.artworksGroup.remove(mesh);
        this.artworkMeshes.delete(id);
      }
    }

    const rackItems = artworks.filter((a) => a.location === 'rack');

    artworks.forEach((art) => {
      let meshGroup = this.artworkMeshes.get(art.id);
      if (!meshGroup) {
        meshGroup = createFramedArtworkMesh(art);
        this.artworksGroup.add(meshGroup);
        this.artworkMeshes.set(art.id, meshGroup);
      }

      if (art.location === 'wall') {
        const totalStandoff = art.standoff + art.autoCurveClearance;
        const { x, y, z, yawRad } = spline.intrinsicToWorld(
          art.u,
          art.h,
          totalStandoff
        );
        meshGroup.position.set(x, y, z);

        // Apply surface yaw + deliberate gallery pitch tilt
        const euler = new THREE.Euler(
          THREE.MathUtils.degToRad(art.pitchDeg),
          yawRad,
          0,
          'YXZ'
        );
        meshGroup.quaternion.setFromEuler(euler);

        // Show standoff pins if floated off the wall by > 2.2cm
        const pins = meshGroup.getObjectByName('standoff-pins');
        if (pins) {
          pins.visible = totalStandoff > 0.022;
        }
      } else {
        // Resting on the 3D Floor Staging Rack beside the wall!
        const rIdx = rackItems.findIndex((r) => r.id === art.id);
        const rackBase = this.stagingRackGroup.position;
        const rackRotY = this.stagingRackGroup.rotation.y;

        // Stagger works neatly on the wooden rack
        const localX = (rIdx - (rackItems.length - 1) * 0.5) * 0.48;
        const localY = art.height * 0.5 + 0.045;
        const localZ = 0.06 + rIdx * 0.075;

        const offsetVec = new THREE.Vector3(localX, localY, localZ).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          rackRotY
        );
        meshGroup.position.copy(rackBase).add(offsetVec);

        const euler = new THREE.Euler(-0.18, rackRotY, 0, 'YXZ');
        meshGroup.quaternion.setFromEuler(euler);

        const pins = meshGroup.getObjectByName('standoff-pins');
        if (pins) pins.visible = false;
      }

      // Selection / hover outline highlight
      const outline = meshGroup.getObjectByName(
        'selection-outline'
      ) as THREE.LineSegments | null;
      if (outline) {
        const mat = outline.material as THREE.LineBasicMaterial;
        const isSelected = this.selectedArtworkId === art.id;
        const isHovered = this.hoveredArtworkId === art.id;
        mat.opacity = isSelected ? 0.95 : isHovered ? 0.55 : 0.0;
        mat.color.setHex(isSelected ? 0xf5a642 : 0xdccbb4);
      }
    });
  }

  private syncLightObjects(lights: GalleryLight[], spline: WallSplineEngine) {
    const activeIds = new Set(lights.map((l) => l.id));
    for (const [id, obj] of this.lightObjects.entries()) {
      if (!activeIds.has(id)) {
        this.lightsGroup.remove(obj.spot);
        this.lightsGroup.remove(obj.targetObj);
        this.lightsGroup.remove(obj.fixtureGroup);
        this.lightsGroup.remove(obj.coneMesh);
        this.lightsGroup.remove(obj.sightLine);
        this.lightObjects.delete(id);
      }
    }

    for (const light of lights) {
      let obj = this.lightObjects.get(light.id);
      if (!obj) {
        const spot = new THREE.SpotLight(0xffffff, 2.0);
        spot.castShadow = true;
        spot.shadow.mapSize.width = 1024;
        spot.shadow.mapSize.height = 1024;
        spot.shadow.bias = -0.0004;
        spot.distance = 9.5;
        spot.decay = 1.35;

        const targetObj = new THREE.Object3D();
        spot.target = targetObj;

        // Track canister fixture mesh
        const fixtureGroup = new THREE.Group();
        fixtureGroup.userData = { lightFixtureId: light.id };
        const canGeo = new THREE.CylinderGeometry(0.042, 0.048, 0.16, 16);
        canGeo.rotateX(Math.PI * 0.5);
        const canMat = new THREE.MeshStandardMaterial({
          color: 0x242220,
          roughness: 0.35,
          metalness: 0.65,
        });
        const canMesh = new THREE.Mesh(canGeo, canMat);
        canMesh.userData = { lightFixtureId: light.id };
        fixtureGroup.add(canMesh);

        // Glowing lens front disk
        const lensGeo = new THREE.CircleGeometry(0.038, 16);
        const lensMat = new THREE.MeshBasicMaterial({ color: 0xffeedd });
        lensMat.name = 'lens-mat';
        const lensMesh = new THREE.Mesh(lensGeo, lensMat);
        lensMesh.position.z = 0.082;
        lensMesh.userData = { lightFixtureId: light.id };
        fixtureGroup.add(lensMesh);

        // Volumetric light beam cone (origin at apex, pointing +Z)
        const coneGeo = new THREE.ConeGeometry(1, 1, 32, 1, true);
        // Move apex to origin and orient along +Z
        coneGeo.translate(0, -0.5, 0);
        coneGeo.rotateX(-Math.PI * 0.5);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xffe8c2,
          transparent: true,
          opacity: 0.045,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);

        // Sightline connecting fixture to target artwork
        const sightLine = new THREE.Line(
          new THREE.BufferGeometry(),
          new THREE.LineDashedMaterial({
            color: 0xf5b963,
            dashSize: 0.08,
            gapSize: 0.06,
            transparent: true,
            opacity: 0.75,
          })
        );

        this.lightsGroup.add(spot);
        this.lightsGroup.add(targetObj);
        this.lightsGroup.add(fixtureGroup);
        this.lightsGroup.add(coneMesh);
        this.lightsGroup.add(sightLine);

        obj = { spot, targetObj, fixtureGroup, coneMesh, sightLine };
        this.lightObjects.set(light.id, obj);
      }

      // Compute 3D fixture position on the conformal ceiling track and 3D target position on wall
      const fixtureU = Math.max(
        0.1,
        Math.min(spline.totalLength - 0.1, light.targetU + light.trackOffsetU)
      );
      const trackSample = spline.sampleAtU(fixtureU);
      const fx = trackSample.x + trackSample.nx * light.trackDistance;
      const fy = WALL_HEIGHT - 0.03;
      const fz = trackSample.z + trackSample.nz * light.trackDistance;

      const targetWorld = spline.intrinsicToWorld(light.targetU, light.targetH, 0.02);
      const tx = targetWorld.x;
      const ty = targetWorld.y;
      const tz = targetWorld.z;

      const color = kelvinToColor(light.kelvin);
      obj.spot.color.copy(color);
      obj.spot.intensity = light.enabled ? light.intensity * 3.2 : 0;
      obj.spot.angle = THREE.MathUtils.degToRad(light.coneAngleDeg);
      obj.spot.penumbra = light.penumbra;
      obj.spot.position.set(fx, fy, fz);

      obj.targetObj.position.set(tx, ty, tz);
      obj.targetObj.updateMatrixWorld();

      obj.fixtureGroup.position.set(fx, fy, fz);
      obj.fixtureGroup.lookAt(tx, ty, tz);

      // Update volumetric cone geometry scale and orientation
      const beamDist = Math.hypot(tx - fx, ty - fy, tz - fz);
      const coneRadius = Math.tan(THREE.MathUtils.degToRad(light.coneAngleDeg)) * beamDist;
      obj.coneMesh.position.set(fx, fy, fz);
      obj.coneMesh.lookAt(tx, ty, tz);
      obj.coneMesh.scale.set(coneRadius, coneRadius, beamDist);

      const isSelected = this.selectedLightId === light.id;
      const coneMat = obj.coneMesh.material as THREE.MeshBasicMaterial;
      coneMat.color.copy(color);
      coneMat.opacity =
        !light.enabled
          ? 0
          : isSelected
          ? 0.095
          : this.showLightBeams
          ? 0.028
          : 0.0;

      // Sightline visibility when light is selected
      obj.sightLine.visible = isSelected && light.enabled;
      if (obj.sightLine.visible) {
        obj.sightLine.geometry.dispose();
        obj.sightLine.geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(fx, fy, fz),
          new THREE.Vector3(tx, ty, tz),
        ]);
        obj.sightLine.computeLineDistances();
      }
    }
  }

  private syncSnapGuideLines(guides: SnapGuide[], spline: WallSplineEngine) {
    while (this.snapGuidesGroup.children.length > 0) {
      const child = this.snapGuidesGroup.children[0] as THREE.Line;
      child.geometry.dispose();
      this.snapGuidesGroup.remove(child);
    }

    for (const g of guides) {
      const pts: THREE.Vector3[] = [];
      if (g.isVertical) {
        const h0 = g.hStart ?? 0.2;
        const h1 = g.hEnd ?? WALL_HEIGHT - 0.2;
        const p0 = spline.intrinsicToWorld(g.uStart, h0, 0.012);
        const p1 = spline.intrinsicToWorld(g.uStart, h1, 0.012);
        pts.push(new THREE.Vector3(p0.x, p0.y, p0.z));
        pts.push(new THREE.Vector3(p1.x, p1.y, p1.z));
      } else {
        const steps = 28;
        for (let i = 0; i <= steps; i++) {
          const u = g.uStart + ((g.uEnd - g.uStart) * i) / steps;
          const p = spline.intrinsicToWorld(u, g.h, 0.012);
          pts.push(new THREE.Vector3(p.x, p.y, p.z));
        }
      }

      const color =
        g.type === 'eye-level'
          ? 0xf5b041
          : g.type === 'equal-gap'
          ? 0x58d68d
          : g.type === 'landmark'
          ? 0x5dade2
          : 0xf4d03f;

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
        })
      );
      this.snapGuidesGroup.add(line);
    }
  }

  private syncGhostOverlay(snapshot: RevisionSnapshot | null, visible: boolean) {
    while (this.ghostGroup.children.length > 0) {
      const child = this.ghostGroup.children[0] as THREE.Object3D;
      this.ghostGroup.remove(child);
    }

    const shouldShow =
      (visible || this.activeDrag?.kind === 'control-point') && snapshot !== null;
    if (!shouldShow || !snapshot) return;

    const ghostSpline = new WallSplineEngine(snapshot.wallPoints, 160);

    // 1. Ghost Wall Floor & Crest Wireframe Ribbon
    const floorPts: THREE.Vector3[] = [];
    const crestPts: THREE.Vector3[] = [];
    for (let i = 0; i < ghostSpline.samples.length; i += 2) {
      const s = ghostSpline.samples[i];
      floorPts.push(new THREE.Vector3(s.x, 0.02, s.z));
      crestPts.push(new THREE.Vector3(s.x, WALL_HEIGHT, s.z));
    }

    const ghostWallMat = new THREE.LineDashedMaterial({
      color: 0x7fb3d5,
      dashSize: 0.14,
      gapSize: 0.09,
      transparent: true,
      opacity: 0.65,
    });
    const ghostFloorLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(floorPts),
      ghostWallMat
    );
    ghostFloorLine.computeLineDistances();
    this.ghostGroup.add(ghostFloorLine);

    const ghostCrestLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(crestPts),
      ghostWallMat
    );
    ghostCrestLine.computeLineDistances();
    this.ghostGroup.add(ghostCrestLine);

    // 2. Ghost Artworks & Displacement Vectors
    for (const ghostArt of snapshot.artworks) {
      if (ghostArt.location !== 'wall') continue;
      const gWorld = ghostSpline.intrinsicToWorld(
        ghostArt.u,
        ghostArt.h,
        ghostArt.standoff + 0.01
      );

      const frameEdges = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(ghostArt.width, ghostArt.height, 0.02)
      );
      const ghostFrame = new THREE.LineSegments(
        frameEdges,
        new THREE.LineBasicMaterial({
          color: 0x7fb3d5,
          transparent: true,
          opacity: 0.75,
        })
      );
      ghostFrame.position.set(gWorld.x, gWorld.y, gWorld.z);
      ghostFrame.rotation.set(0, gWorld.yawRad, 0);
      this.ghostGroup.add(ghostFrame);

      // Draw displacement line to current position of that artwork
      const currArt = this.currentArtworks.find((a) => a.id === ghostArt.id);
      if (currArt && currArt.location === 'wall') {
        const cWorld = this.currentSpline.intrinsicToWorld(
          currArt.u,
          currArt.h,
          currArt.standoff + 0.02
        );
        const dist = Math.hypot(
          cWorld.x - gWorld.x,
          cWorld.y - gWorld.y,
          cWorld.z - gWorld.z
        );
        if (dist > 0.04) {
          const dispLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(gWorld.x, gWorld.y, gWorld.z),
              new THREE.Vector3(cWorld.x, cWorld.y, cWorld.z),
            ]),
            new THREE.LineDashedMaterial({
              color: 0xf5b041,
              dashSize: 0.06,
              gapSize: 0.04,
              transparent: true,
              opacity: 0.8,
            })
          );
          dispLine.computeLineDistances();
          this.ghostGroup.add(dispLine);
        }
      }
    }
  }

  /**
   * Smoothly animates camera to preset views (Gallery 3/4, Front Elevation, Top Plan, or Focus Selected).
   */
  public setCameraView(
    view: 'perspective' | 'elevation' | 'plan' | 'rack' | 'focus-selected'
  ) {
    const midSample = this.currentSpline.sampleAtU(
      this.currentSpline.totalLength * 0.5
    );

    if (view === 'elevation') {
      this.cameraAnim.targetPos.set(
        midSample.x + midSample.nx * 6.8,
        1.55,
        midSample.z + midSample.nz * 6.8
      );
      this.cameraAnim.targetLookAt.set(midSample.x, 1.52, midSample.z);
      this.cameraAnim.active = true;
    } else if (view === 'plan') {
      this.cameraAnim.targetPos.set(midSample.x, 8.8, midSample.z + 2.6);
      this.cameraAnim.targetLookAt.set(midSample.x, 0.8, midSample.z);
      this.cameraAnim.active = true;
    } else if (view === 'rack') {
      const rackPos = this.stagingRackGroup.position;
      this.cameraAnim.targetPos.set(rackPos.x - 1.2, 1.65, rackPos.z + 3.4);
      this.cameraAnim.targetLookAt.set(rackPos.x - 0.4, 0.95, rackPos.z - 0.2);
      this.cameraAnim.active = true;
    } else if (view === 'focus-selected' && this.selectedArtworkId) {
      const art = this.currentArtworks.find(
        (a) => a.id === this.selectedArtworkId
      );
      if (art && art.location === 'wall') {
        const w = this.currentSpline.intrinsicToWorld(art.u, art.h, 0);
        this.cameraAnim.targetPos.set(
          w.x + w.sample.nx * 3.4,
          art.h + 0.12,
          w.z + w.sample.nz * 3.4
        );
        this.cameraAnim.targetLookAt.set(w.x, art.h, w.z);
        this.cameraAnim.active = true;
      }
    } else {
      // 'perspective'
      this.cameraAnim.targetPos.set(0.25, 1.95, 6.9);
      this.cameraAnim.targetLookAt.set(0, 1.48, 0.15);
      this.cameraAnim.active = true;
    }
  }

  private updatePointerNDC(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastFloorPlane(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, target);
  }

  private raycastWallSurface(): { u: number; h: number; point: THREE.Vector3 } | null {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObject(this.wallMesh, false);
    if (hits.length > 0) {
      const p = hits[0].point;
      const intrinsic = this.currentSpline.worldToIntrinsic(p.x, p.y, p.z);
      return { u: intrinsic.u, h: intrinsic.h, point: p };
    }

    // Fallback: intersect vertical plane facing camera through spline center so dragging never drops off
    const mid = this.currentSpline.sampleAtU(this.currentSpline.totalLength * 0.5);
    const fallbackPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(mid.nx, 0, mid.nz),
      new THREE.Vector3(mid.x, 1.5, mid.z)
    );
    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(fallbackPlane, target)) {
      const intrinsic = this.currentSpline.worldToIntrinsic(
        target.x,
        target.y,
        target.z
      );
      return { u: intrinsic.u, h: intrinsic.h, point: target };
    }
    return null;
  }

  private isPointerOverStagingRack(): boolean {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const rackHits = this.raycaster.intersectObjects(
      this.stagingRackGroup.children,
      true
    );
    if (rackHits.length > 0) return true;

    const floorHit = this.raycastFloorPlane();
    if (floorHit) {
      const distToRack = floorHit.distanceTo(this.stagingRackGroup.position);
      if (distToRack < 1.35) return true;
    }
    return false;
  }

  private bindEvents() {
    const dom = this.renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.cameraAnim.active = false;
      this.updatePointerNDC(e);
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);

      // 1. Check Floor Spline Control Point Handles
      const handleHits = this.raycaster.intersectObjects(
        this.controlHandlesGroup.children,
        true
      );
      if (handleHits.length > 0) {
        let obj: THREE.Object3D | null = handleHits[0].object;
        while (obj && !obj.userData?.controlPointId) {
          obj = obj.parent;
        }
        if (obj?.userData?.controlPointId) {
          this.controls.enabled = false;
          this.activeDrag = {
            kind: 'control-point',
            pointId: obj.userData.controlPointId,
            pointIndex: obj.userData.controlPointIndex,
          };
          this.callbacks.onDragStart('Reshaped Wall Curve');
          dom.style.cursor = 'grabbing';
          return;
        }
      }

      // 2. Check Overhead Light Fixtures
      const fixtureHits = this.raycaster.intersectObjects(
        this.lightsGroup.children,
        true
      );
      for (const hit of fixtureHits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && !obj.userData?.lightFixtureId) {
          obj = obj.parent;
        }
        if (obj?.userData?.lightFixtureId) {
          const lightId = obj.userData.lightFixtureId as string;
          this.callbacks.onSelectLight(lightId);
          this.callbacks.onSelectArtwork(null);
          this.controls.enabled = false;
          this.activeDrag = {
            kind: 'light-track',
            lightId,
          };
          this.callbacks.onDragStart('Adjusted Light Grazing Angle');
          dom.style.cursor = 'ew-resize';
          return;
        }
      }

      // 3. Check Artworks (both on Wall and on Floor Staging Rack)
      const artHits = this.raycaster.intersectObjects(
        this.artworksGroup.children,
        true
      );
      if (artHits.length > 0) {
        let obj: THREE.Object3D | null = artHits[0].object;
        while (obj && !obj.userData?.artworkId) {
          obj = obj.parent;
        }
        if (obj?.userData?.artworkId) {
          const artId = obj.userData.artworkId as string;
          const art = this.currentArtworks.find((a) => a.id === artId);
          if (art) {
            this.callbacks.onSelectArtwork(artId);

            // If a light is currently selected and the user clicks an artwork, aim or select artwork
            this.callbacks.onSelectLight(null);

            const hitPt = artHits[0].point;
            const intrinsic = this.currentSpline.worldToIntrinsic(
              hitPt.x,
              hitPt.y,
              hitPt.z
            );
            const grabOffsetU =
              art.location === 'wall' ? art.u - intrinsic.u : 0;
            const grabOffsetH =
              art.location === 'wall' ? art.h - intrinsic.h : 0;

            this.controls.enabled = false;
            this.activeDrag = {
              kind: 'artwork',
              artworkId: artId,
              grabOffsetU,
              grabOffsetH,
              startedFromRack: art.location === 'rack',
            };
            this.callbacks.onDragStart(
              art.location === 'rack'
                ? `Hung "${art.title}" on Wall`
                : `Repositioned "${art.title}"`
            );
            dom.style.cursor = 'grabbing';
            return;
          }
        }
      }

      // 4. Clicked empty wall or floor: deselect
      const wallHits = this.raycaster.intersectObject(this.wallMesh, false);
      if (wallHits.length > 0) {
        this.callbacks.onSelectArtwork(null);
        this.callbacks.onSelectLight(null);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      this.updatePointerNDC(e);

      if (this.activeDrag) {
        if (this.activeDrag.kind === 'artwork') {
          const overRack = this.isPointerOverStagingRack();
          if (overRack && !this.activeDrag.startedFromRack) {
            this.callbacks.onDragArtwork(
              this.activeDrag.artworkId,
              0,
              1.52,
              e.altKey,
              true
            );
            return;
          }

          const wallHit = this.raycastWallSurface();
          if (wallHit) {
            this.activeDrag.startedFromRack = false;
            const dragArtId = this.activeDrag.artworkId;
            const desiredU = wallHit.u + this.activeDrag.grabOffsetU;
            const desiredH = e.shiftKey
              ? this.currentArtworks.find((a) => a.id === dragArtId)?.h ??
                wallHit.h + this.activeDrag.grabOffsetH
              : wallHit.h + this.activeDrag.grabOffsetH;

            this.callbacks.onDragArtwork(
              dragArtId,
              desiredU,
              desiredH,
              e.altKey,
              false
            );
          }
          return;
        }

        if (this.activeDrag.kind === 'control-point') {
          const floorPt = this.raycastFloorPlane();
          if (floorPt) {
            const clampedX = Math.max(-5.8, Math.min(5.8, floorPt.x));
            const clampedZ = Math.max(-2.4, Math.min(2.6, floorPt.z));
            this.callbacks.onMoveControlPoint(
              this.activeDrag.pointId,
              clampedX,
              clampedZ
            );
          }
          return;
        }

        if (this.activeDrag.kind === 'light-track') {
          const light = this.currentLights.find(
            (l) => l.id === (this.activeDrag as { lightId: string }).lightId
          );
          const wallHit = this.raycastWallSurface();
          if (light && wallHit) {
            const newOffset = Math.max(
              -1.6,
              Math.min(1.6, wallHit.u - light.targetU)
            );
            this.callbacks.onUpdateLightTrackOffset(light.id, newOffset);
          }
          return;
        }

        if (this.activeDrag.kind === 'light-target') {
          const wallHit = this.raycastWallSurface();
          if (wallHit) {
            // Check if hovering an artwork to bind to it!
            this.raycaster.setFromCamera(this.pointerNDC, this.camera);
            const artHits = this.raycaster.intersectObjects(
              this.artworksGroup.children,
              true
            );
            let hitArtId: string | undefined;
            if (artHits.length > 0) {
              let obj: THREE.Object3D | null = artHits[0].object;
              while (obj && !obj.userData?.artworkId) {
                obj = obj.parent;
              }
              hitArtId = obj?.userData?.artworkId;
            }
            this.callbacks.onUpdateLightTarget(
              this.activeDrag.lightId,
              wallHit.u,
              wallHit.h,
              hitArtId
            );
          }
          return;
        }
      }

      // Hover detection when not dragging
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);

      const handleHits = this.raycaster.intersectObjects(
        this.controlHandlesGroup.children,
        true
      );
      if (handleHits.length > 0) {
        let obj: THREE.Object3D | null = handleHits[0].object;
        while (obj && !obj.userData?.controlPointId) {
          obj = obj.parent;
        }
        this.hoveredControlPointId = obj?.userData?.controlPointId ?? null;
        this.hoveredArtworkId = null;
        dom.style.cursor = 'grab';
        this.syncControlHandles(this.currentSpline.controlPoints);
        return;
      } else if (this.hoveredControlPointId) {
        this.hoveredControlPointId = null;
        this.syncControlHandles(this.currentSpline.controlPoints);
      }

      const artHits = this.raycaster.intersectObjects(
        this.artworksGroup.children,
        true
      );
      if (artHits.length > 0) {
        let obj: THREE.Object3D | null = artHits[0].object;
        while (obj && !obj.userData?.artworkId) {
          obj = obj.parent;
        }
        this.hoveredArtworkId = obj?.userData?.artworkId ?? null;
        dom.style.cursor = 'grab';
        return;
      }

      this.hoveredArtworkId = null;
      dom.style.cursor = 'default';
    };

    const onPointerUp = () => {
      if (this.activeDrag) {
        this.activeDrag = null;
        this.controls.enabled = true;
        this.callbacks.onDragEnd();
        dom.style.cursor = 'default';
      }
    };

    const onResize = () => {
      if (!this.container) return;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);
  }

  /**
   * Starts dragging a light's target pool on the wall directly from an HUD halo handle.
   */
  public startLightTargetDrag(lightId: string) {
    this.controls.enabled = false;
    this.activeDrag = {
      kind: 'light-target',
      lightId,
    };
    this.callbacks.onDragStart('Aimed Light Pool on Wall');
  }

  private projectWorldPoint(wx: number, wy: number, wz: number): ProjectedHudPoint {
    const vec = new THREE.Vector3(wx, wy, wz);
    const dist = vec.distanceTo(this.camera.position);
    vec.project(this.camera);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    const visible = vec.z >= -1 && vec.z <= 1;
    return {
      x: (vec.x * 0.5 + 0.5) * w,
      y: (-vec.y * 0.5 + 0.5) * h,
      visible,
      distance: dist,
    };
  }

  private computeHudProjection(): HudProjectionData {
    const spline = this.currentSpline;

    const controlPoints = spline.controlPoints.map((cp, index) => {
      const proj = spline.worldToIntrinsic(cp.x, 0, cp.z);
      const wx = cp.x + proj.sample.nx * 0.14;
      const wz = cp.z + proj.sample.nz * 0.14;
      return {
        id: cp.id,
        index,
        screen: this.projectWorldPoint(wx, 0.04, wz),
        worldX: cp.x,
        worldZ: cp.z,
      };
    });

    const artworks = this.currentArtworks
      .filter((a) => a.location === 'wall')
      .map((art) => {
        const totalD = art.standoff + art.autoCurveClearance + art.frameDepth;
        const c = spline.intrinsicToWorld(art.u, art.h, totalD);
        const top = spline.intrinsicToWorld(
          art.u,
          art.h + art.height * 0.5 + 0.08,
          totalD
        );
        const bot = spline.intrinsicToWorld(
          art.u,
          art.h - art.height * 0.5 - 0.08,
          totalD
        );
        const right = spline.intrinsicToWorld(
          art.u + art.width * 0.5 + 0.06,
          art.h,
          totalD
        );
        const standoffPt = spline.intrinsicToWorld(
          art.u + art.width * 0.5 + 0.1,
          art.h + art.height * 0.35,
          totalD + 0.08
        );

        return {
          id: art.id,
          center: this.projectWorldPoint(c.x, c.y, c.z),
          topCenter: this.projectWorldPoint(top.x, top.y, top.z),
          bottomCenter: this.projectWorldPoint(bot.x, bot.y, bot.z),
          rightEdgeCenter: this.projectWorldPoint(right.x, right.y, right.z),
          standoffHandle: this.projectWorldPoint(
            standoffPt.x,
            standoffPt.y,
            standoffPt.z
          ),
        };
      });

    const gaps = this.currentGaps.map((rel) => {
      const leftArt = this.currentArtworks.find((a) => a.id === rel.leftArtId);
      const rightArt = this.currentArtworks.find((a) => a.id === rel.rightArtId);
      const u0 = leftArt ? leftArt.u + leftArt.width * 0.5 : 0;
      const u1 = rightArt ? rightArt.u - rightArt.width * 0.5 : 1;
      const hMid =
        leftArt && rightArt ? (leftArt.h + rightArt.h) * 0.5 : this.currentEyeLevel;

      const midWorld = spline.intrinsicToWorld((u0 + u1) * 0.5, hMid, 0.025);
      const lWorld = spline.intrinsicToWorld(u0, hMid, 0.025);
      const rWorld = spline.intrinsicToWorld(u1, hMid, 0.025);

      const polylineScreen: { x: number; y: number }[] = [];
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const u = u0 + ((u1 - u0) * i) / steps;
        const p = spline.intrinsicToWorld(u, hMid, 0.02);
        const sp = this.projectWorldPoint(p.x, p.y, p.z);
        if (sp.visible) {
          polylineScreen.push({ x: sp.x, y: sp.y });
        }
      }

      return {
        pairKey: rel.pairKey,
        relation: rel,
        midpoint: this.projectWorldPoint(midWorld.x, midWorld.y, midWorld.z),
        leftEdge: this.projectWorldPoint(lWorld.x, lWorld.y, lWorld.z),
        rightEdge: this.projectWorldPoint(rWorld.x, rWorld.y, rWorld.z),
        polylineScreen,
      };
    });

    const lights = this.currentLights.map((light) => {
      const targetW = spline.intrinsicToWorld(light.targetU, light.targetH, 0.03);
      const fixtureU = Math.max(
        0.1,
        Math.min(spline.totalLength - 0.1, light.targetU + light.trackOffsetU)
      );
      const trackSample = spline.sampleAtU(fixtureU);
      const fx = trackSample.x + trackSample.nx * light.trackDistance;
      const fy = WALL_HEIGHT - 0.03;
      const fz = trackSample.z + trackSample.nz * light.trackDistance;

      const beamDist = Math.hypot(targetW.x - fx, targetW.y - fy, targetW.z - fz);
      const radiusOnWall = Math.min(
        1.35,
        Math.tan(THREE.MathUtils.degToRad(light.coneAngleDeg)) * beamDist * 0.72
      );

      const rimRightW = spline.intrinsicToWorld(
        Math.min(spline.totalLength, light.targetU + radiusOnWall),
        light.targetH,
        0.03
      );
      const penumbraTopW = spline.intrinsicToWorld(
        light.targetU,
        Math.min(WALL_HEIGHT - 0.1, light.targetH + radiusOnWall * (0.55 + light.penumbra * 0.45)),
        0.03
      );

      // Compute grazing incidence angle relative to wall vertical plane
      const horizDist = Math.hypot(targetW.x - fx, targetW.z - fz);
      const vertDrop = Math.max(0.1, fy - targetW.y);
      const incidenceDeg = Math.round(
        THREE.MathUtils.radToDeg(Math.atan2(horizDist, vertDrop))
      );

      return {
        id: light.id,
        targetCenter: this.projectWorldPoint(targetW.x, targetW.y, targetW.z),
        fixtureScreen: this.projectWorldPoint(fx, fy, fz),
        coneRimRight: this.projectWorldPoint(rimRightW.x, rimRightW.y, rimRightW.z),
        penumbraRimTop: this.projectWorldPoint(
          penumbraTopW.x,
          penumbraTopW.y,
          penumbraTopW.z
        ),
        incidenceDeg,
      };
    });

    const conflicts = this.currentConflicts.map((conflict) => {
      const w = spline.intrinsicToWorld(conflict.u, conflict.h, 0.08);
      return {
        conflict,
        screen: this.projectWorldPoint(w.x, w.y, w.z),
      };
    });

    const ghostArtworks: HudProjectionData['ghostArtworks'] = [];
    if (
      (this.showGhostOverlay || this.activeDrag?.kind === 'control-point') &&
      this.currentGhostSnapshot
    ) {
      const gSpline = new WallSplineEngine(
        this.currentGhostSnapshot.wallPoints,
        120
      );
      for (const gArt of this.currentGhostSnapshot.artworks) {
        if (gArt.location !== 'wall') continue;
        const gw = gSpline.intrinsicToWorld(gArt.u, gArt.h, gArt.standoff + 0.02);
        const curr = this.currentArtworks.find((a) => a.id === gArt.id);
        let movedDist = 0;
        if (curr && curr.location === 'wall') {
          const cw = spline.intrinsicToWorld(curr.u, curr.h, curr.standoff + 0.02);
          movedDist = Math.hypot(cw.x - gw.x, cw.y - gw.y, cw.z - gw.z);
        }
        ghostArtworks.push({
          id: gArt.id,
          title: gArt.title,
          screen: this.projectWorldPoint(gw.x, gw.y + gArt.height * 0.5 + 0.08, gw.z),
          movedDistance: movedDist,
        });
      }
    }

    const rackPos = this.stagingRackGroup.position;
    const rackScreen = this.projectWorldPoint(rackPos.x, 1.15, rackPos.z);

    return {
      controlPoints,
      artworks,
      gaps,
      lights,
      conflicts,
      ghostArtworks,
      rackScreen,
    };
  }

  private startLoop() {
    const tick = () => {
      this.animFrameId = requestAnimationFrame(tick);

      if (this.cameraAnim.active) {
        this.camera.position.lerp(this.cameraAnim.targetPos, 0.09);
        this.controls.target.lerp(this.cameraAnim.targetLookAt, 0.09);
        if (
          this.camera.position.distanceTo(this.cameraAnim.targetPos) < 0.015 &&
          this.controls.target.distanceTo(this.cameraAnim.targetLookAt) < 0.015
        ) {
          this.cameraAnim.active = false;
        }
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.callbacks.onProjectionUpdate(this.computeHudProjection());
    };
    tick();
  }

  public dispose() {
    cancelAnimationFrame(this.animFrameId);
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
