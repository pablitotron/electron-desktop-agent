//const DriverInterface = require('driverInterface').DriverInterface;
const fs = require('fs');

exports.FileDriver = class FileDriver extends DriverInterface {

    constructor() {
        super();
    }

    init(path) {
        bufsize = 1; // line buffer
        this.filename = path;
        // this.file = open(path, "a", bufsize);
    }

    sendCommand(command, parameters, skipStatusErrors = false) {
        let message = "OUTPUT Command: " + command + ", Parameters: " + parameters;
        fs.writeFile(path, message);
        // file.write("Command: %d, Parameters: %s\n" % (command, parameters));
        console.log(message);
        randomNumber = getRandomInteger(2, 12432);
        return getCommandResponse("", randomNumber, 10);
    }        

    close() {
        fs.close();        
    }        

    start() {
        // Iniciar
    }

    end() {
    }

    reconnect() {
    }

    set() {
    }
    
    raw() {
    }

}