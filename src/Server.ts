
class Server
{
	private server: NodeWebServer;

	constructor()
	{
		process.on( 'message', ( message ) =>
		{
console.log('child:',message);
			if ( typeof message !== 'object' ) { return; }
			switch ( message.command )
			{
				case 'start': return this.start( (<NoWSToChildMessage<'start'>>message).data );
				case 'stop': return this.stop();
			}
		} );
		this.send( 'prepare', {} );
	}

	private send<T extends keyof NoWSToParentMessageMap>( command: T, data: NoWSToParentMessageMap[ T ] ) { (<any>process).send( { command: command, data: data } ); }

	public start( config: ServerConfig )
	{
		const WebServer = require( './Server/Static' ).Server;
		const server: NodeWebServer = new WebServer();
		server.init( config ).then( () =>
		{
			server.start();
		} );
	}

	public stop()
	{
		if ( !this.server ) { return; }
		this.server.stop();
	}
}

const server = new Server();
