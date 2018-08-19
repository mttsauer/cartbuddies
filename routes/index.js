var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Start a Cart' });
});

router.get('/x:command', function(req, res, next) {
  res.render('index', { title: 'Start a Cart', command: req.params.command });
});

module.exports = router;
