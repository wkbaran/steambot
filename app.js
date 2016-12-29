var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    mime = require("mime");
    port = process.argv[2] || 27933;

http.createServer(function(request, response) {

  var uri = url.parse(request.url).pathname,
    filename = path.join(process.cwd(), uri);
  
  fs.exists(filename, function(exists) {
    // Only serve content out of the public directory,
    // and only serve files
    if ( !exists || 
         !uri.startsWith("/public/") ||
         fs.statSync(filename).isDirectory() ) {
      response.writeHead(404, {"Content-Type": "text/plain"});
      response.write("404 Not Found\n");
      response.end();
      return;
    }

    fs.readFile(filename, "binary", function(err, file) {
      if(err) {        
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.write(err + "\n");
        response.end();
        return;
      }
  
      response.writeHead(200, {"Content-Type": mime.lookup(filename)});
      response.write(file, "binary");
      response.end();
    });

  });

}).listen(parseInt(port, 10));
