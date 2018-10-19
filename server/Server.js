"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("./Pfs");
const Static = require("./Static");
const Monitor_1 = require("./Monitor");
class Server {
    constructor(config) {
        this.config = config;
        this.servers = {};
        this.server = new Monitor_1.default(this.config.get(), this);
    }
    getConfig() { return this.config; }
    getServer(url) { return this.servers[url]; }
    getServers() { return this.servers; }
    getServerUrls() { return Object.keys(this.servers); }
    createStaticServer(conf) {
        if (!conf.docs) {
            return null;
        }
        try {
            const stat = fs.statSync(conf.docs);
            if (!stat.isDirectory()) {
                throw 'Not directory: ' + conf.docs;
            }
            const server = Static.CreateServer(conf);
            return server;
        }
        catch (error) { }
        return null;
    }
    start(main) {
        return this.config.load().then(() => {
            if (main) {
                if (!this.server) {
                    this.server = new Monitor_1.default(this.config.get(), this);
                }
                this.server.start();
            }
            this.config.gets().forEach((conf) => {
                if (conf.disable) {
                    return;
                }
                if (conf.docs) {
                    const server = this.createStaticServer(conf);
                    if (!server) {
                        return;
                    }
                    const key = (conf.ssl && conf.ssl.key && conf.ssl.cert ? 'https://' : 'http://') + conf.host + ':' + conf.port;
                    this.servers[key] = server;
                }
            });
        });
    }
    stop(main) {
        if (main && this.server) {
            this.server.stop();
            this.server = null;
        }
        Object.keys(this.servers).forEach((url) => {
            this.servers[url].stop();
            delete this.servers[url];
        });
    }
}
exports.default = Server;
