var querystring = require('querystring');
var https = require('https');
// var fs = require('fs');
var sqlite3 = require('sqlite3');

var apiHost = 'api.steampowered.com';
var root = '/home/wkbaran/webapps/steambot';
var dataDir = root+'/data';

/**
* Open sqlite3 database for reading and writing
* @param {string} path path to db
* @return {sqlite3.Database}
*/
function openDb ( path ) {
  return new sqlite3.Database(path+'/steambot.db');
}

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
function createAppListTable ( db ) {
  db.run("create table if not exists appname ( "+
    "steam_appid int primary key, "+
    "set_date datetime default current_timestamp, "+
    "name text )");
}

/**
* @param {Database} db
* @param {int} appid
* @param {string} name
* @param {function} cb callback
*/
function updateApp ( db, appid, name, cb ) {
  db.run( "insert or replace into appname ("+
      "steam_appid, name ) values ( $appid, $name )",
      { $appid: appid, $name: name },
      function (error) { 
        if ( error ) 
          console.log("Failed to save "+name+" ("+appid+"): "+error); 
        else 
        if ( typeof cb === "function" ) cb();
      }); 
}

/*
* Get the list of apps from Steam
* @param {function(object)} takeData - where to send the data
*/
function getAppList ( takeData ) {
  performRequest(apiHost,'/ISteamApps/GetAppList/v2/','GET',{},takeData);
}

// Ok, let's start processing
var db = openDb(dataDir);
createAppListTable(db);
getAppList( function(data) {
  var realdata = data.applist.apps;
  var len = realdata.length;
  console.log("Updating "+len+" entries");
  var appidlist = "";
  realdata.forEach(function(n) {
    console.log("App id "+n.appid);
    updateApp(db,n.appid,n.name);
  });
});


