"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Server_1 = require("./Server");
const Config_1 = require("./Config");
const server = new Server_1.default(new Config_1.default((2 < process.argv.length) ? process.argv[2] : './conf/'));
server.start(true).then(() => {
    console.log('Start');
}).catch((error) => {
    console.log(error);
});
