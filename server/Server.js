class Server {
    constructor() {
        process.on('message', (message) => {
            console.log('child:', message);
            if (typeof message !== 'object') {
                return;
            }
            switch (message.command) {
                case 'start': return this.start(message.data);
                case 'stop': return this.stop();
            }
        });
        this.send('prepare', {});
    }
    send(command, data) { process.send({ command: command, data: data }); }
    start(config) {
        const WebServer = require('./Server/Static').Server;
        const server = new WebServer();
        server.init(config).then(() => {
            server.start();
        });
    }
    stop() {
        if (!this.server) {
            return;
        }
        this.server.stop();
    }
}
const server = new Server();
