import Config from './Config'
import * as fs from './Pfs'
import * as Static from './Static'
import Monitor from './Monitor'
import * as path from 'path'

// TODO:
// Proxy server
// Operation server

export default class Server
{
	private config: Config;
	private server: Monitor | null;
	private servers: { [ key: string ]: NodeWebServer };

	constructor( config: Config )
	{
		this.config = config;
		this.servers = {};
		this.server = new Monitor( this.config.get(), this );
	}

	// API

	public getConfig() { return this.config; }

	public getServer( url: string ): NodeWebServer|null { return this.servers[ url ]; }

	public getServers() { return this.servers; }

	public getServerUrls() { return Object.keys( this.servers ); }

	public stopServer( url: string )
	{
		if ( !this.servers[ url ] ) { return false; }
		this.servers[ url ].stop();
		delete this.servers[ url ];
		return true;
	}

	// Server(manager)

	private createStaticServer( conf: ServerConfig )
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
	}

	public start( main: boolean )
	{
		return this.config.load().then( () =>
		{
			if ( main )
			{
				if ( !this.server ) { this.server = new Monitor( this.config.get(), this ); }
				this.server.start();
			}

			this.config.gets().forEach( ( conf ) =>
			{
				if ( conf.disable ) { return; }
				if ( conf.docs )
				{
					const server = this.createStaticServer( conf );
					if ( !server ) { return; }
					const key = ( conf.ssl && conf.ssl.key && conf.ssl.cert ? 'https://' : 'http://' ) + conf.host + ':' + conf.port;
					//if ( this.servers[ key ] ) { this.servers[ key ].stop(); }
					this.servers[ key ] = server;
				}
			} );
		} );
	}

	public stop( main: boolean )
	{
		if ( main && this.server )
		{
			this.server.stop();
			this.server = null;
		}

		Object.keys( this.servers ).forEach( ( url ) =>
		{
			this.servers[ url ].stop();
			delete this.servers[ url ];
		} );
	}
}
