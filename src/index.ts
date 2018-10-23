import NoWS from './NoWS'
import Config from './Config'

const nows = new NoWS( new Config( ( 2 < process.argv.length ) ? process.argv[ 2 ] : './conf/' ) );

nows.start().then( () =>
{
	console.log( 'Start' );
} ).catch( ( error ) =>
{
	console.log( error );
} );
