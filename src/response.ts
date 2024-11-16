import type { EventTemplate, NostrEvent, VerifiedEvent } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import { Signer } from './utils';
import { addHai, stringToArrayPlain } from './mjlib/mj_common';
import { getScore } from './mjlib/mj_score';
import { getMachi } from './mjlib/mj_machi';
import { getShanten } from './mjlib/mj_shanten';

export const getResponseEvent = async (requestEvent: NostrEvent, signer: Signer): Promise<VerifiedEvent[] | null> => {
	if (requestEvent.pubkey === signer.getPublicKey()) {
		//自分自身の投稿には反応しない
		return null;
	}
	const res = await selectResponse(requestEvent, signer);
	if (res === null) {
		//反応しないことを選択
		return null;
	}
	const events = res.map((r) => signer.finishEvent(r));
	return events;
};

const selectResponse = async (event: NostrEvent, signer: Signer): Promise<EventTemplate[] | null> => {
	if (!isAllowedToPost(event)) {
		return null;
	}
	const res: EventTemplate | null = await mode_reply(event);
	if (res === null) {
		return null;
	}
	if (/^\\s\[0\]/.test(res.content)) {
		let kind0: EventTemplate;
		const kind0_rinrin: EventTemplate = {
			content: JSON.stringify({
				about: '麻雀プレイヤーbot',
				bot: true,
				display_name: 'リンリン',
				name: 'rinrin',
				nip05: 'rinrin@nikolat.github.io',
				picture: 'https://nikolat.github.io/avatar/rinrin.png',
				website: 'https://github.com/nikolat/jong-rinrin',
				lud16: 'nikolat@coinos.io',
			}),
			kind: 0,
			tags: [],
			created_at: event.created_at + 1,
		};
		const kind0_chunchun: EventTemplate = {
			content: JSON.stringify({
				about: '麻雀プレイヤーbot',
				bot: true,
				display_name: 'チュンチュン',
				name: 'chunchun',
				nip05: 'chunchun@nikolat.github.io',
				picture: 'https://nikolat.github.io/avatar/chunchun.png',
				website: 'https://github.com/nikolat/jong-chunchun',
				lud16: 'nikolat@coinos.io',
			}),
			kind: 0,
			tags: [],
			created_at: event.created_at + 1,
		};
		const kind0_whanwhan: EventTemplate = {
			content: JSON.stringify({
				about: '麻雀プレイヤーbot',
				bot: true,
				display_name: 'ホワンホワン',
				name: 'whanwhan',
				nip05: 'whanwhan@nikolat.github.io',
				picture: 'https://nikolat.github.io/avatar/whanwhan.png',
				website: 'https://github.com/nikolat/jong-whanwhan',
				lud16: 'nikolat@coinos.io',
			}),
			kind: 0,
			tags: [],
			created_at: event.created_at + 1,
		};
		switch (nip19.npubEncode(signer.getPublicKey())) {
			case 'npub1rnrnclxznfkqqu8nnpt0mwp4hj0xe005mnwjqlafaluv7n2kn80sy53aq2':
				kind0 = kind0_rinrin;
				break;
			case 'npub1chunacswmcejn8ge95vzl22a2g6pd4nfchygslnt9gj9dshqcvqq5amrlj':
				kind0 = kind0_chunchun;
				break;
			case 'npub1whanysx54uf9tgjfeueljg3498kyru3rhwxajwuzh0nw0x0eujss9tlcjh':
				kind0 = kind0_whanwhan;
				break;
			default:
				throw new TypeError('invalid pubkey');
		}
		res.content = res.content.replace(/^\\s\[\d+\]/, '');
		return [kind0, res];
	}
	return [res];
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
		[/\\s\[0\]$/, res_surface0],
		[/shanten\s(([<>()0-9mpsz]){2,44})$/, res_shanten],
		[/score\s(([<>()0-9mpsz]){2,42})\s([0-9][mpsz])(\s([0-9][mpsz]))?(\s([0-9][mpsz]))?$/, res_score],
		[/machi\s(([<>()0-9mpsz]){2,42})$/, res_machi],
	];
	return resmapReply;
};

const mode_reply = async (event: NostrEvent): Promise<EventTemplate | null> => {
	const resmap = getResmap();
	for (const [reg, func] of resmap) {
		if (reg.test(event.content)) {
			const [content, tags] = await func(event, reg);
			return { content, kind: event.kind, tags, created_at: event.created_at + 1 };
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

const res_surface0 = (event: NostrEvent): [string, string[][]] => {
	return ['\\s[0]kind0 updated.', getTagsReply(event)];
};

const res_shanten = (event: NostrEvent, regstr: RegExp): [string, string[][]] => {
	const match = event.content.match(regstr);
	if (match === null) {
		throw new Error();
	}
	const tehai = match[1];
	const paishi = `${tehai.replaceAll(/[1-9][mpsz]/g, (p) => `:${convertEmoji(p)}:`)}`;
	const [shanten, composition] = getShanten(tehai);
	const content = `${paishi}\n${shanten === -1 ? '和了' : shanten === 0 ? '聴牌(テンパイ)' : `${shanten}向聴(シャンテン)`}`;
	const tags = [...getTagsReply(event), ...getTagsEmoji(tehai)];
	return [content, tags];
};

const res_score = (event: NostrEvent, regstr: RegExp): [string, string[][]] => {
	const match = event.content.match(regstr);
	if (match === null) {
		throw new Error();
	}
	const tehai = match[1];
	const agari_hai = match[3];
	const bafu_hai = match[5] ?? '';
	const jifu_hai = match[7] ?? '';
	const [shanten, composition] = getShanten(addHai(tehai, agari_hai));
	const paishi = `${tehai.replaceAll(/[1-9][mpsz]/g, (p) => `:${convertEmoji(p)}:`)} :${convertEmoji(agari_hai)}:`;
	const tags = [...getTagsReply(event), ...getTagsEmoji(addHai(tehai, agari_hai))];
	if (shanten !== -1) {
		const content = `${paishi}:\n和了れません`;
		return [content, tags];
	}
	const r = getScore(tehai, agari_hai, bafu_hai, jifu_hai);
	if (r[0] <= 0) {
		const content = `${paishi}:\n役がありません`;
		return [content, tags];
	}
	let content = paishi + '\n';
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
	content += `${r[0]}点\n`;
	return [content, tags];
};

const res_machi = (event: NostrEvent, regstr: RegExp): [string, string[][]] => {
	const match = event.content.match(regstr);
	if (match === null) {
		throw new Error();
	}
	const tehai = match[1];
	const paishi = `${tehai.replaceAll(/[1-9][mpsz]/g, (p) => `:${convertEmoji(p)}:`)}`;
	const [shanten, composition] = getShanten(tehai);
	if (shanten > 0) {
		const content = `${paishi}:\nテンパイしていません`;
		const tags = [...getTagsReply(event), ...getTagsEmoji(tehai)];
		return [content, tags];
	} else if (shanten === -1) {
		const content = `${paishi}:\n和了っています`;
		const tags = [...getTagsReply(event), ...getTagsEmoji(tehai)];
		return [content, tags];
	}
	const r = getMachi(tehai);
	const content = `${paishi}\n待ち: ${r.replaceAll(/[1-9][mpsz]/g, (p) => `:${convertEmoji(p)}:`)}`;
	const tags = [...getTagsReply(event), ...getTagsEmoji(r + tehai)];
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
