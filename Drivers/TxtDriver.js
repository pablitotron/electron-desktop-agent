//const DriverInterface = require('driverInterface').DriverInterface;
const fs = require('fs');

exports.TxtDriver = class TxtDriver extends DriverInterface {

    constructor() {
        super();
    }

    init(path) {
        this.filename = path;
        bufsize = 1; //line buffer
        // this.file = open(this.filename, "w", bufsize);
    }

    sendCommand(command, fields, skipStatusErrors = false) {
        message = chr(0x02) + chr(98) + chr(command);
        if (fields) {
            message += chr(0x1c);
        }
        message += chr(0x1c).join(fields);
        message += chr(0x03);
        checkSum = sum([ord(x) for x in message ]);
        checkSumHexa = ("0000" + hex(checkSum)[2:])[-4:].upper();
        message += checkSumHexa;
        console.log(message);
        // this.file.write(message + "\n");
        fs.writeFile(path, message);        
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

}