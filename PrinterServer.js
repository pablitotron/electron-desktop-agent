//'use strict';

const http = require("http");
const Router = require('node-simple-router');
const EventEmitter = require('events').EventEmitter;
const ConfigReader = require('./ConfigReader').ConfigReader;

exports.PrinterServer = class PrinterServer extends EventEmitter {
    
    constructor(port) {
        super();
        this.port = port;
    }

    init() {
        this.emit('event', 'Initializing Printer Server...');
        this.router = new Router();
        var that = this;

        this.router.get("/status", function(request, response) {
            that.emit('event', 'Printer status requested');
            response.end("it's alive!");
        });

        this.router.get("/impresoras", function(request, response) {
            that.emit('event', 'Obtener impresoras configuradas');

            let configReader = new ConfigReader();
            response.end("Impresora configurada: "
                + configReader.impresoraMarca + " "
                + configReader.impresoraModelo);
        });

        this.server = http.createServer(this.router);
        // server.on('request', function(request, response) {
        // });
        this.server.listen(this.port);
        this.emit('event', 'PrinterServer listening on port ' + this.port);
    }
}

exports.PrinterServer