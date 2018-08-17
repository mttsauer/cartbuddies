var express = require('express');
const superagent = require('superagent');
var jsonQuery = require('json-query');

const retryDelay = 200;

var router = express.Router();

fauxSession = {};

/* GET home page. */
router.post('/', function(req, res, next) {
  fauxSession[req.session.id] = {};

  //Add some cleaning logic
  var url = req.body.website + '/collections/all/products/' + req.body.product.split(' ').join('-').toLowerCase() + '.json';
  console.log(url);

  fauxSession[req.session.id].response = { delay: retryDelay, message: 'Checking inventory...' }
  requestForProduct(url, req);  
  
  fauxSession[req.session.id].website = req.body.website;
  console.log("returning response");
  res.render('cart', { title: 'Cart', product: req.body.product, size: req.body.size, site: req.body.website });
});

router.get('/', function(req, res, next) {

  var session = fauxSession[req.session.id];

  if(!session)
    res.redirect('/');

  res.send(session.response);
});

requestForProduct = function(url, req){

  superagent.get(url).end((err, response) => {
    if (err) { return console.log(err); }
    if(response.status != 200) { 
      fauxSession[req.session.id].response = { delay: retryDelay, message: 'Product not yet available' }
      console.log('Making another call');
      requestForProduct(url,req);
      return; 
    }

    variant = jsonQuery('product.variants[title=' + req.body.size + '].id', {data:response.body}).value;
    
    if(!variant) {
      fauxSession[req.session.id].response = { delay: 0, message: 'Product found, but that size isn\'t available' }
      return;
    }

    fauxSession[req.session.id].response = { redirect: fauxSession[req.session.id].website + '/cart/' + variant + ':1' }
  });
}

module.exports = router;
