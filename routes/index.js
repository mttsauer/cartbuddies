var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Start a Cart', website: req.param('website'), product: req.param('product'), size: req.param('size') });
});

router.get('/x:command', function(req, res, next) {
  res.render('index', { title: 'Start a Cart', command: req.params.command });
});

module.exports = router;
