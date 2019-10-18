
var mysql = require('mysql');
var http = require('http');
var qs = require('querystring');
require('buffer').Buffer;


// function creates a MySQL connection
function sqlConn() {
    var conn = mysql.createConnection({
        host: "localhost",
        user: "user",
        password: "password",
        database: "lpttest"
    });
    return conn;
}

// function decodes the MySQL data and returns it with a callback
function decodeSQL(callback, conn) {
    // SQL query to select data
    var sql = "SELECT HEX(trace_data) as `data`, trace_time FROM test";
    
    // object to hold the data
    var dt = {};
    
    // MySQL query to get and decode blob data
    conn.query(sql, function (e, res) {                    
        if (e) {
            throw e;        
        }
        
        // loop through each blob
        for (var i=0; i<res.length; i++) {
            // format timestamp to match instructions
            var ts = new Date(res[i]['trace_time']);
            var time = ts.toLocaleString();

            // get byte array of MySQL data
            var buff = Buffer.from(res[i]['data'],'hex');
            
            // array to hold datapoints
            var datapoints = [];                        
            
            // break blob into 4 byte chunks and convert to signed integer / float value
            for (var j=0; j<buff.length; j+=4) {
                var tempbuff = buff.slice(j,j+4);
                var val = (tempbuff.readInt32BE(0))/1000;
                // add each value to the array
                datapoints.push(val);                            
            }

            // store the decoded data
            dt[i] = {'dpts':datapoints, 'time':time};        
        }
        
        return callback(dt);                                                           
    });
}

// create http server
http.createServer(function (request, response) {
    
    // process POST data
    if (request.method == 'POST') {        
        var reqdt = '';        
        
        // receive and store data contained in POST
        request.on('data', function(data) {
            reqdt += data;
            
            // kill connection if request flooded with data
            if (reqdt.length > 1e6) {
                request.connection.destroy();
            }
        })

        // process data from POST
        request.on('end', function() {
            
            // decode the parameter sent in POST
            var cmd = qs.parse(reqdt);

            // object to store the blobs
            var blobs = {};            
            
            // look for proper parameter
            if (cmd.cmd == 'send') {

                // connect to MySQL
                var conn = sqlConn();
                conn.connect();

                // decode the data and send JSON back to request
                decodeSQL(function(res) {
                    blobs = res;
                    var json = JSON.stringify(blobs);
                    response.writeHead(200, {'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*'});
                    response.end(json);                    
                }, conn);                
            }
        })
    }
    
}).listen(8080);
