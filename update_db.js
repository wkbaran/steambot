var querystring = require('querystring');
var https = require('https');
var sqlite3 = require('sqlite3');

var storeHost = 'store.steampowered.com';
var apiHost = 'api.steampowered.com';
var key = 'AC22331922706F778FA00DF35099120B';
var root = '/home/wkbaran/webapps/steambot';
var dataDir = root+'/data';

function performRequest ( host, endpoint, method, data, success ) {
  var dataString = JSON.stringify(data);
  var headers = {};
  
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

/*
* Get the list of apps from Steam
* @param {function(object)} takeData - where to send the data
*/
function getAppList ( takeData ) {
  performRequest(apiHost,'/ISteamApps/GetAppList/v2/','GET',{},takeData);
}

/*
* Get the info for a particular app from Steam web services.
* @param {int} appid - the Steam app id
* @param {function(object)} takeData - where to send the data
*/
function getAppData ( appid, name, takeData ) {
  console.log("Getting appData for "+name+" ("+appid+")");
  performRequest(storeHost,'/api/appdetails/','GET',{appids:appid},
    takeData(appid,name) );
}

/**
* Create all tables needed.
* If they already exist then nothing happens.
* @param {Database} db - sqlite database object
*/
function createTables ( db ) {
  db.run("create table if not exists steamgames ( "+
    "steam_appid int primary key, "+
    "set_date datetime default current_timestamp, "+
    "name text, "+
    "is_free int, "+
    "initial_price real, "+
    "final_price real, "+
    "discount_percent int, "+
    "recommendations int, "+
    "coming_soon int, "+
    "release_date date "+
    ")");
}

/*
* Open sqlite database
* @param {string} path Directory to load data from
* @return {Database} sqlite3 Database object
*/
function openDb ( path ) {
  return new sqlite3.Database(path+'/steambot.db');
}

/*
* Update database with app data from Steam.
* Doesn't do antything if app.
* @param {Database} db database reference
* @param {int} appid Steam id of the app
* @param {string} name the name of the game. Not stored, just for logging
* @param {object} data 
*/
function updateApp ( db, appid, name, data ) {
  console.log("\nUpdating app "+name+" ("+appid+")");
  if ( data[appid].success ) {
    var realdata = data[appid].data;
    var insertData = 
      {
        $appid: appid,
        $name: realdata.name,
        $is_free: realdata.is_free,
        $initial_price: realdata.price_overview.initial,
        $final_price: realdata.price_overview.final,
        $discount_percent: realdata.price_overview.discount_percent,
        $recommendations: realdata.recommendations.total,
        $coming_soon: realdata.release_date.coming_soon,
        $release_date: realdata.release_date.date
      };
    console.log("Inserting data "+JSON.stringify(insertData));
    db.run( "insert or replace into steamgames ("+
        "steam_appid, name, is_free, initial_price, final_price, "+
        "discount_percent, recommendations, coming_soon, release_date ) "+
        "values ( $appid, $name, $is_free, $initial_price, "+
        "$final_price, $discount_percent, "+
        "$recommendations, $coming_soon, $release_date )",
        insertData,
        function (error) { 
          if ( error ) 
            console.log("Failed to save "+name+" ("+appid+"): "+error); } ); 
  } else {
    console.log("No data found for "+name+" ("+appid+"), skipping");
  }
}

/*
* Curry updateApp for inclusion in loop
*/
var storeData = function ( id, name ) {
  return function ( data ) {
    updateApp( db, id, name, data );
  };
};

// Ok, let's start processing
var db = openDb(dataDir);
createTables(db);
getAppList(function( data ) { 
  var realdata = data.applist.apps;
  for ( i = 0; i < 5; i++ ) {
    var id = realdata[i].appid;
    var name = realdata[i].name;
    getAppData(  id, name, storeData );
  }
});



