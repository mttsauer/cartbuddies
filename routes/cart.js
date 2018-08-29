var express = require('express');
const superagent = require('superagent');
var logger = require('morgan');
var jsonQuery = require('json-query');
const uuidv4 = require('uuid/v4');
var stringSimilarity = require('string-similarity');

const retryDelay = 200; //client
const retryCount = 60; //server ( 1 min )
const similarityThreshold = .85;  //

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
  requestForSiteProducts(req.body.website, req.body.product, req.body.size, uuid);  
  
  globalData[uuid].website = req.body.website;
  res.redirect('/id-' + uuid + '?website='+req.body.website+'&product='+req.body.product+'&size='+req.body.size);
}

requestForSiteProducts = function(website, product, variantTitle, uuid, i){
  i=i?i:0;
  console.log('requestForSiteProducts:' + i);

  superagent.get(website + '/collections/all/products.json').end((err,response) => {
    if(err) {
      console.log(err);
      globalData[uuid].response = { delay: retryDelay, message: 'Could not find any products on this site.  Stopping Bot', count: i };
      return;
    }

    products = jsonQuery('products.title', {data:response.body}).value;
 
    match = stringSimilarity.findBestMatch(product, products);

    if( match.bestMatch.rating < similarityThreshold ) {
      globalData[uuid].response = { delay: retryDelay, message: 'No matching products found yet. The search continues', count: i };
      if(i < retryCount)
        setTimeout( function(){requestForSiteProducts(website, product, variantTitle, uuid, ++i)}, 1000); //Delay?
      return;
    }

    actualProduct = jsonQuery('products[title=' + match.bestMatch.target + ']', {data:response.body}).value;
    url = website + '/collections/all/products/' + actualProduct.handle + '.json';
    requestForProduct(url, variantTitle, uuid, i++); 
  });

}

requestForProduct = function(url, variantTitle, uuid, i){
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

    variants = jsonQuery('product.variants.title', {data:response.body}).value;

    var match = stringSimilarity.findBestMatch(variantTitle, variants);

    if( match.bestMatch.rating < similarityThreshold ) {
      globalData[uuid].response = { delay: 0, message: 'Product found, but that size isn\'t available.  Please try another size', count: i };
      //no recursive call because there is nothing that will change on another request.
      return;
    }

    variant = jsonQuery('product.variants[title=' + match.bestMatch.target + '].id', {data:response.body}).value;
    
    if(!variant) {
      globalData[uuid].response = { delay: 0, message: 'Product found, but that size isn\'t available.  Please try another size', count: i };
      return;
    }

    globalData[uuid].response = { redirect: globalData[uuid].website + '/cart/' + variant + ':1' }
  });
}

module.exports = router;
