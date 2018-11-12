"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Log_1 = require("./Log");
Object.freeze(Object.prototype);
class Server {
    constructor() {
        this.onMessage = () => { };
        process.on('message', (message) => {
            console.debug('Child:', message);
            if (typeof message !== 'object') {
                return;
            }
            switch (message.command) {
                case 'start': return this.start(message.data);
                case 'stop': return this.stop();
                case 'alive': return this.alive();
                default: return this.onMessage(message);
            }
        });
        this.send('prepare', {});
    }
    setOnMessage(onmsg) {
        if (typeof onmsg !== 'function') {
            return;
        }
        this.onMessage = onmsg;
    }
    send(command, data) { process.send({ command: command, data: data }); }
    start(config) {
        if (config.log) {
            Log_1.default(config.log);
        }
        return this.stop().then(() => {
            if (this.server) {
                this.server.stop();
                this.server = null;
            }
            const WebServer = require(config.module || './Server/Static');
            if (!WebServer) {
                throw new Error('Cannot require:' + (config.module || './Server/Static'));
            }
            if (typeof WebServer.default !== 'function') {
                throw new Error('Notfound default function.');
            }
            const server = WebServer.default(config);
            if (!server || typeof server.init !== 'function' || typeof server.start !== 'function' || typeof server.stop !== 'function' || typeof server.alive !== 'function') {
                throw new Error('Cannot create server.');
            }
            return server.init(config, this).then(() => {
                return server.start();
            }).then(() => {
                this.server = server;
                if (config.user === undefined || typeof process.getuid !== 'function') {
                    return;
                }
                if (config.user === process.getuid()) {
                    return;
                }
                process.setuid(config.user);
            });
        }).catch((error) => {
            this.abort(error);
        });
    }
    abort(error) {
        this.send('aborted', error);
        process.exit(1);
    }
    stop() {
        if (!this.server) {
            return Promise.resolve();
        }
        return this.server.stop().then(() => {
            this.send('stop', {});
            process.exit(0);
        });
    }
    alive() {
        if (!this.server) {
            this.send('alive', false);
            return Promise.resolve();
        }
        return this.server.alive().then((alive) => { this.send('alive', alive); });
    }
}
const server = new Server();
