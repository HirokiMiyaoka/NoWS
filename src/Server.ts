import Log from './Log'

// Defend Object from prototype pollution.
Object.freeze( Object.prototype );

class Server implements ChildServer
{
	private server: NodeWebServer | null;
	private onMessage: ( message: any ) => void;

	constructor()
	{
		this.onMessage = () => {};
		process.on( 'message', ( message ) =>
		{
			console.debug( 'Child:', message );
			if ( typeof message !== 'object' ) { return; }
			switch ( message.command )
			{
				case 'start': return this.start( (<NoWSToChildMessage<'start'>>message).data );
				case 'stop': return this.stop();
				case 'alive': return this.alive();
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
		if ( config.log ) { Log( config.log ); }
		return this.stop().then( () =>
		{
			if ( this.server ) { this.server.stop(); this.server = null; }

			const WebServer = require( config.module || './Server/Static' );

			if ( !WebServer ) { throw new Error( 'Cannot require:' + ( config.module || './Server/Static' ) ); }
			if ( typeof WebServer.default !== 'function' ) { throw new Error( 'Notfound default function.' ); }

			const server: NodeWebServer = WebServer.default( config );

			if ( !server || typeof server.init !== 'function' || typeof server.start !== 'function'|| typeof server.stop !== 'function'|| typeof server.alive !== 'function' ) { throw new Error( 'Cannot create server.' ); }

			return server.init( config, this ).then( () =>
			{
				return server.start();
			} ).then( () =>
			{
				this.server = server;
				// Change uid.
				if ( config.user === undefined || typeof process.getuid !== 'function' ) { return; }
				if ( config.user === process.getuid() ) { return; }
				process.setuid( config.user );
			} );
		} ).catch( ( error ) =>
		{
			//error.code 'EADDRINUSE': (Address already in use): An attempt to bind a server (net, http, or https) to a local address failed due to another server on the local system already occupying that address.
			this.abort( error );
		} );
	}

	private abort( error: any )
	{
		this.send( 'aborted', error );
		process.exit( 1 );
	}

	public stop()
	{
		if ( !this.server ) { return Promise.resolve(); }
		return this.server.stop().then( () =>
		{
			this.send( 'stop', {} );
			process.exit( 0 );
		} );
	}

	public alive()
	{
		if ( !this.server ) { this.send( 'alive', false ); return Promise.resolve(); }
		return this.server.alive().then( ( alive ) => { this.send( 'alive', alive ); } );
	}
}

const server = new Server();
