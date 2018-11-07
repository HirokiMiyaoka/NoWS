import * as fs from './Pfs'
import * as path from 'path'
import { exec } from 'child_process'

function ExecCommand( command: string )
{
	return new Promise<{ stdout: string, stderr: string }>( ( resolve, reject ) =>
	{
		exec( command, ( error, stdout, stderr )=>
		{
			if ( error ) { return reject( error ); }
			resolve( { stdout: stdout, stderr: stderr } );
		} );
	} );
}

interface _ServerConfig extends ServerConfig
{
	ssl: { key: string, cert: string },
	user: number,
	allow: string[],
	deny: string[],

	disable: boolean,
	mime: { [ key: string ]: string },
	log: LogConfig,

	docs: string,
	errs: string,
	replace: { pattern: string, substr: string },
	dir_index: string[],

	module: string,
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
	private confs: { [ key: string ]: _ServerConfig };
	private event: { [ T in keyof ConfigEventMap ]: ( ( event: ConfigEventData<T> ) => void )[] };

	constructor( dir: string )
	{
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

	private toAbsolutePath( dir: string )
	{
		return path.normalize( path.join( __dirname, '../', dir ) );
	}

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
			// TODO: modify check. assert.deepStrictEqual()
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
				return fs.readJson5<ServerConfig>( path.join( dir, file ) ).then( ( config ) =>
				{
					const p: Promise<any>[] = [];

					// JSON check
					if ( typeof config !== 'object' || typeof config.port !== 'number' ||
						typeof config.host !== 'string' || !config.host ) { throw new Error( 'Invalid config.' ); }
					// Port check.
					config.port = Math.floor( config.port );
					if ( config.port < 0 || 65535 < config.port ) { throw new Error( 'Invalid port.' ); }

					const newconf: _ServerConfig =
					{
						host: config.host,
						port: config.port,
						ssl: { key: '', cert: '' },
						user: 0,
						allow: [],
						deny: [],
						disable: config.disable === true,
						docs: '',
						errs: '',
						mime: {},
						replace: { pattern: '', substr: '' },
						dir_index: [ 'index.html' ],
						log: {},
						module: './Server/Static',
						option: config.option,
					};

					if ( typeof process.getuid === 'function' ) { newconf.user = process.getuid(); }

					if ( config.docs && typeof config.docs === 'string' )
					{
						const dir = path.normalize( config.docs );
						newconf.docs = path.isAbsolute( dir ) ? dir : this.toAbsolutePath( dir );
					}

					if ( config.errs && typeof config.errs === 'string' )
					{
						const dir = path.normalize( config.errs );
						newconf.errs = path.isAbsolute( dir ) ? dir : this.toAbsolutePath( dir );
					}

					// Option check.
					if ( typeof config.ssl === 'object' && typeof config.ssl.key === 'string' && typeof config.ssl.cert === 'string' )
					{
						newconf.ssl.key = config.ssl.key;
						newconf.ssl.cert = config.ssl.cert;
					}

					// TODO username -> userid
					if ( typeof config.user === 'string' )
					{
						p.push( ExecCommand( 'id -u ' + config.user ).then( ( result ) =>
						{
							const uid = parseInt( result.stdout );
							if ( isNaN( uid ) ) { return; }
							config.user = uid;
						} ).catch( () => {} ) );
					}

					if ( config.allow )
					{
						( Array.isArray( config.allow ) ? config.allow : [ config.allow ] ).forEach( ( ipaddress ) =>
						{
							if ( typeof ipaddress !== 'string' ) { return; }
							newconf.allow.push( ipaddress );
						} );
					}

					if ( config.deny )
					{
						( Array.isArray( config.deny ) ? config.deny : [ config.deny ] ).forEach( ( ipaddress ) =>
						{
							if ( typeof ipaddress !== 'string' ) { return; }
							newconf.deny.push( ipaddress );
						} );
					}

					if ( typeof config.mime === 'object' )
					{
						const mime = config.mime;
						Object.keys( mime ).forEach( ( ext ) =>
						{
							if ( ext.match( /[^A-Za-z0-9]/ ) || typeof mime[ ext ] !== 'string' ) { return; }
							newconf.mime[ ext ] = mime[ ext ];
						} );
					}

					if ( typeof config.replace === 'object' && typeof config.replace.pattern === 'string' && config.replace.substr === 'string' )
					{
						newconf.replace.pattern = config.replace.pattern;
						newconf.replace.substr = config.replace.substr;
					}

					if ( config.dir_index )
					{
						if ( typeof config.dir_index === 'string' ) { newconf.dir_index = [ config.dir_index ]; }
						if ( Array.isArray( config.dir_index ) ) { newconf.dir_index = config.dir_index.concat(); }
					}

					if ( config.log )
					{
						// undefined ... default(stdout,stderr)
						// null      ... No output.
						// string    ... Output file.
						//               stdout
						//               stderr
						if ( config.log.default === null || typeof config.log.default === 'string' ) { newconf.log.default = config.log.default; }
						if ( config.log.assert === null || typeof config.log.assert === 'string' ) { newconf.log.assert = config.log.assert; }
						if ( config.log.debug === null || typeof config.log.debug === 'string' ) { newconf.log.debug = config.log.debug; }
						if ( config.log.error === null || typeof config.log.error === 'string' ) { newconf.log.error = config.log.error; }
						if ( config.log.info === null || typeof config.log.info === 'string' ) { newconf.log.info = config.log.info; }
						if ( config.log.log === null || typeof config.log.log === 'string' ) { newconf.log.log = config.log.log; }
						if ( config.log.warn === null || typeof config.log.warn === 'string' ) { newconf.log.warn = config.log.warn; }
						if ( typeof config.log.size === 'number' && 0 < config.log.size ) { newconf.log.size = config.log.size; }
					}

					if ( typeof config.module === 'string' )
					{
						newconf.module = path.isAbsolute( config.module ) ? config.module : this.toAbsolutePath( path.join( 'server/Server', config.module ) );
					}

					return Promise.all( p ).then( () => { return newconf; } );
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
