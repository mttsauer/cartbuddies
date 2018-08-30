var express = require('express');
const superagent = require('superagent');
var logger = require('morgan');
var jsonQuery = require('json-query');
const uuidv4 = require('uuid/v4');
var stringSimilarity = require('string-similarity');
const winston = require('winston');
const normalizeUrl = require('normalize-url');

const retryDelay = 200; //client
const retryCount = 60; //server ( 1 min )
const serverDelay = 1000; //server 1 sec
const similarityThreshold = .85;  //

var router = express.Router();

//TODO: create some sort of timeout for the data to be stored.
globalData = {};

/* POST and new product request */
router.post('/', function(req, res, next) {

  if(req.param("action") == "go"){
    winston.log('verbose', 'Action: go');
    try{
      go(req,res);
    } catch(e) {
      winston.log('error', 'error in go', e)
    }
  }
  else if(req.param("action") == "test") {
    winston.log('verbose', 'Action: test');
    req.body.website = req.protocol + "://" + req.headers.host +  "/mock";
    try{
      go(req,res);
    } catch(e) {
      winston.log('error', 'error in go', e)
    }
  }
  else {
    winston.log('verbose', 'Action: link');
    url = '/?website=' + req.body.website + '&product=' + req.body.product + '&size=' + req.body.size
    winston.log('silly', 'Redirecting to ' + url);
    res.redirect(url);
  }
});

router.get('/id-:uuid', function(req, res, next) {

  var data = globalData[req.params.uuid];
  winston.log('verbose', 'getting data: ', [req.params.uuid,data]);

  if(!data) {
    winston.log('silly', 'no data redirecting to root');
    res.redirect('/');
  }

  winston.log('silly', 'returning data.response');
  res.send(data.response);
});

go = function(req, res){
  var uuid = uuidv4();
  
  globalData[uuid] = {};

  winston.log('silly', 'normalizing website', [uuid,req.body.website]);
  var cleanWebsite = normalizeUrl(req.body.website);

  winston.log('silly', 'calling requestForSiteProducts', uuid);
  globalData[uuid].response = { delay: retryDelay, message: 'Checking inventory...' }
  requestForSiteProducts(cleanWebsite, req.body.product, req.body.size, uuid);  
  
  winston.log('silly', 'redirecting to polling page', uuid);
  res.redirect('/id-' + uuid + '?website='+cleanWebsite+'&product='+req.body.product+'&size='+req.body.size);
}

requestForSiteProducts = function(website, product, variantTitle, uuid, i){
  i=i?i:0;
  winston.log('info', 'requestForSiteProducts:' + i);

  superagent.get(website + '/collections/all/products.json').end((err,response) => {
    if(err) {
      winston.log('error', [uuid, err]);
      globalData[uuid].response = { delay: retryDelay, message: 'Could not find any products on this site.  Stopping Bot', count: i };
      return;
    }

    winston.log('verbose', 'returned response:', [uuid, {data:response.body}])
    products = jsonQuery('products.title', {data:response.body}).value;
    winston.log('verbose', '', [uuid, products]);

    if(!products || products.size === 0) {
      winston.log('verbose', 'No Products', [uuid]);
      globalData[uuid].response = { delay: retryDelay, message: 'No matching products found yet. The search continues', count: i };
      if(i < retryCount) {
        winston.log('info', 'retrying request', [uuid, website, product, variantTitle, i]);
        setTimeout( function(){requestForSiteProducts(website, product, variantTitle, uuid, ++i)}, serverDelay);
      }
      return;
    }

    var match = {};
 
    winston.log('silly', 'finding best match', [uuid, product, products]);
    try{
      match = stringSimilarity.findBestMatch(product, products);
    }catch(e){
      winston.log('error', 'error finding similarity', [uuid, product, products]);
    }

    if( !match || !match.bestMatch || match.bestMatch.rating < similarityThreshold ) {
      winston.log('verbose', 'No Products within threshold', [uuid]);
      globalData[uuid].response = { delay: retryDelay, message: 'No matching products found yet. The search continues', count: i };
      if(i < retryCount) {
        winston.log('info', 'retrying request', [uuid, website, product, variantTitle, i]);
        setTimeout( function(){requestForSiteProducts(website, product, variantTitle, uuid, ++i)}, serverDelay);
      }
      return;
    }

    actualProduct = jsonQuery('products[title=' + match.bestMatch.target + ']', {data:response.body}).value;
    winston.log('silly', 'product found', [uuid, actualProduct]);

    requestForProduct(website, actualProduct.handle, variantTitle, uuid, i++); 
  });
}

requestForProduct = function(website, handle, variantTitle, uuid, i){
  i=i?i:0;
  winston.log('info', 'requestForProduct:', [uuid, i]);

  var url = website + '/collections/all/products/' + handle + '.json';
  winston.log('info', 'Getting product URL', [uuid, url]);

  superagent.get(url).end((err, response) => {
    if (err) { 
      winston.log('error', [uuid, err]); 
      globalData[uuid].response = { delay: retryDelay, message: 'Product not yet available', count: i };
      if(i < retryCount) {
        winston.log('info', 'retrying request', [uuid, website, product, variantTitle, i]);
        setTimeout( function(){equestForProduct(url,uuid, variantTitle, ++i)}, serverDelay);
      }
      return;
    }

    var variants = {};
    var match = {};
    try{
      variants = jsonQuery('product.variants.title', {data:response.body}).value;
      match = stringSimilarity.findBestMatch(variantTitle, variants);
    }catch(e){
      winston.log('error', 'error finding similarity', [uuid, product, products]);
    }

    if( !match || !match.bestMatch || match.bestMatch.rating < similarityThreshold ) {
      winston.log('verbose', 'No variants within threshold', [uuid]);
      globalData[uuid].response = { delay: 0, message: 'Product found, but that size isn\'t available.  Please try another size', count: i };
      winston.log('silly', 'no recursive call because no variants will change in another request', uuid);
      return;
    }

    var variant;

    try{
      winston.log('silly', 'finding exact variant');
      variant = jsonQuery('product.variants[title=' + match.bestMatch.target + '].id', {data:response.body}).value;  
    } catch(e){
      winston.log('error', 'error finding variant from best matching title', [uuid, e]);
    }
    
    if(!variant) {
      winston.log('silly', 'no variant found', uuid);
      globalData[uuid].response = { delay: 0, message: 'Product found, but that size isn\'t available.  Please try another size', count: i };
      return;
    }

    globalData[uuid].response = { redirect: website + '/cart/' + variant + ':1' };
    winston.log('info', 'SUCCESS!', [uuid,globalData[uuid].response]);
  });
}

module.exports = router;
