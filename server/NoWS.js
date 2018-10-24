"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const child = require("child_process");
class WebServer {
    constructor(config) {
        this.config = config;
        this.child = child.fork(path.join(path.dirname(process.argv[1]), 'Server.js'));
        this.child.on('message', (message) => {
            console.log('parent:', message);
            if (typeof message !== 'object') {
                return;
            }
            this.onMessage(message);
        });
    }
    onMessage(message) {
        switch (message.command) {
            case 'prepare': return this.start(this.config);
        }
    }
    send(command, data) {
        this.child.send({ command: command, data: data });
    }
    start(data) {
        this.send('start', data);
        return Promise.resolve();
    }
    stop() {
        this.send('stop', {});
        return Promise.resolve();
    }
    alive() {
        return Promise.resolve(true);
    }
}
class MonitorServer extends WebServer {
    constructor(config, nows) {
        super(config);
        this.nows = nows;
    }
    onMessage(message) {
        switch (message.command) {
            case 'prepare': return this.start(this.config);
            case 'servers': return this.getServerList();
        }
    }
    getServerList() {
        const data = { max: 0, list: [] };
        const servers = this.nows.getServers();
        const p = [];
        Object.keys(servers).forEach((url) => {
            const server = { url: url, alive: false };
            p.push(servers[url].alive().then((alive) => { server.alive = alive; }));
            data.list.push(server);
        });
        return Promise.all(p).then(() => {
            data.list.sort((a, b) => { return a.url < b.url ? -1 : 1; });
            this.send('servers', data);
        });
    }
}
class NoWS {
    constructor(config) {
        this.config = config;
        this.servers = {};
    }
    getServers() { return this.servers; }
    stopServer(url) {
        return true;
    }
    startServer(config) {
        if (config.module === path.join(path.dirname(process.argv[1]), './Server/Monitor')) {
            console.log('start monitor:');
            return new MonitorServer(config, this);
        }
        return new WebServer(config);
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
