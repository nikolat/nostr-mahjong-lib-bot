import type { EventTemplate, NostrEvent, VerifiedEvent } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import { Signer } from './utils';
import { addHai, stringToArrayPlain } from './mjlib/mj_common';
import { getScore } from './mjlib/mj_score.js';

export const getResponseEvent = async (requestEvent: NostrEvent, signer: Signer): Promise<VerifiedEvent | null> => {
	if (requestEvent.pubkey === signer.getPublicKey()) {
		//自分自身の投稿には反応しない
		return null;
	}
	const res = await selectResponse(requestEvent);
	if (res === null) {
		//反応しないことを選択
		return null;
	}
	return signer.finishEvent(res);
};

const selectResponse = async (event: NostrEvent): Promise<EventTemplate | null> => {
	if (!isAllowedToPost(event)) {
		return null;
	}
	const res = await mode_reply(event);
	if (res === null) {
		return null;
	}
	const [content, kind, tags, created_at] = [...res, event.created_at + 1];
	const unsignedEvent: EventTemplate = { kind, tags, content, created_at };
	return unsignedEvent;
};

const isAllowedToPost = (event: NostrEvent) => {
	const allowedChannel = [
		'c8d5c2709a5670d6f621ac8020ac3e4fc3057a4961a15319f7c0818309407723', //Nostr麻雀開発部
		'8206e76969256cd33277eeb00a45e445504dfb321788b5c3cc5d23b561765a74', //うにゅうハウス開発
		'330fc57e48e39427dd5ea555b0741a3f715a55e10f8bb6616c27ec92ebc5e64b', //カスタム絵文字の川
		'5b0703f5add2bb9e636bcae1ef7870ba6a591a93b6b556aca0f14b0919006598', //₍ ﾃｽﾄ ₎
	];
	const disallowedNpubs = [
		'npub1j0ng5hmm7mf47r939zqkpepwekenj6uqhd5x555pn80utevvavjsfgqem2', //雀卓
	];
	if (disallowedNpubs.includes(nip19.npubEncode(event.pubkey))) {
		return false;
	}
	const disallowedTags = ['content-warning', 'proxy'];
	if (event.tags.some((tag: string[]) => tag.length >= 1 && disallowedTags.includes(tag[0]))) {
		return false;
	}
	if (event.kind === 1) {
		return true;
	} else if (event.kind === 42) {
		const tagRoot = event.tags.find((tag) => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root');
		if (tagRoot !== undefined) {
			return allowedChannel.includes(tagRoot[1]);
		} else {
			throw new TypeError('root is not found');
		}
	}
	throw new TypeError(`kind ${event.kind} is not supported`);
};

const getResmap = (): [RegExp, (event: NostrEvent, regstr: RegExp) => Promise<[string, string[][]]> | [string, string[][]]][] => {
	const resmapReply: [RegExp, (event: NostrEvent, regstr: RegExp) => Promise<[string, string[][]]> | [string, string[][]]][] = [
		[/score\s(([0-9][mpsz])+)\s([0-9][mpsz])(\s([0-9][mpsz]))?(\s([0-9][mpsz]))?$/, res_score],
	];
	return resmapReply;
};

const mode_reply = async (event: NostrEvent): Promise<[string, number, string[][]] | null> => {
	const resmap = getResmap();
	for (const [reg, func] of resmap) {
		if (reg.test(event.content)) {
			const [content, tags] = await func(event, reg);
			return [content, event.kind, tags];
		}
	}
	return null;
};

const getTagsReply = (event: NostrEvent): string[][] => {
	const tagsReply: string[][] = [];
	const tagRoot = event.tags.find((tag) => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root');
	if (tagRoot !== undefined) {
		tagsReply.push(tagRoot);
		tagsReply.push(['e', event.id, '', 'reply']);
	} else {
		tagsReply.push(['e', event.id, '', 'root']);
	}
	for (const tag of event.tags.filter((tag) => tag.length >= 2 && tag[0] === 'p' && tag[1] !== event.pubkey)) {
		tagsReply.push(tag);
	}
	tagsReply.push(['p', event.pubkey, '']);
	return tagsReply;
};

const res_score = (event: NostrEvent, regstr: RegExp): [string, string[][]] => {
	const match = event.content.match(regstr);
	if (match === null) {
		throw new Error();
	}
	const tehai = match[1];
	const tsumo = match[3];
	const bafu_hai = match[5] ?? '';
	const jifu_hai = match[7] ?? '';
	const r = getScore(tehai, tsumo, bafu_hai, jifu_hai);
	let content = '';
	let countYakuman = 0;
	if (r[2].size > 0) {
		for (const [k, v] of r[2]) {
			content += `${k} ${v >= 2 ? `${v}倍` : ''}役満\n`;
			countYakuman += v;
		}
	} else {
		let han = 0;
		for (const [k, v] of r[3]) {
			han += v;
			content += `${k} ${v}翻\n`;
		}
		content += `${r[1]}符${han}翻\n`;
	}
	content += `${tehai.replaceAll(/[1-9][mpsz]/g, (p) => `:${convertEmoji(p)}:`)} :${convertEmoji(tsumo)}:`;
	const tags = [...getTagsReply(event), ...getTagsEmoji(addHai(tehai, tsumo))];
	return [content, tags];
};

const getTagsEmoji = (tehai: string): string[][] => {
	const pi = stringToArrayPlain(tehai);
	return Array.from(new Set(pi)).map((pi) => getEmojiTag(pi));
};

const getEmojiTag = (pi: string): string[] => {
	return ['emoji', convertEmoji(pi), getEmojiUrl(pi)];
};

const convertEmoji = (pai: string) => {
	if (['m', 'p', 's'].includes(pai.at(1) ?? '')) {
		return `mahjong_${pai.at(1)}${pai.at(0)}`;
	} else if (pai.at(1) === 'z') {
		switch (pai.at(0)) {
			case '1':
				return 'mahjong_east';
			case '2':
				return 'mahjong_south';
			case '3':
				return 'mahjong_west';
			case '4':
				return 'mahjong_north';
			case '5':
				return 'mahjong_white';
			case '6':
				return 'mahjong_green';
			case '7':
				return 'mahjong_red';
			default:
				throw TypeError(`Unknown pai: ${pai}`);
		}
	} else {
		throw TypeError(`Unknown pai: ${pai}`);
	}
};

const getEmojiUrl = (pai: string): string => {
	return awayuki_mahjong_emojis[convertEmoji(pai)];
};

const awayuki_mahjong_emojis: any = {
	mahjong_m1: 'https://awayuki.github.io/emoji/mahjong-m1.png',
	mahjong_m2: 'https://awayuki.github.io/emoji/mahjong-m2.png',
	mahjong_m3: 'https://awayuki.github.io/emoji/mahjong-m3.png',
	mahjong_m4: 'https://awayuki.github.io/emoji/mahjong-m4.png',
	mahjong_m5: 'https://awayuki.github.io/emoji/mahjong-m5.png',
	mahjong_m6: 'https://awayuki.github.io/emoji/mahjong-m6.png',
	mahjong_m7: 'https://awayuki.github.io/emoji/mahjong-m7.png',
	mahjong_m8: 'https://awayuki.github.io/emoji/mahjong-m8.png',
	mahjong_m9: 'https://awayuki.github.io/emoji/mahjong-m9.png',
	mahjong_p1: 'https://awayuki.github.io/emoji/mahjong-p1.png',
	mahjong_p2: 'https://awayuki.github.io/emoji/mahjong-p2.png',
	mahjong_p3: 'https://awayuki.github.io/emoji/mahjong-p3.png',
	mahjong_p4: 'https://awayuki.github.io/emoji/mahjong-p4.png',
	mahjong_p5: 'https://awayuki.github.io/emoji/mahjong-p5.png',
	mahjong_p6: 'https://awayuki.github.io/emoji/mahjong-p6.png',
	mahjong_p7: 'https://awayuki.github.io/emoji/mahjong-p7.png',
	mahjong_p8: 'https://awayuki.github.io/emoji/mahjong-p8.png',
	mahjong_p9: 'https://awayuki.github.io/emoji/mahjong-p9.png',
	mahjong_s1: 'https://awayuki.github.io/emoji/mahjong-s1.png',
	mahjong_s2: 'https://awayuki.github.io/emoji/mahjong-s2.png',
	mahjong_s3: 'https://awayuki.github.io/emoji/mahjong-s3.png',
	mahjong_s4: 'https://awayuki.github.io/emoji/mahjong-s4.png',
	mahjong_s5: 'https://awayuki.github.io/emoji/mahjong-s5.png',
	mahjong_s6: 'https://awayuki.github.io/emoji/mahjong-s6.png',
	mahjong_s7: 'https://awayuki.github.io/emoji/mahjong-s7.png',
	mahjong_s8: 'https://awayuki.github.io/emoji/mahjong-s8.png',
	mahjong_s9: 'https://awayuki.github.io/emoji/mahjong-s9.png',
	mahjong_east: 'https://awayuki.github.io/emoji/mahjong-east.png',
	mahjong_south: 'https://awayuki.github.io/emoji/mahjong-south.png',
	mahjong_west: 'https://awayuki.github.io/emoji/mahjong-west.png',
	mahjong_north: 'https://awayuki.github.io/emoji/mahjong-north.png',
	mahjong_white: 'https://awayuki.github.io/emoji/mahjong-white.png',
	mahjong_green: 'https://awayuki.github.io/emoji/mahjong-green.png',
	mahjong_red: 'https://awayuki.github.io/emoji/mahjong-red.png',
};
