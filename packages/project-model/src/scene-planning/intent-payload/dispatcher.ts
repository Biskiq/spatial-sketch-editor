import {
	readCreateFormPayload,
	readPlaceFormCopyPayload,
	readSetFormSizePayload,
	readSetFormProfilePayload,
} from './form';
import {
	readPlaceObjectPayload,
	readCreateLightPayload,
	readUpdateLightPayload,
	readDuplicatePayload,
} from './objects';
import {
	readSupportMovePayload,
	readSetYawPayload,
	readPlaceOnFloorPayload,
	readResizePayload,
	readSetLiftPayload,
} from './transform';
import { type SceneOperationPayload } from './types';
import { ShapeReader } from '../../strict-shape';

/** Read the payload for one registered operation kind. */
export function readSceneOperationPayload(
	reader: ShapeReader,
	kind: string,
	raw: unknown,
): SceneOperationPayload | null {
	switch (kind) {
		case 'create-form':
			return readCreateFormPayload(reader, raw);
		case 'place-form-copy':
			return readPlaceFormCopyPayload(reader, raw);
		case 'set-form-size':
			return readSetFormSizePayload(reader, raw);
		case 'set-form-profile':
			return readSetFormProfilePayload(reader, raw);
		case 'place-object':
			return readPlaceObjectPayload(reader, raw);
		case 'move-horizontal':
			return readSupportMovePayload(reader, raw, 'move-horizontal');
		case 'set-yaw':
			return readSetYawPayload(reader, raw);
		case 'place-on-floor':
			return readPlaceOnFloorPayload(reader, raw);
		case 'resize-on-floor':
			return readResizePayload(reader, raw);
		case 'duplicate-one':
			return readDuplicatePayload(reader, raw);
		case 'delete-one': {
			const record = reader.object(raw, '$.payload', ['entityId']);
			if (record === null) return null;
			const entityId = reader.opaqueId(record.entityId, '$.payload.entityId');
			return entityId === null ? null : { kind: 'delete-one', entityId };
		}
		case 'set-lift':
			return readSetLiftPayload(reader, raw);
		case 'set-name': {
			const record = reader.object(raw, '$.payload', ['entityId', 'name']);
			if (record === null) return null;
			const entityId = reader.opaqueId(record.entityId, '$.payload.entityId');
			const name = reader.string(record.name, '$.payload.name');
			return entityId === null || name === null ? null : { kind: 'set-name', entityId, name };
		}
		case 'create-light':
			return readCreateLightPayload(reader, raw);
		case 'update-light':
			return readUpdateLightPayload(reader, raw);
		case 'duplicate-light': {
			const record = reader.object(raw, '$.payload', ['entityId']);
			if (record === null) return null;
			const entityId = reader.opaqueId(record.entityId, '$.payload.entityId');
			return entityId === null ? null : { kind: 'duplicate-light', entityId };
		}
		default:
			reader.problem(
				'$.kind',
				'unsupported-operation',
				`No Scene operation kind "${kind}" is registered`,
			);
			return null;
	}
}
