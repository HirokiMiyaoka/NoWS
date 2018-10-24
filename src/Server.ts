
class Server implements ChildServer
{
	private server: NodeWebServer | null;
	private onMessage: ( message: any ) => void;

	constructor()
	{
		this.onMessage = () => {};
		process.on( 'message', ( message ) =>
		{
console.log('child:',message);
			if ( typeof message !== 'object' ) { return; }
			switch ( message.command )
			{
				case 'start': return this.start( (<NoWSToChildMessage<'start'>>message).data );
				case 'stop': return this.stop();
				default: return this.onMessage( message );
			}
		} );
		this.send( 'prepare', {} );
	}

	public setOnMessage( onmsg: ( message: any ) => void )
	{
		if ( typeof onmsg !== 'function' ) { return; }
		this.onMessage = onmsg;
	}

	public send<T extends keyof NoWSToParentMessageMap>( command: T, data: NoWSToParentMessageMap[ T ] ) { (<any>process).send( { command: command, data: data } ); }

	public start( config: ServerConfig )
	{
		return this.stop().then( () =>
		{
			if ( this.server ) { this.server.stop(); this.server = null; }

			const WebServer = require( config.module || './Server/Static' );
console.log('start',WebServer);
			if ( !WebServer ) { throw Error( 'Cannot require:' + ( config.module || './Server/Static' ) ); }
			if ( typeof WebServer.default !== 'function' ) { throw Error( 'Notfound default function.' ); }

			const server: NodeWebServer = WebServer.default( config );

			if ( !server || typeof server.init !== 'function' || typeof server.start !== 'function'|| typeof server.stop !== 'function'|| typeof server.alive !== 'function' ) { throw Error( 'Cannot create server.' ); }

			return server.init( config, this ).then( () =>
			{
				return server.start();
			} ).then( () =>
			{
				this.server = server;
				if ( config.user === undefined || typeof process.getuid !== 'function' ) { return; }
				if ( config.user === process.getuid() ) { return; }
				process.setuid( config.user );
			} );
		} ).catch( ( error ) =>
		{
			this.send( 'aborted', error );
		} );
	}

	public stop()
	{
		if ( !this.server ) { return Promise.resolve(); }
		return this.server.stop();
	}
}

const server = new Server();
