// import serial
const SerialPort = require("serialport").SerialPort;

// import sys

// debugEnabled(*args) {
//     print >> sys.stderr, " ".join(map(str, args));
// }

// debugDisabled(*args) {
//     debug = debugDisabled;
// }

class PrinterError extends Error {
}

class UnknownServerError extends PrinterError {
    errorNumber = 1;
}

class ComunicationError extends PrinterError {
    errorNumber = 2;
}

class PrinterStatusError extends PrinterError {
    errorNumber = 3;
}

class FiscalStatusError extends PrinterError {
    errorNumber = 4;
}

class ProxyError extends PrinterError {
    errorNumber = 5;
}

const ServerErrors = [UnknownServerError, ComunicationError, PrinterStatusError, FiscalStatusError];

const WAIT_TIME = 10;

const RETRIES = 4;

const WAIT_CHAR_TIME = 0.1;

const NO_REPLY_TRIES = 200;

exports.FiscalPrinterDriver = class FiscalPrinterDriver extends DriverInterface {

    init(path, speed = 9600) {
        this.serialPort = serial.Serial(port = path, timeout = null, baudrate = speed);
        this.initSequenceNumber();
    }

    close() {
        try {
            this.serialPort.close();
        } catch (error) {
            console.log("Error el cerrar el puerto serie: " + this.serialPort.port);
        }
    }

    sendCommand(commandNumber, fields, skipStatusErrors = false) {
        // fields = map(lambda x:x.encode("latin-1", 'ignore'), fields);
        fields = getEncodedMap(fields);
        message = String.fromCharCode(0x02) + String.fromCharCode(this.sequenceNumber) + String.fromCharCode(commandNumber);
        if (fields) {
            message += String.fromCharCode(0x1c);
        }
        message += String.fromCharCode(0x1c).join(fields);
        message += String.fromCharCode(0x03);
        // checkSum = sum([ord(x) for x in message ] );
        checkSum = this.getCheckSum(message);
        // checkSumHexa = ("0000" + hex(checkSum)[2:])[-4:].upper();
        checkSumHexa = ("0000" + checkSum.toString(16).substring(2)).substring(checkSum.length - 4).toUpperCase();
        message += checkSumHexa;
        reply = this.sendMessage(message);
        this.incrementSequenceNumber();
        return this.parseReply(reply, skipStatusErrors);
    }

    getEncodedMap(elements) {
        let encodedMap = new Map();
        elements.forEach(function(element) {
            encodedMap.set(element, element.encode("latin-1", 'ignore'));
        }, this);
        return encodedMap;
    }

    getCheckSum(message) {
        let checkSum = 0;
        for (i = 0; i < message.length; i++) {
            checkSum += message[i].charCodeAt(0);
        }
        return checkSum;
    }

    write(s) {
        // debug("write", ", ".join(["%x" % ord(c) for c in s ] ) );
        console.debug("write, " + getCharCodeString(s));
        this.serialPort.write(s);
    }

    read(count) {
        ret = this.serialPort.read(count);
        // debug("read", ", ".join(["%x" % ord(c) for c in ret ] ) );
        console.debug("read, " + getCharCodeString(ret));
        return ret;
    }

     getCharCodeString(cadena) {
        let salida = "";
        for (i = 0; i < cadena.length; i++) {
            salida += cadena[i].charCodeAt(0);
        }
        return salida;
    }

    del() {
        if (hasattr("serialPort")) {
            try {
                this.close();
            } catch (error) {
                console.log(error.message);
            }
        }
    }

    parseReply(reply, skipStatusErrors) {
        // Saco STX < Nro Seq> <Nro Comando> <Sep> ... ETX
        // r = reply[4:-1];
        let r = reply.substring(4, length - 2);
        fields = r.split(String.fromCharCode(28));
        printerStatus = fields[0];
        fiscalStatus = fields[1];
        if (!skipStatusErrors) {
            this.parsePrinterStatus(printerStatus);
            this.parseFiscalStatus(fiscalStatus);
        }
        return fields;
    }

    parsePrinterStatus(printerStatus) {
        x = int(printerStatus, 16);
        for (value, message in this.printerStatusErrors) {
            if ((value & x) == value) {
                throw new FiscalStatusError(message);
            }
        }
    }

    parseFiscalStatus(fiscalStatus) {
        let x = int(fiscalStatus, 16);
        for (value, message in this.fiscalStatusErrors) {
            if ((value & x) == value) {
                throw new FiscalStatusError(message);
            }
        }
    }

    checkReplyBCC(reply, bcc) {
        // debug("reply", reply, [ord(x) for x in reply]);
        console.debug("reply " + reply + getCharCodeString(reply));
        // checkSum = sum([ord(x) for x in reply ]);
        checkSum = getCheckSum(reply);
        // debug("checkSum", checkSum);
        console.debug("checkSum " + checkSum);
        // checkSumHexa = ("0000" + hex(checkSum)[2:])[-4:].upper();
        checkSumHexa = ("0000" + checkSum.toString(16).substring(2)).substring(checkSum.length - 4).toUpperCase();
        // debug("checkSumHexa", checkSumHexa);
        console.debug("checkSumHexa", checkSumHexa);
        // debug("bcc", bcc);
        console.debug("bcc", bcc);
        return checkSumHexa == bcc.toUpperCase();
    }

}