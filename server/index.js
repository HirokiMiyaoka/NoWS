"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NoWS_1 = require("./NoWS");
const Config_1 = require("./Config");
Object.freeze(Object.prototype);
const nows = new NoWS_1.default(new Config_1.default((2 < process.argv.length) ? process.argv[2] : './conf/'));
nows.start().then(() => {
}).catch((error) => {
    console.error(error);
});
