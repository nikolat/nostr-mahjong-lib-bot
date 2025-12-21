/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import * as nip19 from 'nostr-tools/nip19';
import { Signer } from './utils';
import { base } from './base';

export interface Env {
	NOSTR_PRIVATE_KEY_RINRIN: string;
	NOSTR_PRIVATE_KEY_CHUNCHUN: string;
	NOSTR_PRIVATE_KEY_WHANWHAN: string;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		switch (request.method) {
			case 'GET':
			case 'POST': {
				if (request.method === 'POST' && request.body === null) {
					const body = JSON.stringify({ error: 'message body is not found' });
					return new Response(body, {
						status: 400,
						headers: {
							'content-type': 'application/json; charset=utf-8'
						}
					});
				}
				const url = new URL(request.url);
				let nsec: string | undefined;
				switch (url.pathname) {
					case '/rinrin':
						nsec = env.NOSTR_PRIVATE_KEY_RINRIN;
						break;
					case '/chunchun':
						nsec = env.NOSTR_PRIVATE_KEY_CHUNCHUN;
						break;
					case '/whanwhan':
						nsec = env.NOSTR_PRIVATE_KEY_WHANWHAN;
						break;
					default:
						const body = JSON.stringify({ error: '404 not found' });
						return new Response(body, {
							status: 404,
							headers: {
								'content-type': 'application/json; charset=utf-8'
							}
						});
				}
				if (nsec === undefined) {
					const body = JSON.stringify({ error: 'NOSTR_PRIVATE_KEY is undefined' });
					return new Response(body, {
						status: 500,
						headers: {
							'content-type': 'application/json; charset=utf-8'
						}
					});
				}
				const dr = nip19.decode(nsec);
				if (dr.type !== 'nsec') {
					const body = JSON.stringify({ error: 'NOSTR_PRIVATE_KEY is not `nsec`' });
					return new Response(body, {
						status: 500,
						headers: {
							'content-type': 'application/json; charset=utf-8'
						}
					});
				}
				const seckey = dr.data;
				const signer = new Signer(seckey);
				let body: string | undefined;
				if (request.method === 'POST') {
					body = await request.text();
				}
				const res: Response = await base(body, signer);
				return res;
			}
			default: {
				const body = JSON.stringify({ error: 'Method Not Allowed' });
				return new Response(body, {
					status: 405,
					headers: {
						'content-type': 'application/json; charset=utf-8',
						Allow: 'POST'
					}
				});
			}
		}
	}
} satisfies ExportedHandler<Env>;
