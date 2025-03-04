//curl -X POST -H "Content-Type: application/json" -d @test/fixtures/input.json https://nostr-mahjong-lib-bot.nikolat.workers.dev/rinrin
import * as fs from 'node:fs/promises';
import { generateSecretKey, type NostrEvent } from 'nostr-tools/pure';
import { Signer } from './src/utils';
import { getResponseEvent } from './src/response';

const main = async () => {
	const text = await fs.readFile('./test/fixtures/input.json', {
		encoding: 'utf8'
	});
	const json = JSON.parse(text);
	const event_req: NostrEvent = json;
	const sk_res = generateSecretKey();
	const signer = new Signer(sk_res);
	const event_res = await getResponseEvent(event_req, signer);
	const request = JSON.stringify(event_req, undefined, 2);
	const response = JSON.stringify(event_res, undefined, 2);
	console.log(request, response);
};

main();
