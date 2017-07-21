const fs = require('fs');
const ini = require('ini');
const CONFIG_FILE = './config.ini';

exports.ConfigReader = class ConfigReader {
    constructor(){
        this.config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
    }

    get impresoraMarca () { return this.config.impresora_fiscal.marca; }
    get impresoraModelo () { return this.config.impresora_fiscal.modelo; }
}
