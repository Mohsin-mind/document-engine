const express = require('express');
const multer = require('multer');
const ctrl = require('./template.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', ctrl.list);
router.post('/', upload.single('file'), ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);
router.post('/:id/versions/:versionId/mappings', ctrl.saveMappings);
router.post('/:id/versions/:versionId/test', ctrl.runTest);
router.post('/:id/versions/:versionId/publish', ctrl.publish);
router.post('/:id/generate-sample', ctrl.generateSample);
router.delete('/:id', ctrl.remove);

module.exports = router;
