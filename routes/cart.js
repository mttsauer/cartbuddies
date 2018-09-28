var express = require('express');
const superagent = require('superagent');
var jsonQuery = require('json-query');
const uuidv4 = require('uuid/v4');
var stringSimilarity = require('string-similarity');
const normalizeUrl = require('normalize-url');

var winston = require('winston');

const logger = winston.createLogger({
    level: 'silly',
    format: winston.format.json(),
    transports: [new winston.transports.Console()]
  });

const retryDelay = 500; //client
const retryCount = 300; //server ( 5 min )
const serverDelay = 2000; //server 2 sec
const similarityThreshold = .85;  //

var router = express.Router();

//TODO: create some sort of timeout for the data to be stored.
globalData = {};

/* POST and new product request */
router.post('/', function(req, res, next) {

  if(req.param("action") == "go"){
    logger.log( 'verbose',  'Action: go');
    try{
      go(req,res);
    } catch(e) {
      logger.log( 'error',  'error in go', e)
    }
  }
  else if(req.param("action") == "test") {
    logger.log( 'verbose', 'Action: test');
    req.body.website = req.protocol + "://" + req.headers.host +  "/mock";
    try{
      go(req,res);
    } catch(e) {
      logger.log( 'error',  'error in go', e)
    }
  }
  else {
    logger.log( 'verbose', 'Action: link');
    url = '/?website=' + req.body.website + '&product=' + req.body.product + '&size=' + req.body.size
    logger.log( 'silly', 'Redirecting to ' + url);
    res.redirect(url);
  }
});

router.get('/id-:uuid', function(req, res, next) {

  var data = globalData[req.params.uuid];
  logger.log( 'verbose', 'getting data: ', [req.params.uuid,data]);

  if(!data) {
    logger.log( 'silly', 'no data redirecting to root');
    res.redirect('/');
  }

  logger.log( 'silly', 'returning data.response');
  res.send(data.response);
});

go = function(req, res){
  var uuid = uuidv4();
  
  globalData[uuid] = {};
  globalData[uuid].errors = 0;

  logger.log( 'silly', 'normalizing website', [uuid,req.body.website]);

  try{
    var cleanWebsite = normalizeUrl(req.body.website);
  }catch(e){
    logger.log('error', e);
    res.redirect('/');
  }

  logger.log( 'silly', 'calling requestForSiteProducts', uuid);
  globalData[uuid].response = { delay: retryDelay, message: 'Checking inventory...' }
  requestForSiteProducts(cleanWebsite, req.body.product, req.body.size, uuid);  
  
  logger.log( 'silly', 'redirecting to polling page', uuid);
  res.redirect('/id-' + uuid + '?website='+cleanWebsite+'&product='+req.body.product+'&size='+req.body.size);
}

requestForSiteProducts = function(website, product, variantTitle, uuid, i){
  i=i?i:0;
  logger.log( 'info', 'requestForSiteProducts:' + i);

  superagent.get(website + '/collections/all/products.json').end((err,response) => {
    if(err) {
      logger.log( 'error',  [uuid, err]);
      
      globalData[uuid].errors++
      if( globalData[uuid].errors < 5 ){
        logger.log( 'info', 'retrying request', [uuid, website, product, variantTitle, i]);
        throttled = true; //actually check the response
        setTimeout( function(){requestForSiteProducts(website, product, variantTitle, uuid, ++i)}, serverDelay * (throttled?10:1));
      } else {
        globalData[uuid].response = { delay: 0, message: 'Could not find any products on this site.  Stopping Bot.  Try again later', count: i };
      }
      return;
    }

    logger.log( 'verbose', 'returned response:', [uuid, {data:response.body}])
    products = jsonQuery('products.title', {data:response.body}).value;
    logger.log( 'verbose', '', [uuid, products]);

    if(!products || products.size === 0) {
      logger.log( 'verbose', 'No Products', [uuid]);
      globalData[uuid].response = { delay: retryDelay, message: 'No matching products found yet. The search continues...', count: i };
      if(i < retryCount) {
        logger.log( 'info', 'retrying request', [uuid, website, product, variantTitle, i]);
        setTimeout( function(){requestForSiteProducts(website, product, variantTitle, uuid, ++i)}, serverDelay);
      }
      return;
    }

    var match = {};
 
    logger.log( 'silly', 'finding best match', [uuid, product, products]);
    try{
      match = stringSimilarity.findBestMatch(product, products);
    }catch(e){
      logger.log( 'error',  'error finding similarity', [uuid, product, products]);
    }

    if( !match || !match.bestMatch || match.bestMatch.rating < similarityThreshold ) {
      logger.log( 'verbose', 'No Products within threshold', [uuid]);
      globalData[uuid].response = { delay: retryDelay, message: 'No matching products found yet. The search continues', count: i };
      if(i < retryCount) {
        logger.log( 'info', 'retrying request', [uuid, website, product, variantTitle, i]);
        setTimeout( function(){requestForSiteProducts(website, product, variantTitle, uuid, ++i)}, serverDelay);
      }
      return;
    }

    actualProduct = jsonQuery('products[title=' + match.bestMatch.target + ']', {data:response.body}).value;
    logger.log( 'silly', 'product found', [uuid, actualProduct]);

    requestForProduct(website, actualProduct.handle, variantTitle, uuid, i++); 
  });
}

requestForProduct = function(website, handle, variantTitle, uuid, i){
  i=i?i:0;
  logger.log( 'info', 'requestForProduct:', [uuid, i]);

  var url = website + '/collections/all/products/' + handle + '.json';
  logger.log( 'info', 'Getting product URL', [uuid, url]);

  superagent.get(url).end((err, response) => {
    if (err) { 
      logger.log( 'error',  [uuid, err]); 
      globalData[uuid].response = { delay: retryDelay, message: 'Product not yet available', count: i };
      if(i < retryCount) {
        logger.log( 'info', 'retrying request', [uuid, website, product, variantTitle, i]);
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
      logger.log( 'error',  'error finding similarity', [uuid, product, products]);
    }

    if( !match || !match.bestMatch || match.bestMatch.rating < similarityThreshold ) {
      logger.log( 'verbose', 'No variants within threshold', [uuid]);
      globalData[uuid].response = { delay: 0, message: 'Product found, but that size isn\'t available.  Please try another size', count: i };
      logger.log( 'silly', 'no recursive call because no variants will change in another request', uuid);
      return;
    }

    var variant;

    try{
      logger.log( 'silly', 'finding exact variant');
      variant = jsonQuery('product.variants[title=' + match.bestMatch.target + '].id', {data:response.body}).value;  
    } catch(e){
      logger.log( 'error',  'error finding variant from best matching title', [uuid, e]);
    }
    
    if(!variant) {
      logger.log( 'silly', 'no variant found', uuid);
      globalData[uuid].response = { delay: 0, message: 'Product found, but that size isn\'t available.  Please try another size', count: i };
      return;
    }

    globalData[uuid].response = { redirect: website + '/cart/' + variant + ':1' };
    logger.log( 'info', 'SUCCESS!', [uuid,globalData[uuid].response]);
  });
}

module.exports = router;
