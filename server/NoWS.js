"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const child = require("child_process");
class WebServer {
    constructor(config) {
        console.log('start:', path.join(path.dirname(process.argv[1]), 'Server.js'));
        this.child = child.fork(path.join(path.dirname(process.argv[1]), 'Server.js'));
        this.child.on('message', (message) => {
            console.log('parent:', message);
            if (typeof message !== 'object') {
                return;
            }
            switch (message.command) {
                case 'prepare': return this.start(config);
            }
        });
    }
    send(command, data) {
        this.child.send({ command: command, data: data });
    }
    start(data) {
        this.send('start', data);
    }
    stop() {
        this.send('stop', {});
    }
}
class NoWS {
    constructor(config) {
        this.config = config;
        this.servers = {};
    }
    stopServer(url) {
        return true;
    }
    startServer(config) {
        const server = new WebServer(config);
        return server;
    }
    start() {
        return this.config.load().then(() => {
            this.config.gets().forEach((conf) => {
                const key = (conf.ssl && conf.ssl.key && conf.ssl.cert ? 'https://' : 'http://') + conf.host + ':' + conf.port;
                if (conf.disable) {
                    return;
                }
                this.servers[key] = this.startServer(conf);
                if (conf.docs) {
                }
            });
        });
    }
    stop() {
    }
}
exports.default = NoWS;
