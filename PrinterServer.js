//'use strict';

const http = require("http");
const Router = require('node-simple-router');
const EventEmitter = require('events').EventEmitter;

exports.PrinterServer = class PrinterServer extends EventEmitter {
    constructor(port) {
        super();
        this.port = port;
    }

    init() {
        this.emit('event', 'Initializing Printer Server...');
        this.router = new Router();
        this.router.get("/status", function(request, response) {
            //this.emit('event', 'Printer status requested');
            response.end("Hola Mundo!");
        });

        this.server = http.createServer(this.router);
        // server.on('request', function(request, response) {
        // });
        this.server.listen(this.port);
        this.emit('event', 'PrinterServer listening on port ' + this.port);
    }
}

exports.PrinterServer