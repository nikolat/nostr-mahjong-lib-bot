import { type NostrEvent, type VerifiedEvent, validateEvent, verifyEvent } from 'nostr-tools/pure';
import type { Signer } from './utils';
import { getResponseEvent } from './response';

//入力イベントを検証するかどうか(デバッグ時は無効化した方が楽)
const verifyInputEvent = true;

export const base = async (rawBody: string, signer: Signer) => {
	//入力イベントを準備
	let requestEvent: NostrEvent;
	try {
		requestEvent = JSON.parse(rawBody);
	} catch (error) {
		const body = JSON.stringify({ error: 'JSON parse failed' });
		return new Response(body, {
			status: 400,
			headers: {
				'content-type': 'application/json; charset=utf-8',
			},
		});
	}
	if (!validateEvent(requestEvent)) {
		const body = JSON.stringify({ error: 'Invalid event' });
		return new Response(body, {
			status: 400,
			headers: {
				'content-type': 'application/json; charset=utf-8',
			},
		});
	}
	if (verifyInputEvent && !verifyEvent(requestEvent)) {
		const body = JSON.stringify({ error: 'Unverified event' });
		return new Response(body, {
			status: 400,
			headers: {
				'content-type': 'application/json; charset=utf-8',
			},
		});
	}
	//出力イベントを取得
	let responseEvent: VerifiedEvent[] | null;
	try {
		responseEvent = await getResponseEvent(requestEvent, signer);
	} catch (error) {
		let body: any;
		if (error instanceof Error) {
			body = JSON.stringify({ error: error.message });
		} else {
			console.warn(error);
			body = JSON.stringify({ error: 'Unexpected error' });
		}
		return new Response(body, {
			status: 400,
			headers: {
				'content-type': 'application/json; charset=utf-8',
			},
		});
	}
	//出力
	if (responseEvent === null) {
		return new Response(null, {
			status: 204,
		});
	}
	const res = responseEvent.length > 1 ? responseEvent : responseEvent.at(0);
	console.log({ requestEvent, res });
	const body = JSON.stringify(res);
	return new Response(body, {
		status: 200,
		headers: {
			'content-type': 'application/json; charset=utf-8',
		},
	});
};
