import Config from './Config'
import * as fs from './Pfs'
//import * as Static from './Static'
//import Monitor from './Monitor'
import * as path from 'path'
import * as child from 'child_process'

// TODO:
// Proxy server
// Operation server

class WebServer
{
	private child: child.ChildProcess;

	constructor( config: ServerConfig )
	{
console.log('start:',path.join( path.dirname( process.argv[ 1 ] ), 'Server.js' ));
		this.child = child.fork( path.join( path.dirname( process.argv[ 1 ] ), 'Server.js' ) );

		this.child.on( 'message', ( message ) =>
		{
console.log('parent:',message);
			if ( typeof message !== 'object' ) { return; }
			switch ( message.command )
			{
				case 'prepare': return this.start( config ); //<NoWSToParentMessage<'prepare'>>message
			}
		} );
	}

	public send<T extends keyof NoWSToChildMessageMap>( command: T, data: NoWSToChildMessageMap[ T ] )
	{
		this.child.send( { command: command, data: data } );
	}

	public start( data: ServerConfig )
	{
		this.send( 'start', data );
	}

	public stop()
	{
		this.send( 'stop', {} );
	}
}

export default class NoWS
{
	private config: Config;
	//private server: Monitor | null;
	//private servers: { [ key: string ]: NodeWebServer };
	private servers: { [ key: string ]: WebServer };

	constructor( config: Config )
	{
		this.config = config;
		this.servers = {};
		//this.server = new Monitor( this.config.get(), this );
	}

	// API
/*
	public getConfig() { return this.config; }

	public getServer( url: string ): NodeWebServer|null { return this.servers[ url ]; }

	public getServers() { return this.servers; }

	public getServerUrls() { return Object.keys( this.servers ); }
*/
	public stopServer( url: string )
	{
//		if ( !this.servers[ url ] ) { return false; }
//		this.servers[ url ].stop();
//		delete this.servers[ url ];
		return true;
	}

	// Server(manager)

/*	private createStaticServer( conf: ServerConfig )
	{
		if ( !conf.docs ) { return null; }
		try
		{
			const stat = fs.statSync( conf.docs );
			if ( !stat.isDirectory() ) { throw 'Not directory: ' + conf.docs; }
			const server = Static.CreateServer( conf );
			return server;
		} catch( error ){}
		return null;
	}*/

	private startServer( config: ServerConfig )
	{
		const server = new WebServer( config );
		return server;
	}

	public start()
	{
		return this.config.load().then( () =>
		{
			/*if ( main )
			{
				if ( !this.server ) { this.server = new Monitor( this.config.get(), this ); }
				this.server.start();
			}*/

			this.config.gets().forEach( ( conf ) =>
			{
				const key = ( conf.ssl && conf.ssl.key && conf.ssl.cert ? 'https://' : 'http://' ) + conf.host + ':' + conf.port;

				if ( conf.disable )
				{
					// TODO: stop.
					return;
				}

				this.servers[ key ] = this.startServer( conf );

				if ( conf.docs )
				{
//					const server = this.createStaticServer( conf );
//					if ( !server ) { return; }
					//if ( this.servers[ key ] ) { this.servers[ key ].stop(); }
//					this.servers[ key ] = server;
				}
			} );

		} );
	}

	public stop()
	{
		/*if ( main && this.server )
		{
			this.server.stop();
			this.server = null;
		}*/

/*		Object.keys( this.servers ).forEach( ( url ) =>
		{
			this.servers[ url ].stop();
			delete this.servers[ url ];
		} );*/
	}
}
