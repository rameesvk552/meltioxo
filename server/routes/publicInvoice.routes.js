const router = require('express').Router();
const ctrl = require('../controllers/publicInvoice.controller');

router.get('/invoices/:id.pdf', ctrl.download);

module.exports = router;
