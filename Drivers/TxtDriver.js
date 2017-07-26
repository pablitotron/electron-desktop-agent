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
        message = String.fromCharCode(0x02) + String.fromCharCode(98) + String.fromCharCode(command);
        if (fields) {
            message += String.fromCharCode(0x1c);
        }
        message += String.fromCharCode(0x1c).join(fields);
        message += String.fromCharCode(0x03);
        // checkSum = sum([ord(x) for x in message ]);
        checkSum = this.getCheckSum(message);
        // checkSumHexa = ("0000" + hex(checkSum)[2:])[-4:].upper();
        checkSumHexa = ("0000" + checkSum.toString(16).substring(2)).substring(checkSum.length - 4).toUpperCase();
        message += checkSumHexa;
        console.log(message);
        // this.file.write(message + "\n");
        fs.writeFile(path, message);        
        randomNumber = getRandomInteger(2, 12432);
        return getCommandResponse("", randomNumber, 10);
    }

    getCheckSum(message) {
        let checkSum = 0;
        for(i = 0; i < message.length; i++) {
            checkSum += message[i].charCodeAt(0);
        }
        return checkSum;
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