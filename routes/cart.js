var express = require('express');
const superagent = require('superagent');
var logger = require('morgan');
var jsonQuery = require('json-query');

const retryDelay = 200;

var router = express.Router();

globalData = {};

/* POST and new product request */
router.post('/', function(req, res, next) {

  var sessionId = req.session.id;
  globalData[sessionId] = {};

  //TODO: Add some cleaning logic
  //TODO: find reasonable logger
  var url = req.body.website + '/collections/all/products/' + req.body.product.split(' ').join('-').toLowerCase() + '.json';

  globalData[sessionId].response = { delay: retryDelay, message: 'Checking inventory...' }
  requestForProduct(url, sessionId, req.body.size);  
  
  globalData[sessionId].website = req.body.website;
  res.redirect('/xcheckStatus');
});

router.get('/', function(req, res, next) {

  var session = globalData[req.session.id];

  if(!session)
    res.redirect('/');

  res.send(session.response);
});

requestForProduct = function(url, sessionId, variantTitle, i){
  i=i?i:0;
  console.log('requestForProduct:' + i);
  superagent.get(url).end((err, response) => {
    if (err) { 
      console.log(err); 
      globalData[sessionId].response = { delay: retryDelay, message: 'Product not yet available', count: i };
      setTimeout( function(){requestForProduct(url,sessionId, variantTitle, ++i)}, 1000); //Delay?
      return; 
    }

    variant = jsonQuery('product.variants[title=' + variantTitle + '].id', {data:response.body}).value;
    
    if(!variant) {
      globalData[sessionId].response = { delay: 0, message: 'Product found, but that size isn\'t available', count: 1 }
      return;
    }

    globalData[sessionId].response = { redirect: globalData[sessionId].website + '/cart/' + variant + ':1' }
  });
}

module.exports = router;
