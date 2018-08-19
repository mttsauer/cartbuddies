var express = require('express');
const superagent = require('superagent');
var logger = require('morgan');
var jsonQuery = require('json-query');

var router = express.Router();

router.get('/collections/all/products/:id.json', function(req, res, next) {

  var productResponse = {product : { variants : [{id: 1, title: '18m'}, {id: 2, title: '24m'}, {id: 3, title: '2t'} ]}};
  var success = Math.random() > .95;

  console.log('Sending: ' + success);
  res.status(success ? 200 : 404);
  res.send(success ? productResponse : 'Product not found');
});

router.get('/cart/:id::qty', function(req, res, next) {
  res.send("You now have " + req.params.qty + " of product id " + req.params.id + " in your cart" );
});


module.exports = router;
