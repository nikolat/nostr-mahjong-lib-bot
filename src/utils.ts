import { type EventTemplate, finalizeEvent, getPublicKey } from 'nostr-tools/pure';

export class Signer {
	#seckey: Uint8Array;

	constructor(seckey: Uint8Array) {
		this.#seckey = seckey;
	}

	getPublicKey = () => {
		return getPublicKey(this.#seckey);
	};

	finishEvent = (unsignedEvent: EventTemplate) => {
		return finalizeEvent(unsignedEvent, this.#seckey);
	};
}
