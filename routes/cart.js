var express = require('express');
const superagent = require('superagent');
var logger = require('morgan');
var jsonQuery = require('json-query');
const uuidv4 = require('uuid/v4');

const retryDelay = 200; //client
const retryCount = 60; //server ( 1 min )

var router = express.Router();

//TODO: create some sort of timeout for the data to be stored.
globalData = {};

/* POST and new product request */
router.post('/', function(req, res, next) {

  if(req.param("action") == "go")
    go(req,res);
  else if(req.param("action") == "test") {
    req.body.website = req.protocol + "://" + req.headers.host +  "/mock";
    go(req,res);
  }
  else {
    
    res.redirect('/?website=' + req.body.website + '&product=' + req.body.product + '&size=' + req.body.size );
  }
});

router.get('/id-:uuid', function(req, res, next) {

  var data = globalData[req.params.uuid];

  if(!data)
    res.redirect('/');

  res.send(data.response);
});

go = function(req, res){
  var uuid = uuidv4();
  
  globalData[uuid] = {};

  //TODO: Add some cleaning logic
  //TODO: find reasonable logger
  var url = req.body.website + '/collections/all/products/' + req.body.product.split(' ').join('-').toLowerCase() + '.json';

  globalData[uuid].response = { delay: retryDelay, message: 'Checking inventory...' }
  requestForProduct(url, uuid, req.body.size);  
  
  globalData[uuid].website = req.body.website;
  res.redirect('/id-' + uuid);
}

requestForProduct = function(url, uuid, variantTitle, i){
  i=i?i:0;
  console.log('requestForProduct:' + i);
  superagent.get(url).end((err, response) => {
    if (err) { 
      console.log(err); 
      globalData[uuid].response = { delay: retryDelay, message: 'Product not yet available', count: i };
      if(i < retryCount)
        setTimeout( function(){requestForProduct(url,uuid, variantTitle, ++i)}, 1000); //Delay?
      return; 
    }

    variant = jsonQuery('product.variants[title=' + variantTitle + '].id', {data:response.body}).value;
    
    if(!variant) {
      globalData[uuid].response = { delay: 0, message: 'Product found, but that size isn\'t available', count: 1 }
      return;
    }

    globalData[uuid].response = { redirect: globalData[uuid].website + '/cart/' + variant + ':1' }
  });
}

module.exports = router;
