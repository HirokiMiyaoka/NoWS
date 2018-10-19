import * as fs from './Pfs'
import * as path from 'path'

interface _NoWSConfig extends _ServerConfig
{
	log: { err?: string | null, out?: string | null },
}

interface _ServerConfig extends ServerConfig
{
	ssl: { key: string, cert: string },
	disable: boolean,
	docs: string,
	mime: { [ key: string ]: string },
	replace: { pattern: string, substr: string },
}

interface ConfigEventMap
{
	add: ServerConfig,
	remove: ServerConfig,
	modify: ServerConfig,
	updated: null,
}

interface ConfigEventData<T extends keyof ConfigEventMap>
{
	type: T,
	data: ConfigEventMap[ T ],
}

export default class Config
{
	private dir: string;
	private conf: _NoWSConfig;
	private confs: { [ key: string ]: _ServerConfig };
	private event: { [ T in keyof ConfigEventMap ]: ( ( event: ConfigEventData<T> ) => void )[] };

	constructor( dir: string )
	{
		this.conf =
		{
			host: 'localhost',
			port: 18080,
			ssl: { key: '', cert: '' },
			disable: true,
			docs: path.join( path.dirname( process.argv[ 1 ] ), '../docs' ),
			mime: {},
			replace: { pattern: '', substr: '' },
			option: {},
			log: {},
		};
		this.confs = {};
		this.event =
		{
			add: [],
			remove: [],
			modify: [],
			updated: [],
		};
		this.dir = dir;
		//const confs = this.load( dir );
	}

	public get() { return <NoWSConfig>this.conf; }

	public gets(): ServerConfig[]
	{
		return Object.keys( this.confs ).map( ( key ) => { return this.confs[ key ]; } );
	}

	private diff( confs: { [ key: string ]: _ServerConfig } )
	{
		const diff: { add: { [ key: string ]: _ServerConfig }, remove: { [ key: string ]: _ServerConfig }, modify: { [ key: string ]: _ServerConfig } } = { add: {}, remove: {}, modify: {} };

		Object.keys( this.confs ).forEach( ( file ) =>
		{
			if ( !confs[ file ] )
			{
				diff.remove[ file ] = this.confs[ file ];
				return;
			}
			const a = confs[ file ];
			const b = this.confs[ file ];
			// TODO: modify check
			if ( a.host === b.host && a.port === b.port && a.ssl === b.ssl && a.disable === b.disable )
			{
				return;
			}
			diff.modify[ file ] = confs[ file ];
		} );
		Object.keys( confs ).forEach( ( file ) =>
		{
			if ( this.confs[ file ] ) { return; }
			diff.add[ file ] = confs[ file ];
		} );

		return diff;
	}

	public load()
	{
		return this.loadConfigs( this.dir ).then( ( confs ) =>
		{
			const diff = this.diff( confs );

			let update = false;
			Object.keys( diff.add ).forEach( ( file ) =>
			{
				update = true;
				this.confs[ file ] = confs[ file ];
				const data: ConfigEventData<'add'> = { type: 'add', data: confs[ file ] };
				this.event.add.forEach( ( listener ) => { listener( data ); } );
			} );
			Object.keys( diff.modify ).forEach( ( file ) =>
			{
				update = true;
				this.confs[ file ] = confs[ file ];
				const data: ConfigEventData<'modify'> = { type: 'modify', data: confs[ file ] };
				this.event.modify.forEach( ( listener ) => { listener( data ); } );
			} );
			Object.keys( diff.remove ).forEach( ( file ) =>
			{
				update = true;
				delete this.confs[ file ];
				const data: ConfigEventData<'remove'> = { type: 'remove', data: confs[ file ] };
				this.event.remove.forEach( ( listener ) => { listener( data ); } );
			} );
			if ( !update ) { return; }
			const data: ConfigEventData<'updated'> = { type: 'updated', data: null };
			this.event.updated.forEach( ( listener ) => { listener( data ); } );
		} );
	}

	public loadConfigs( dir: string )
	{
		return fs.readdir( dir ).then( ( files ) =>
		{
			return files.filter( ( file ) =>
			{
				if ( !file.match( /\.json5?$/ ) ) { return false; }
				const stat = fs.statSync( path.join( dir, file ) );
				return stat && stat.isFile();
			} );
		} ).then( ( files ) =>
		{
			return Promise.all( files.map( ( file ) =>
			{
				return fs.readJson5<ServerConfig>( path.join( dir, file ) ).then( ( conf ) =>
				{
console.log(file,conf);
					// JSON check
					if ( typeof conf !== 'object' ||
						typeof conf.host !== 'string' || !conf.host ||
						typeof conf.port !== 'number' ) { return null; }

					// Port check.
					conf.port = Math.floor( conf.port );
					if ( conf.port < 0 || 65535 < conf.port ) { return null; }

					const newconf: _ServerConfig =
					{
						host: conf.host,
						port: conf.port,
						ssl: { key: '', cert: '' },
						disable: conf.disable === false,
						docs: '',
						mime: {},
						replace: { pattern: '', substr: '' },
						option: conf.option,
					};

					if ( conf.docs && typeof conf.docs === 'string' )
					{
						const dir = path.normalize( conf.docs );
						newconf.docs = path.isAbsolute( dir ) ? dir : path.normalize( path.join( path.dirname( process.argv[ 1 ] ), '../', dir ) );
					}

					// Option check.
					if ( typeof conf.ssl === 'object' && typeof conf.ssl.key === 'string' && typeof conf.ssl.cert === 'string' )
					{
						newconf.ssl.key = conf.ssl.key;
						newconf.ssl.cert = conf.ssl.cert;
					}

					if ( typeof conf.mime === 'object' )
					{
						const mime = conf.mime;
						Object.keys( mime ).forEach( ( ext ) =>
						{
							if ( ext.match( /[^A-Za-z0-9]/ ) || typeof mime[ ext ] !== 'string' ) { return; }
							newconf.mime[ ext ] = mime[ ext ];
						} );
					}

					if ( typeof conf.replace === 'object' && typeof conf.replace.pattern === 'string' && conf.replace.substr === 'string' )
					{
						newconf.replace.pattern = conf.replace.pattern;
						newconf.replace.substr = conf.replace.substr;
					}

					if ( file !== 'config.json' && file !== 'config.json5' ) { return newconf; }

					// NoWS config.
					this.conf = Object.assign( newconf, { log: {} } );
					const nconf = <NoWSConfig>conf;

					if ( nconf.log )
					{
						if ( nconf.log.err === null || typeof nconf.log.err === 'string' ) { this.conf.log.err = nconf.log.err; }
						if ( nconf.log.out === null || typeof nconf.log.out === 'string' ) { this.conf.log.out = nconf.log.out; }
					}

					return null;
				} ).catch( ( error ) => { return null; } ).then( ( conf ) => { return { file: file, conf: conf } } );
			} ) ).then( ( p ) =>
			{
				const confs: { [ key: string ]: _ServerConfig } = {};
				p.forEach( ( data ) => { if ( data.conf ) { confs[ data.file ] = data.conf } } );
				return confs;
			} );
		} );
	}

	public addEventListener<T extends keyof ConfigEventMap>( type: T, listener: ( event: ConfigEventData<T> ) => void )
	{
		if ( this.event[ type ] ) { return; }
		(<( ( event: ConfigEventData<T> ) => void )[]>this.event[ type ]).push( listener );
	}

	public removeEventListener<T extends keyof ConfigEventMap>( type: T, listener: ( event: ConfigEventData<T> ) => void )
	{
		if ( this.event[ type ] ) { return; }
		const array = <( ( event: ConfigEventData<T> ) => void )[]>this.event[ type ];
		const index = array.indexOf( listener );
		if ( index < 0 ) { return; }
		array.splice( index, 1 );
	}

}
