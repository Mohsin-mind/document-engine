const express = require('express');
const ctrl = require('./rules.controller');

const router = express.Router();

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);
router.post('/:id/publish', ctrl.publish);
router.post('/:id/test', ctrl.test);
router.post('/:id/generate-sample', ctrl.generateSample);
router.delete('/:id', ctrl.remove);

module.exports = router;
