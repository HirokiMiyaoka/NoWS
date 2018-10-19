/// <reference path="./types.d.ts" />
import Server from './Server'
import Config from './Config'

const server = new Server( new Config( ( 2 < process.argv.length ) ? process.argv[ 2 ] : './conf/' ) );

server.start( true ).then( () =>
{
	console.log( 'Start' );
} ).catch( ( error ) =>
{
	console.log( error );
} );
