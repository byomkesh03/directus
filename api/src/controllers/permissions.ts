import express from 'express';
import { ForbiddenException } from '../exceptions';
import { respond } from '../middleware/respond';
import useCollection from '../middleware/use-collection';
import { validateBatch } from '../middleware/validate-batch';
import { MetaService, PermissionsService } from '../services';
import type { PrimaryKey } from '../types';
import asyncHandler from '../utils/async-handler';
import { sanitizeQuery } from '../utils/sanitize-query';

const router = express.Router();

router.use(useCollection('directus_permissions'));

router.post(
	'/',
	asyncHandler(async (req, res, next) => {
		const service = new PermissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const savedKeys: PrimaryKey[] = [];

		if (Array.isArray(req.body)) {
			const keys = await service.createMany(req.body);
			savedKeys.push(...keys);
		} else {
			const key = await service.createOne(req.body);
			savedKeys.push(key);
		}

		try {
			if (Array.isArray(req.body)) {
				const items = await service.readMany(savedKeys, req.sanitizedQuery);
				res.locals['payload'] = { data: items };
			} else {
				const item = await service.readOne(savedKeys[0], req.sanitizedQuery);
				res.locals['payload'] = { data: item };
			}
		} catch (error: any) {
			if (error instanceof ForbiddenException) {
				return next();
			}

			throw error;
		}
		return next();
	}),
	respond
);

const readHandler = asyncHandler(async (req, res, next) => {
	const service = new PermissionsService({
		accountability: req.accountability,
		schema: req.schema,
	});

	const metaService = new MetaService({
		accountability: req.accountability,
		schema: req.schema,
	});

	let result;

	if (req.singleton) {
		result = await service.readSingleton(req.sanitizedQuery);
	} else if (req.body.keys) {
		result = await service.readMany(req.body.keys, req.sanitizedQuery);
	} else {
		result = await service.readByQuery(req.sanitizedQuery);
	}

	const meta = await metaService.getMetaForQuery('directus_permissions', req.sanitizedQuery);

	res.locals['payload'] = { data: result, meta };
	return next();
});

router.get('/', validateBatch('read'), readHandler, respond);
router.search('/', validateBatch('read'), readHandler, respond);

router.get(
	'/:pk',
	asyncHandler(async (req, res, next) => {
		if (req.path.endsWith('me')) return next();
		const service = new PermissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const record = await service.readOne(req.params['pk'], req.sanitizedQuery);

		res.locals['payload'] = { data: record };
		return next();
	}),
	respond
);

router.patch(
	'/',
	validateBatch('update'),
	asyncHandler(async (req, res, next) => {
		const service = new PermissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		let keys: PrimaryKey[] = [];

		if (Array.isArray(req.body)) {
			keys = await service.updateBatch(req.body);
		} else if (req.body.keys) {
			keys = await service.updateMany(req.body.keys, req.body.data);
		} else {
			const sanitizedQuery = sanitizeQuery(req.body.query, req.accountability);
			keys = await service.updateByQuery(sanitizedQuery, req.body.data);
		}

		try {
			const result = await service.readMany(keys, req.sanitizedQuery);
			res.locals['payload'] = { data: result };
		} catch (error: any) {
			if (error instanceof ForbiddenException) {
				return next();
			}

			throw error;
		}

		return next();
	}),
	respond
);

router.patch(
	'/:pk',
	asyncHandler(async (req, res, next) => {
		const service = new PermissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const primaryKey = await service.updateOne(req.params['pk'], req.body);

		try {
			const item = await service.readOne(primaryKey, req.sanitizedQuery);
			res.locals['payload'] = { data: item || null };
		} catch (error: any) {
			if (error instanceof ForbiddenException) {
				return next();
			}

			throw error;
		}

		return next();
	}),
	respond
);

router.delete(
	'/',
	validateBatch('delete'),
	asyncHandler(async (req, res, next) => {
		const service = new PermissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		if (Array.isArray(req.body)) {
			await service.deleteMany(req.body);
		} else if (req.body.keys) {
			await service.deleteMany(req.body.keys);
		} else {
			const sanitizedQuery = sanitizeQuery(req.body.query, req.accountability);
			await service.deleteByQuery(sanitizedQuery);
		}

		return next();
	}),
	respond
);

router.delete(
	'/:pk',
	asyncHandler(async (req, res, next) => {
		const service = new PermissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.deleteOne(req.params['pk']);

		return next();
	}),
	respond
);

export default router;
