export const VERCEL_API = "https://api.vercel.com";
export const VERCEL_API_DOMAIN = `${VERCEL_API}/v9/projects/website/domains`;
export const VERCEL_API_DEPLOY = `${VERCEL_API}/v13/deployments`;
export const VERCEL_API_CONFIG = {
	headers: {
		Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
		"Content-Type": "application/json"
	}
};

export const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
export const CLOUDFLARE_API_DNS = `${CLOUDFLARE_API}/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records`;
export const CLOUDFLARE_API_CONFIG = {
	headers: {
		"X-Auth-Key": process.env.CLOUDFLARE_TOKEN as string,
		"X-Auth-Email": process.env.CLOUDFLARE_EMAIL as string,
		"Content-Type": "application/json"
	}
};

export interface CLOUDFLARE_ZONES_RESPONSE {
	result: {
		name: string;
		id: string;
	}[];
}
