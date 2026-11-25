export {
	CAMERA_FOV_UPDATE_EPSILON,
	CAMERA_FRAMING_GUARD_POLICY,
	CAMERA_MOTION_DEFAULT_EASING,
	CAMERA_MOTION_PATH,
	CAMERA_MOTION_TIMING,
	CAMERA_POSE_EPSILON,
	cameraApplyEasing,
	cameraInverseEasing,
	cameraMotionEdgeProgressAtProgress,
	cameraMotionProgressAtEdgeProgress,
	compileCameraPositionPath,
	createCameraMotion,
	createCameraMotionSample,
	createCameraPositionPath,
	createEditorCardinalSnapMotion,
	EDITOR_CARDINAL_SNAP_DURATION_MS,
	readCameraFramingGuardStatus,
	resolveCameraMotionDuration,
	resolveCameraMotionEasing,
	sampleCameraMotion,
	sampleFramingEnvelopeWeight,
	smootherstepRamp,
	sphericalDirectionLerp,
	VISITOR_CAMERA_PROJECTION,
} from '../camera-motion';

export type {
	CameraFramingGuardStatus,
	CameraMotion,
	CameraMotionOptions,
	CameraMotionSample,
	CameraPose,
	CameraPositionDistanceSpan,
	CameraPositionEdgeDistanceSpan,
	CameraPositionPathLocation,
	CameraPositionPathPart,
	CameraPositionPathSpan,
	CameraRoute,
	CameraRouteEdge,
	CameraRouteView,
	CameraRouteViewKeyframe,
	CameraRouteViewTrack,
	CardinalSnapMotion,
	CardinalSnapMotionSample,
	CompiledCameraPositionPath,
	Vector3Like,
} from '../camera-motion';

export {
	CameraRouteError,
	getCameraConnectionRoute,
	getCameraMotionOptions,
	getCameraRoute,
} from '../camera-route';

export type {
	CameraRouteErrorKind,
	ResolvedCameraRoute,
} from '../camera-route';

export type {
	CameraConnectionDirection,
	CameraConnectionTiming,
	CameraConnectionViewTracks,
	CameraEasing,
	CameraFramingEnvelope,
	CameraGraphConnection,
	CameraGraphNode,
	CameraPathAnchor,
	CameraPositionPath,
	CameraViewKeyframe,
	Vec3,
} from '../scene-types';

export {
	CAMERA_EASING,
	CAMERA_FOV,
} from '../scene-types';
