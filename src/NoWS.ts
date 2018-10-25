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
	protected config: ServerConfig;
	protected child: child.ChildProcess;
	protected p:
	{
		alive: ( ( value: boolean ) => void )[],
	};

	constructor( config: ServerConfig )
	{
		this.config = config;
		this.p = { alive: [] };
		this.child = child.fork( path.join( path.dirname( process.argv[ 1 ] ), 'Server.js' ) );

		this.child.on( 'message', ( message ) =>
		{
console.log('parent:',message);
			if ( typeof message !== 'object' ) { return; }
			switch ( message.command )
			{
				case 'prepare': return this.start( this.config );
				case 'alive': return this.alived( <NoWSToParentMessage<'alive'>>message );
				default: this.onMessage( message );
			}
		} );
	}

	protected onMessage( message: any )
	{
	}

	public send<T extends keyof NoWSToChildMessageMap>( command: T, data: NoWSToChildMessageMap[ T ] )
	{
		this.child.send( { command: command, data: data } );
	}

	public start( data: ServerConfig )
	{
		this.send( 'start', data );
		return Promise.resolve();
	}

	public stop()
	{
		this.send( 'stop', {} );
		return Promise.resolve();
	}

	private alived( message: NoWSToParentMessage<'alive'> )
	{
		this.p.alive.forEach( ( resolve ) => { resolve( !!message.data ); } );
		this.p.alive = [];
	}

	public alive()
	{
		return new Promise<boolean>( ( resolve, reject ) =>
		{
			this.p.alive.push( resolve );
			this.send( 'alive', {} );
		} );
	}
}

function Timeout<T>( time: number, p: Promise<T> )
{
	return new Promise<T>( ( resolve, reject ) =>
	{
		let timeout = false;
		// I want to cancel Promise.
		const timer = setTimeout( () => { timeout = true; reject( Error( 'timeout' ) ); }, time );
		p.then( ( data ) =>
		{
			if ( timeout ) { return; } // Rejected.
			clearTimeout( timer );
			resolve( data );
		} ).catch( ( error ) => { reject( error ); } );
	} );
}

class MonitorServer extends WebServer
{
	private nows: NoWS;

	constructor( config: ServerConfig, nows: NoWS )
	{
		super( config );
		this.nows = nows;

	}

	protected onMessage( message: any )
	{
		switch ( <keyof NoWSToParentMessageMap>message.command )
		{
			case 'servers': return this.getServerList();
		}
	}

	private getServerList()
	{
		const data: ResponseServerList = { max: 0, list: [] };

		const servers = this.nows.getServers();
		const p: Promise<void>[] = [];

		Object.keys( servers ).forEach( ( url ) =>
		{
			const server = { url: url, alive: false };
			p.push( Timeout<boolean>( 5000, servers[ url ].alive() ).catch( () => { return false } ).then( ( alive ) =>
			{
				server.alive = alive;
			} ) );
			data.list.push( server );
		} );

		return Promise.all( p ).then( () =>
		{
			data.list.sort( ( a, b ) => { return a.url < b.url ? -1 : 1; } );
			this.send( 'servers', data );
		} );
	}
}

export default class NoWS
{
	private config: Config;
	private servers: { [ key: string ]: WebServer };

	constructor( config: Config )
	{
		this.config = config;
		this.servers = {};
	}

	// API

	public getServers() { return this.servers; }
/*
	public getConfig() { return this.config; }

	public getServer( url: string ): NodeWebServer|null { return this.servers[ url ]; }

	public getServerUrls() { return Object.keys( this.servers ); }
*/
	public stopServer( url: string )
	{
//		if ( !this.servers[ url ] ) { return false; }
//		this.servers[ url ].stop();
//		delete this.servers[ url ];
		return true;
	}

	private startServer( config: ServerConfig )
	{
		if ( config.module === path.join( path.dirname( process.argv[ 1 ] ), './Server/Monitor' ) )
		{
			return new MonitorServer( config, this );
		}
		return new WebServer( config );
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

			this.config.gets().forEach( ( config ) =>
			{
				const key = ( config.ssl && config.ssl.key && config.ssl.cert ? 'https://' : 'http://' ) + config.host + ':' + config.port;

				if ( config.disable )
				{
					// TODO: stop.
					return;
				}

				this.servers[ key ] = this.startServer( config );
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
