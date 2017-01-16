var querystring = require('querystring');
var https = require('https');
var sqlite3 = require('sqlite3');

var storeHost = 'store.steampowered.com';
var root = '/home/wkbaran/webapps/steambot';
var dataDir = root+'/data';

/*
* Make a REST request
* @param {string} host
* @param {string} endpoint
* @param {string} method ['GET'|'POST']
* @param {object} data request params
* @param {cb} success function to accept response object
*/ 
function performRequest ( host, endpoint, method, data, success ) {
  var dataString = JSON.stringify(data);
  var headers = {};

  // Replace array with a string csv
  var csv = '';
  for ( let i of data.appids ) {
    if ( csv.length > 0 ) {
      csv += ',';
    }
    csv += i;
  }
  // Replace array with csv list, otherwise querystring.stringify
  // Will turn it into a list of params instead
  data.appids = csv;

  if (method == 'GET') {
    endpoint += '?' + querystring.stringify(data);
  }
  else {
    headers = {
      'Content-Type': 'application/json',
      'Content-Length': dataString.length
    };
  }
  var options = {
    host: host,
    path: endpoint,
    method: method,
    headers: headers
  };

  var req = https.request(options, function(res) {
    res.setEncoding('utf-8');

    var responseString = '';

    res.on('data', function(data) {
      responseString += data;
    });

    res.on('end', function() {
      var responseObject = JSON.parse(responseString);
      success(responseObject);
    });
  });

  req.write(dataString);
  req.end();
}

/**
* Create all tables needed.
* If they already exist then nothing happens.
* @param {Database} db - sqlite database object
*/
function createTables ( db ) {
  db.run("create table if not exists appprice ( "+
    "steam_appid int primary key, "+
    "set_date datetime default current_timestamp, "+
    "is_free int, initial_price real, "+
    "final_price real, "+
    "discount_percent int )");
}

/**
* Get list of appids from database
*/

/*
* Open sqlite database
* @param {string} path Directory to load data from
* @return {Database} sqlite3 Database object
*/
function openDb ( path ) {
  return new sqlite3.Database(path+'/steambot.db');
}

/*
* Store the pricing data for the given appid
* @param {sqlite3.Database} db
* @param {int} appid
* @param {function(err)} cb
*/
function updatePrices ( data ) {
//  console.log("Got batch: "+JSON.stringify(data));
  for ( var appid in data ) {
    if ( data[appid].success ) {
      updateAppPrice(appid,data[appid].data);
    } else {
      console.log("No data for "+appid);
    }
  }
}

function updateAppPrice ( appid, price_data ) {
  if ( !price_data.price_overview ) {
    console.log("Marking "+appid+" as free");
  } else {
    console.log("Adding price to "+appid);
  }
  db.run("insert or replace into appprice ( steam_appid, is_free, "+
    "initial_price, final_price, discount_percent ) values ( "+
    "$appid, $is_free, $init_price, $final_price, $disc )",
    {
      $appid: appid,
      $is_free: (price_data.price_overview ? false : true),
      $init_price: (price_data.price_overview ? 
        price_data.price_overview.initial : null),
      $final_price: (price_data.price_overview ?
        price_data.price_overview.final : null),
      $disc: (price_data.price_overview ?
        price_data.price_overview.discount_percent : null)
    },
    function (err) {
      if ( err ) {
        console.log("Failed to insert "+appid+"\n"+err);
      } else {
        console.log("Successfully updated "+appid);
      }
    }
  );
}

/*
* Get the info for a particular app from Steam web services.
* @param {array::int} appIds - the array of Steam app ids
* @param {function(object)} takeData - where to send the data
*/
function getPriceData ( appIds, takeData ) {
  // console.log("Looking for appIds: "+appIds);
  performRequest(
    storeHost,'/api/appdetails/','GET',
    {filters:"price_overview",appids:appIds}, takeData );
}

function openDb () {
  return new sqlite3.Database(dataDir+'/steambot.db');
}

var appIds = [];
sqlite3.verbose();
// var db = openDb(dataDir+'/steambot.db');
var db = openDb();
createTables(db);

db.each("select steam_appid from appname",
  function(err,row) {
    if ( err ) {
      console.log("Failed to load appid's. "+err);
    } else {
      appIds.push(row.steam_appid);
      if ( appIds.length == 170 ) {
        getPriceData(appIds,updatePrices);
        appIds = [];
      }
    }
  },
  function(err,row) { // Now finish up the remainder
    if ( err ) {
      console.log("Failed to load appid's. "+err);
    } else {
      getPriceData(appIds,updatePrices);
    }
  }
);



