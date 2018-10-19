interface NoWSConfig extends ServerConfig
{
	log?: { err?: string | null, out?: string | null },
}

interface ServerConfig
{
	host: string,
	port: number,
	ssl?: { key: string, cert: string },
	disable?: boolean,
	docs?: string,
	mime?: { [ key: string ]: string },
	replace?: { pattern: string, substr: string },
	option?: any,
}

interface NodeWebServer
{
	start(): void;
	stop(): void;
	alive(): boolean;
}

// API

interface ResponseServerList
{
	max: number,
	list: { url: string, alive: boolean }[],
}

interface ResponseServerStop
{
	url: { [ key: string ]: boolean },
}

interface RequestServerStop
{
	url: string[],
}
