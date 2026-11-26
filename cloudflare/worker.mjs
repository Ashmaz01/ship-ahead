// src/rules/rng.ts
function createRng(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 >>> 0;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
/** Integer in [min, max], inclusive. */
function randInt(rng, min, max) {
	return min + Math.floor(rng() * (max - min + 1));
}
function pick(rng, items) {
	return items[Math.floor(rng() * items.length)];
}
function shuffle(rng, items) {
	const out = items.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
// src/rules/mathgen.ts
var OPS = {
	easy: ["+", "-"],
	medium: [
		"+",
		"-",
		"×"
	],
	hard: [
		"+",
		"-",
		"×",
		"÷"
	]
};
var MAX = {
	easy: 20,
	medium: 100,
	hard: 1e3
};
/** Returns [a, b, result] for an operation that stays in whole, non-negative numbers. */
function operands(rng, op, d) {
	const max = MAX[d];
	const table = d === "hard" ? 12 : 10;
	switch (op) {
		case "+": {
			const a = randInt(rng, 1, Math.floor(max / 2));
			const b = randInt(rng, 1, Math.floor(max / 2));
			return [
				a,
				b,
				a + b
			];
		}
		case "-": {
			const a = randInt(rng, 2, max);
			const b = randInt(rng, 1, a - 1);
			return [
				a,
				b,
				a - b
			];
		}
		case "×": {
			const a = randInt(rng, 2, table);
			const b = randInt(rng, 2, table);
			return [
				a,
				b,
				a * b
			];
		}
		case "÷": {
			const b = randInt(rng, 2, table);
			const r = randInt(rng, 2, table);
			return [
				b * r,
				b,
				r
			];
		}
	}
}
function distractors(rng, answer) {
	const set = /* @__PURE__ */ new Set();
	const spread = Math.max(3, Math.round(Math.abs(answer) * .2));
	while (set.size < 3) {
		const n = answer + randInt(rng, -spread, spread);
		if (n !== answer && n >= 0) set.add(n);
	}
	return [...set];
}
function generateMath(rng, type, d) {
	switch (type) {
		case "mcq": {
			const op = pick(rng, OPS[d]);
			const [a, b, r] = operands(rng, op, d);
			const choices = shuffle(rng, [r, ...distractors(rng, r)]).map(String);
			return {
				id: `math-mcq-${d}-${a}${op}${b}`,
				subject: "math",
				type,
				difficulty: d,
				prompt: `What is ${a} ${op} ${b}?`,
				choices,
				answerIndex: choices.indexOf(String(r))
			};
		}
		case "fill": {
			const op = pick(rng, OPS[d]);
			const [a, b, r] = operands(rng, op, d);
			const hideFirst = rng() < .5;
			const prompt = hideFirst ? `__ ${op} ${b} = ${r}` : `${a} ${op} __ = ${r}`;
			return {
				id: `math-fill-${d}-${a}${op}${b}-${hideFirst ? 1 : 2}`,
				subject: "math",
				type,
				difficulty: d,
				prompt: `Fill the blank: ${prompt}`,
				answers: [String(hideFirst ? a : b)]
			};
		}
		case "pattern": return pattern(rng, d);
		case "word": return word(rng, d);
	}
}
function pattern(rng, d) {
	let terms;
	if (d === "easy") {
		const step = pick(rng, [
			1,
			2,
			5,
			10
		]);
		const start = randInt(rng, 0, 10);
		terms = [
			0,
			1,
			2,
			3,
			4
		].map((i) => start + step * i);
	} else if (d === "medium") {
		const step = randInt(rng, 3, 12) * (rng() < .3 ? -1 : 1);
		const start = step < 0 ? randInt(rng, 60, 99) : randInt(rng, 1, 30);
		terms = [
			0,
			1,
			2,
			3,
			4
		].map((i) => start + step * i);
	} else if (rng() < .5) {
		const ratio = pick(rng, [2, 3]);
		const start = randInt(rng, 1, 5);
		terms = [
			0,
			1,
			2,
			3,
			4
		].map((i) => start * ratio ** i);
	} else {
		const start = randInt(rng, 1, 10);
		const grow = randInt(rng, 1, 4);
		terms = [start];
		for (let i = 1; i < 5; i++) terms.push(terms[i - 1] + grow * i);
	}
	const answer = terms[4];
	return {
		id: `math-pattern-${d}-${terms.join(".")}`,
		subject: "math",
		type: "pattern",
		difficulty: d,
		prompt: `What comes next? ${terms.slice(0, 4).join(", ")}, __`,
		answers: [String(answer)]
	};
}
function word(rng, d) {
	const max = d === "easy" ? 10 : d === "medium" ? 12 : 25;
	const templates = [
		() => {
			const boats = randInt(rng, 2, Math.min(max, 9));
			const seats = randInt(rng, 2, max);
			return [`A rescue boat carries ${seats} people. How many people can ${boats} boats carry?`, boats * seats];
		},
		() => {
			const have = randInt(rng, 5, max * 4);
			const used = randInt(rng, 1, have - 1);
			return [`A ship has ${have} litres of fuel. It uses ${used} litres. How many litres are left?`, have - used];
		},
		() => {
			const a = randInt(rng, 3, max * 3);
			const b = randInt(rng, 3, max * 3);
			return [`Aina collects ${a} shells and Danial collects ${b}. How many shells do they have together?`, a + b];
		},
		() => {
			const groups = randInt(rng, 2, Math.min(max, 9));
			const each = randInt(rng, 2, max);
			return [`${groups * each} villagers share ${groups} boats equally. How many people go in each boat?`, each];
		}
	];
	const [prompt, answer] = pick(rng, d === "easy" ? templates.slice(1, 3) : templates)();
	return {
		id: `math-word-${d}-${prompt}`,
		subject: "math",
		type: "word",
		difficulty: d,
		prompt,
		answers: [String(answer)]
	};
}
// src/rules/school.ts
var LEVELS = [
	"year13",
	"year46",
	"form13",
	"form45"
];
function schoolQuestion(rng, level, type, difficulty) {
	const band = level === "random" ? pick(rng, LEVELS) : level;
	if (band === "year13" && type !== "pattern") return {
		...generateMath(rng, type, difficulty),
		band
	};
	const limit = {
		easy: 5,
		medium: 9,
		hard: 14
	}[difficulty];
	const a = randInt(rng, 2, limit), b = randInt(rng, 2, limit + 1);
	let prompt, result;
	if (type === "pattern") {
		const term = (n) => {
			switch (band) {
				case "year13": return a + b * n;
				case "year46": return a + b * (n + 1) * 2;
				case "form13": return a * 2 ** n + b;
				case "form45": return a * n * n + b * n + 1;
			}
		};
		prompt = "What comes next? " + [
			0,
			1,
			2,
			3
		].map(term).join(", ") + ", __";
		result = term(4);
	} else if (band === "year46") {
		if (type === "mcq") {
			prompt = `What is 3/4 of ${4 * a * b}?`;
			result = 3 * a * b;
		} else if (type === "fill") {
			prompt = `__ minutes = ${a} hours and ${b * 3} minutes.`;
			result = a * 60 + b * 3;
		} else {
			prompt = `A repair kit costs RM${a * 10}. The shop gives a 10% discount. How many ringgit do you pay?`;
			result = a * 9;
		}
	} else if (band === "form13") {
		if (type === "mcq") {
			prompt = `Solve for x: ${a}x + ${b} = ${a * (b + 1) + b}.`;
			result = b + 1;
		} else if (type === "fill") {
			prompt = `If x = −${a}, then ${b}x + 3 = __.`;
			result = 3 - a * b;
		} else {
			prompt = `A ferry travels ${a * b * 10} km in ${a} hours. What is its average speed in km/h?`;
			result = b * 10;
		}
	} else if (type === "mcq") {
		prompt = `Find the larger root of x² − ${2 * a + b}x + ${a * (a + b)} = 0.`;
		result = a + b;
	} else if (type === "fill") {
		prompt = `For the quadratic y = (x − ${a})² + ${b}, the minimum value of y is __.`;
		result = b;
	} else {
		prompt = `The crew deposits RM${100 * a} at ${b}% simple interest per year. How much interest, in ringgit, will it earn in 3 years?`;
		result = 3 * a * b;
	}
	const q = {
		band,
		id: [
			band,
			type,
			prompt
		].join("/"),
		subject: "math",
		type,
		difficulty,
		prompt
	};
	if (type === "mcq") {
		q.choices = shuffle(rng, [
			result,
			result + 1,
			result - 1,
			result + 2
		]).map(String);
		q.answerIndex = q.choices.indexOf(String(result));
	} else q.answers = [String(result)];
	return q;
}
function selectedBands(value) {
	const list = Array.isArray(value) ? value : [value];
	if (list.includes("random")) return [...LEVELS];
	const valid = LEVELS.filter((b) => list.includes(b));
	return valid.length ? valid : ["year13"];
}
var decks = /* @__PURE__ */ new Map();
function extraQuestion(rng, band, type, d) {
	const a = randInt(rng, 2, {
		easy: 9,
		medium: 16,
		hard: 28
	}[d]), b = randInt(rng, 2, 9);
	let pair;
	if (type === "pattern") {
		const seq = Array.from({ length: 5 }, (_, n) => {
			if (band === "year13") return a + b * (5 - n);
			if (band === "year46") return a + b * Math.floor(n / 2) + n % 2 * (b + 1) + Math.floor(n / 2) * (b + 1);
			if (band === "form13") return a + b * n * (n + 1) / 2;
			return a * (n + 1) ** 2 - b;
		});
		pair = [`Find the next term: ${seq.slice(0, 4).join(", ")}, __`, seq[4]];
	} else pair = pick(rng, {
		year13: [
			[`There are ${a + b} shells. ${b} wash away. How many remain?`, a],
			[`A crew packs ${b} bags with ${a} apples each. How many apples altogether?`, a * b],
			[`How many minutes are in ${b} hours?`, 60 * b]
		],
		year46: [
			[`A map is ${a + b} cm long and ${b} cm wide. Find its perimeter in cm.`, 2 * (a + 2 * b)],
			[`What is the average of ${a}, ${a + b} and ${a + 2 * b}?`, a + b],
			[`How many grams are in ${a} kg and ${b * 10} g?`, a * 1e3 + b * 10]
		],
		form13: [
			[`A triangle has angles of ${a + 20}° and ${b + 40}°. Find its third angle in degrees.`, 120 - a - b],
			[`Paint is mixed in a ratio of 2 to 3. For ${2 * a} litres of blue, how many litres of white are needed?`, 3 * a],
			[`A tank is ${a} m long, ${b} m wide and 2 m tall. Find its volume in cubic metres.`, 2 * a * b]
		],
		form45: [
			[`A workshop pays RM${a * 100} in fixed costs and RM${b} per kit. What is the cost in ringgit for 20 kits?`, 100 * a + 20 * b],
			[`Given y = ${b}x², find y when x = ${a}.`, b * a * a],
			[`The ferry covers ${a * b} km in ${b} hours and ${a * b * 2} km in another ${b} hours. Find its average speed in km/h.`, 1.5 * a]
		]
	}[band]);
	const [text, value] = pair;
	const prompt = type === "fill" ? text + " Answer: __" : text;
	const q = {
		id: [
			band,
			type,
			prompt
		].join("/"),
		band,
		type,
		subject: "math",
		difficulty: d,
		prompt
	};
	if (type === "mcq") {
		q.choices = shuffle(rng, [
			value,
			value + 1,
			value + 2,
			value - 1
		]).map(String);
		q.answerIndex = q.choices.indexOf(String(value));
	} else q.answers = [String(value)];
	return q;
}
function questionDeck(band, type, d) {
	const key = [
		band,
		type,
		d
	].join("/");
	let deck = decks.get(key);
	if (!deck) {
		const rng = createRng(84127), unique = /* @__PURE__ */ new Map();
		for (let i = 0; i < 800; i++) {
			const q = i % 2 ? extraQuestion(rng, band, type, d) : schoolQuestion(rng, band, type, d);
			unique.set(q.prompt, q);
		}
		deck = [...unique.values()];
		decks.set(key, deck);
	}
	return deck;
}
function drawMath(rng, bands, type, d, used) {
	const decks = bands.map((b) => questionDeck(b, type, d));
	let available = decks.map((deck) => deck.filter((q) => !used.has(q.prompt))).filter((deck) => deck.length);
	if (!available.length) {
		for (const deck of decks) for (const q of deck) used.delete(q.prompt);
		available = decks;
	}
	const q = pick(rng, pick(rng, available));
	used.add(q.prompt);
	return q;
}
// src/rules/config.ts
var DIFFICULTY = {
	easy: {
		seconds: 30,
		points: 1,
		back: 1
	},
	medium: {
		seconds: 20,
		points: 2,
		back: 2
	},
	hard: {
		seconds: 15,
		points: 3,
		back: 3
	}
};
var RULES = {
	pathLength: 40,
	powerTiles: 7,
	fuelTiles: 5,
	fuelNeeded: 3,
	maxPowers: 2,
	jumpDistance: 3,
	pushbackDistance: 3,
	/** Rounds played before lava starts to move. */
	lavaGraceRounds: 2,
	/** Pillars lava covers at the end of each full round. Tune after playtesting. */
	lavaPerRound: 2,
	minPlayers: 2,
	maxPlayers: 6
};
// src/rules/board.ts
/**
* Lays out the path: start, dock at the end, power and fuel tiles placed at random
* (never on the first three tiles or the dock), question types spread across the rest.
*/
function createBoard(rng, qtypes) {
	const n = RULES.pathLength;
	const types = qtypes.length ? qtypes : ["mcq"];
	const special = shuffle(rng, Array.from({ length: n - 5 }, (_, i) => i + 3));
	const power = new Set(special.slice(0, RULES.powerTiles));
	const typeOrder = shuffle(rng, types);
	return Array.from({ length: n }, (_, index) => {
		let kind = "question";
		if (index === 0) kind = "start";
		else if (index === n - 1) kind = "dock";
		else if (power.has(index)) kind = "power";
		return {
			index,
			kind,
			qtype: typeOrder[index % typeOrder.length]
		};
	});
}
// src/rules/questions.ts
function isCorrect(q, response) {
	if (q.choices && q.answerIndex !== void 0) return response === q.answerIndex;
	const given = normalise(String(response));
	return (q.answers ?? []).some((a) => normalise(a) === given);
}
function normalise(s) {
	return s.trim().toLowerCase().replace(/\s+/g, " ");
}
function correctAnswerText(q) {
	if (q.choices && q.answerIndex !== void 0) return q.choices[q.answerIndex];
	return q.answers?.[0] ?? "";
}
// src/rules/game.ts
var DOCK = RULES.pathLength - 1;
function createGame(setup, bank) {
	const n = setup.players.length;
	if (n < RULES.minPlayers || n > RULES.maxPlayers) throw new Error(`Ship Ahead needs ${RULES.minPlayers} to ${RULES.maxPlayers} players.`);
	const rng = createRng(setup.seed ?? Date.now());
	return {
		setup,
		board: createBoard(rng, setup.qtypes),
		players: setup.players.map((p, id) => ({
			id,
			name: p.name,
			color: p.color,
			pos: 0,
			points: 0,
			powers: [],
			shield: false,
			skipTurns: 0,
			boarded: false
		})),
		escapeOrder: [],
		current: 0,
		round: 1,
		lavaFront: 0,
		phase: "turn",
		pending: null,
		winnerId: null,
		rng,
		used: /* @__PURE__ */ new Set(),
		bank
	};
}
function currentPlayer(s) {
	return s.players[s.current];
}
function isAtDock(p) {
	return p.pos === DOCK;
}
function assertPhase(s, phase) {
	if (s.phase !== phase) throw new Error(`Expected phase "${phase}" but game is in "${s.phase}".`);
}
/** Uses a stored power. Only before rolling, on the player's own turn. */
function usePower(s, power, targetId) {
	assertPhase(s, "turn");
	const p = currentPlayer(s);
	const slot = p.powers.indexOf(power);
	if (slot < 0) throw new Error(`${p.name} has no ${power} power.`);
	const events = [];
	if (power === "jump") {
		const to = Math.min(p.pos + RULES.jumpDistance, DOCK);
		events.push({
			type: "power",
			playerId: p.id,
			power
		}, {
			type: "move",
			playerId: p.id,
			from: p.pos,
			to
		});
		p.pos = to;
	} else if (power === "shield") {
		if (p.shield) throw new Error(`${p.name} already has a lava shield.`);
		p.shield = true;
		events.push({
			type: "power",
			playerId: p.id,
			power
		});
	} else {
		const target = s.players.find((x) => x.id === targetId);
		if (!target || target.id === p.id || target.boarded) throw new Error("Pick another player who is still on the island.");
		const to = Math.max(s.lavaFront, target.pos - RULES.pushbackDistance, 0);
		events.push({
			type: "power",
			playerId: p.id,
			power,
			targetId: target.id
		}, {
			type: "move",
			playerId: target.id,
			from: target.pos,
			to
		});
		target.pos = to;
	}
	p.powers.splice(slot, 1);
	if (isAtDock(p)) return events.concat(boardShip(s, p));
	return events;
}
/** Resolve the landing before its animation begins. */
function roll(s, forced) {
	assertPhase(s, "turn");
	const p = currentPlayer(s);
	const value = forced ?? randInt(s.rng, 1, 6);
	const to = Math.min(p.pos + value, DOCK);
	const events = [{
		type: "roll",
		playerId: p.id,
		value
	}, {
		type: "move",
		playerId: p.id,
		from: p.pos,
		to
	}];
	p.pos = to;
	const tile = s.board[to];
	if (tile.kind === "dock") return events.concat(boardShip(s, p));
	const qtype = tile.qtype;
	s.pending = {
		question: drawMath(s.rng, selectedBands(s.setup.schoolLevels ?? s.setup.schoolLevel), qtype, s.setup.difficulty, s.used),
		tile
	};
	s.phase = "question";
	return events;
}
/** Answers the pending question. Pass `null` when the timer runs out. */
function answer(s, response) {
	assertPhase(s, "question");
	const pending = s.pending;
	const p = currentPlayer(s);
	const d = DIFFICULTY[s.setup.difficulty];
	const correct = response !== null && isCorrect(pending.question, response);
	const events = [{
		type: "answer",
		playerId: p.id,
		correct,
		answer: correctAnswerText(pending.question)
	}];
	s.pending = null;
	s.phase = "turn";
	if (correct) {
		p.points += d.points;
		events.push({
			type: "points",
			playerId: p.id,
			amount: d.points
		});
		if (pending.tile.kind === "power") {
			if (p.powers.length < RULES.maxPowers) {
				const power = pick(s.rng, [
					"jump",
					"shield",
					"pushback"
				]);
				p.powers.push(power);
				events.push({
					type: "gainPower",
					playerId: p.id,
					power
				});
			} else events.push({
				type: "powerSlotsFull",
				playerId: p.id
			});
		}
	} else {
		const to = Math.max(s.lavaFront, p.pos - d.back, 0);
		if (to !== p.pos) {
			events.push({
				type: "move",
				playerId: p.id,
				from: p.pos,
				to
			});
			p.pos = to;
		}
	}
	return events.concat(endTurn(s));
}
function boardShip(s, p) {
	p.boarded = true;
	s.escapeOrder.push(p.id);
	s.pending = null;
	const events = [{
		type: "board",
		playerId: p.id
	}];
	if (s.escapeOrder.length < (s.players.length === 2 ? 1 : 2)) return events.concat(endTurn(s));
	s.phase = "over";
	s.winnerId = s.escapeOrder[0];
	return events.concat({
		type: "gameOver",
		winnerId: s.winnerId,
		reason: "boarded"
	});
}
function standings(s) {
	const boarded = s.escapeOrder.map((id, index) => ({
		player: s.players[id],
		rank: index + 1
	}));
	const island = s.players.filter((p) => !p.boarded).sort((a, b) => b.points - a.points || b.pos - a.pos);
	let rank = boarded.length;
	return boarded.concat(island.map((player, index) => {
		const prev = island[index - 1];
		if (!prev || prev.points !== player.points || prev.pos !== player.pos) rank = boarded.length + index + 1;
		return {
			player,
			rank
		};
	}));
}
function expireMatch(s) {
	if (s.phase === "over") return [];
	s.pending = null;
	s.phase = "over";
	s.winnerId = standings(s)[0].player.id;
	return [{
		type: "gameOver",
		winnerId: s.winnerId,
		reason: "timeExpired"
	}];
}
/** Moves to the next player, advancing lava at the end of each full round. */
function endTurn(s) {
	const events = [];
	for (let guard = 0; guard < s.players.length * 8; guard++) {
		s.current = (s.current + 1) % s.players.length;
		if (s.current === 0) {
			s.round += 1;
			events.push(...advanceLava(s));
			if (s.phase === "over") return events;
		}
		const next = currentPlayer(s);
		if (next.boarded) continue;
		if (next.skipTurns > 0) {
			next.skipTurns -= 1;
			events.push({
				type: "skip",
				playerId: next.id
			});
			continue;
		}
		events.push({
			type: "turn",
			playerId: next.id,
			round: s.round
		});
		return events;
	}
	throw new Error("No player could take a turn.");
}
function advanceLava(s) {
	if (s.round <= RULES.lavaGraceRounds + 1) return [];
	s.lavaFront = Math.min(s.lavaFront + RULES.lavaPerRound, s.setup.matchMinutes ? DOCK - 1 : DOCK);
	const events = [{
		type: "lava",
		front: s.lavaFront
	}];
	for (const p of s.players) {
		if (p.boarded || p.pos >= s.lavaFront) continue;
		const to = s.lavaFront;
		events.push({
			type: "lavaHit",
			playerId: p.id,
			shielded: p.shield,
			to
		});
		if (p.shield) p.shield = false;
		else p.skipTurns += 1;
		p.pos = to;
	}
	if (s.lavaFront >= DOCK) {
		const best = standings(s)[0].player;
		s.phase = "over";
		s.winnerId = best.id;
		events.push({
			type: "gameOver",
			winnerId: best.id,
			reason: "lavaReachedHarbour"
		});
	}
	return events;
}
// src/data/questions.json
var questions_default = [
	{
		"id": "sci-001",
		"subject": "science",
		"type": "mcq",
		"difficulty": "easy",
		"prompt": "What do plants need from the sun to make food?",
		"choices": [
			"Light",
			"Sand",
			"Noise",
			"Smoke"
		],
		"answerIndex": 0
	},
	{
		"id": "sci-002",
		"subject": "science",
		"type": "mcq",
		"difficulty": "easy",
		"prompt": "Which animal lays eggs?",
		"choices": [
			"Chicken",
			"Cow",
			"Cat",
			"Goat"
		],
		"answerIndex": 0
	},
	{
		"id": "sci-003",
		"subject": "science",
		"type": "mcq",
		"difficulty": "easy",
		"prompt": "What is ice made of?",
		"choices": [
			"Water",
			"Salt",
			"Sugar",
			"Glass"
		],
		"answerIndex": 0
	},
	{
		"id": "sci-004",
		"subject": "science",
		"type": "mcq",
		"difficulty": "easy",
		"prompt": "How many legs does an insect have?",
		"choices": [
			"6",
			"4",
			"8",
			"10"
		],
		"answerIndex": 0
	},
	{
		"id": "sci-005",
		"subject": "science",
		"type": "mcq",
		"difficulty": "medium",
		"prompt": "What do we call melted rock that comes out of a volcano?",
		"choices": [
			"Lava",
			"Granite",
			"Coal",
			"Sand"
		],
		"answerIndex": 0
	},
	{
		"id": "sci-006",
		"subject": "science",
		"type": "mcq",
		"difficulty": "medium",
		"prompt": "Which planet is closest to the Sun?",
		"choices": [
			"Mercury",
			"Venus",
			"Earth",
			"Mars"
		],
		"answerIndex": 0
	},
	{
		"id": "sci-007",
		"subject": "science",
		"type": "mcq",
		"difficulty": "medium",
		"prompt": "Which gas do we breathe out?",
		"choices": [
			"Carbon dioxide",
			"Oxygen",
			"Helium",
			"Hydrogen"
		],
		"answerIndex": 0
	},
	{
		"id": "sci-008",
		"subject": "science",
		"type": "mcq",
		"difficulty": "medium",
		"prompt": "Which part of a plant takes in water from the soil?",
		"choices": [
			"Roots",
			"Leaves",
			"Flowers",
			"Seeds"
		],
		"answerIndex": 0
	},
	{
		"id": "sci-009",
		"subject": "science",
		"type": "mcq",
		"difficulty": "hard",
		"prompt": "What is melted rock called while it is still underground?",
		"choices": [
			"Magma",
			"Lava",
			"Basalt",
			"Ash"
		],
		"answerIndex": 0
	},
	{
		"id": "sci-010",
		"subject": "science",
		"type": "mcq",
		"difficulty": "hard",
		"prompt": "Which layer of the Earth do we live on?",
		"choices": [
			"Crust",
			"Mantle",
			"Outer core",
			"Inner core"
		],
		"answerIndex": 0
	},
	{
		"id": "sci-011",
		"subject": "science",
		"type": "mcq",
		"difficulty": "hard",
		"prompt": "At what temperature does water boil at sea level?",
		"choices": [
			"100°C",
			"90°C",
			"120°C",
			"50°C"
		],
		"answerIndex": 0
	},
	{
		"id": "sci-012",
		"subject": "science",
		"type": "mcq",
		"difficulty": "hard",
		"prompt": "Which organ pumps blood around the body?",
		"choices": [
			"Heart",
			"Lungs",
			"Liver",
			"Kidneys"
		],
		"answerIndex": 0
	},
	{
		"id": "eng-001",
		"subject": "english",
		"type": "mcq",
		"difficulty": "easy",
		"prompt": "Which word is an animal?",
		"choices": [
			"Tiger",
			"Table",
			"Blue",
			"Run"
		],
		"answerIndex": 0
	},
	{
		"id": "eng-002",
		"subject": "english",
		"type": "mcq",
		"difficulty": "easy",
		"prompt": "What is the opposite of \"hot\"?",
		"choices": [
			"Cold",
			"Warm",
			"Big",
			"Fast"
		],
		"answerIndex": 0
	},
	{
		"id": "eng-003",
		"subject": "english",
		"type": "mcq",
		"difficulty": "medium",
		"prompt": "Which word is a verb?",
		"choices": [
			"Swim",
			"Happy",
			"Island",
			"Green"
		],
		"answerIndex": 0
	},
	{
		"id": "eng-004",
		"subject": "english",
		"type": "mcq",
		"difficulty": "medium",
		"prompt": "What is the plural of \"child\"?",
		"choices": [
			"Children",
			"Childs",
			"Childes",
			"Childen"
		],
		"answerIndex": 0
	},
	{
		"id": "eng-005",
		"subject": "english",
		"type": "mcq",
		"difficulty": "hard",
		"prompt": "Which word means \"very big\"?",
		"choices": [
			"Enormous",
			"Tiny",
			"Narrow",
			"Fragile"
		],
		"answerIndex": 0
	},
	{
		"id": "eng-006",
		"subject": "english",
		"type": "mcq",
		"difficulty": "hard",
		"prompt": "Choose the correct sentence.",
		"choices": [
			"The boats were leaving the harbour.",
			"The boats was leaving the harbour.",
			"The boat were leaving the harbour.",
			"The boats is leaving the harbour."
		],
		"answerIndex": 0
	},
	{
		"id": "eng-f001",
		"subject": "english",
		"type": "fill",
		"difficulty": "easy",
		"prompt": "Fill the blank: I ___ a cat. (have / has)",
		"answers": ["have"]
	},
	{
		"id": "eng-f002",
		"subject": "english",
		"type": "fill",
		"difficulty": "easy",
		"prompt": "Fill the blank with the missing letter: sh_p (a big boat)",
		"answers": ["i"]
	},
	{
		"id": "eng-f003",
		"subject": "english",
		"type": "fill",
		"difficulty": "medium",
		"prompt": "Fill the blank: The ship ___ away yesterday. (sail)",
		"answers": ["sailed"]
	},
	{
		"id": "eng-f004",
		"subject": "english",
		"type": "fill",
		"difficulty": "medium",
		"prompt": "Fill the blank: Mei is ___ than her brother. (tall)",
		"answers": ["taller"]
	},
	{
		"id": "eng-f005",
		"subject": "english",
		"type": "fill",
		"difficulty": "hard",
		"prompt": "Fill the blank: The volcano erupted, ___ everyone ran to the boats. (so / but)",
		"answers": ["so"]
	},
	{
		"id": "eng-f006",
		"subject": "english",
		"type": "fill",
		"difficulty": "hard",
		"prompt": "Fill the blank: Yesterday we ___ to the harbour. (run)",
		"answers": ["ran"]
	},
	{
		"id": "ara-001",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "easy",
		"prompt": "What does this word mean?\nكِتَاب",
		"choices": [
			"Book",
			"Pen",
			"House",
			"Water"
		],
		"answerIndex": 0
	},
	{
		"id": "ara-002",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "easy",
		"prompt": "What does this word mean?\nقَلَم",
		"choices": [
			"Pen",
			"Book",
			"Door",
			"Bread"
		],
		"answerIndex": 0
	},
	{
		"id": "ara-003",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "easy",
		"prompt": "What does this word mean?\nبَيْت",
		"choices": [
			"House",
			"School",
			"Water",
			"Cat"
		],
		"answerIndex": 0
	},
	{
		"id": "ara-004",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "easy",
		"prompt": "What does this word mean?\nمَاء",
		"choices": [
			"Water",
			"Milk",
			"Bread",
			"Book"
		],
		"answerIndex": 0
	},
	{
		"id": "ara-005",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "medium",
		"prompt": "What does this word mean?\nأُمّ",
		"choices": [
			"Mother",
			"Father",
			"Brother",
			"Sister"
		],
		"answerIndex": 0
	},
	{
		"id": "ara-006",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "medium",
		"prompt": "What does this word mean?\nأَب",
		"choices": [
			"Father",
			"Mother",
			"Teacher",
			"Son"
		],
		"answerIndex": 0
	},
	{
		"id": "ara-007",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "medium",
		"prompt": "What does this word mean?\nخُبْز",
		"choices": [
			"Bread",
			"Rice",
			"Milk",
			"Apple"
		],
		"answerIndex": 0
	},
	{
		"id": "ara-008",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "medium",
		"prompt": "What does this word mean?\nقِطَّة",
		"choices": [
			"Cat",
			"Dog",
			"Bird",
			"Fish"
		],
		"answerIndex": 0
	},
	{
		"id": "ara-009",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "hard",
		"prompt": "What does this word mean?\nمَدْرَسَة",
		"choices": [
			"School",
			"Library",
			"Mosque",
			"Market"
		],
		"answerIndex": 0
	},
	{
		"id": "ara-010",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "hard",
		"prompt": "What does this word mean?\nعَيْن",
		"choices": [
			"Eye",
			"Ear",
			"Hand",
			"Nose"
		],
		"answerIndex": 0
	},
	{
		"id": "ara-011",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "hard",
		"prompt": "What does this word mean?\nيَد",
		"choices": [
			"Hand",
			"Foot",
			"Head",
			"Eye"
		],
		"answerIndex": 0
	},
	{
		"id": "ara-012",
		"subject": "arabic",
		"type": "mcq",
		"difficulty": "hard",
		"prompt": "What does this word mean?\nأَخ",
		"choices": [
			"Brother",
			"Sister",
			"Uncle",
			"Friend"
		],
		"answerIndex": 0
	}
];
// server/room.js
var palette = [
	"#2DD4BF",
	"#60A5FA",
	"#F472B6",
	"#A3E635",
	"#E2E8F0",
	"#FDBA74"
];
var hours = 216e5;
var fail = (message, status = 400) => {
	throw Object.assign(new Error(message), { status });
};
var json = (body, status = 200) => Response.json(body, {
	status,
	headers: { "Cache-Control": "no-store" }
});
function choices(values, allowed) {
	if (!Array.isArray(values)) fail("Choose your game settings.");
	const result = allowed.filter((v) => values.includes(v));
	if (!result.length) fail("Select a subject and question type.");
	return result;
}
function options(data) {
	return {
		difficulty: [
			"easy",
			"medium",
			"hard"
		].includes(data.difficulty) ? data.difficulty : "easy",
		subjects: ["math"],
		schoolLevels: selectedBands(data.schoolLevels ?? data.schoolLevel),
		qtypes: choices(data.qtypes, [
			"mcq",
			"fill",
			"pattern",
			"word"
		]),
		timer: data.timer === true,
		matchMinutes: [
			0,
			5,
			10,
			15
		].includes(data.matchMinutes) ? data.matchMinutes : 10,
		weather: [
			"auto",
			"clear",
			"dusk",
			"rain",
			"thunder"
		].includes(data.weather) ? data.weather : "auto"
	};
}
function member(data) {
	if (typeof data.name !== "string" || !data.name.trim() || !palette.includes(data.color)) fail("Choose a crew member and enter your name.");
	return {
		name: data.name.trim().slice(0, 18),
		color: data.color,
		token: crypto.randomUUID()
	};
}
function view(room, id, seat, rev) {
	const { members, settings, game, deadline, questionEnd, feedback, events } = room;
	let board = null;
	if (game) {
		const { pending, used, bank, rng, ...publicGame } = game;
		board = {
			...publicGame,
			pending: pending ? {
				tile: pending.tile,
				question: {
					band: pending.question.band,
					prompt: pending.question.prompt,
					choices: pending.question.choices,
					type: pending.question.type
				}
			} : null
		};
	}
	return {
		id,
		seat,
		rev,
		settings,
		members: members.map(({ name, color }) => ({
			name,
			color
		})),
		game: board,
		deadline,
		questionEnd,
		feedback,
		events,
		serverNow: Date.now(),
		ended: room.ended,
		ranks: game?.phase === "over" ? standings(game).map((x) => ({
			id: x.player.id,
			rank: x.rank
		})) : []
	};
}
function saveGame(game) {
	if (!game) return null;
	const { rng, bank, ...data } = game;
	return {
		...data,
		used: Array.from(game.used)
	};
}
function observe(room, now, seen) {
	const g = room.game;
	if (!g || g.phase === "over") return false;
	if (room.deadline && now >= room.deadline) {
		room.events = expireMatch(g);
		room.ended = "eruption";
		return true;
	}
	if (g.phase === "question" && room.questionEnd && now >= room.questionEnd) {
		take(room, {
			action: "answer",
			value: null
		}, now);
		return true;
	}
	if ((g.phase === "turn" || !room.questionEnd) && now - Math.max(seen, room.turnStart) >= 3e4) {
		g.phase = "turn";
		g.pending = null;
		room.events = endTurn(g);
		room.feedback = "Connection lost. The turn passed.";
		room.turnStart = now;
		room.questionEnd = 0;
		return true;
	}
	return false;
}
function explain(q, correct) {
	if (q.type === "fill") return q.prompt.replace(/^Fill the blank: /, "").replace(/_+/, correct);
	if (q.id.startsWith("math-mcq")) return q.prompt.replace(/^What is /, "").replace("?", " = " + correct + ".");
	if (q.id.startsWith("math-pattern")) {
		const numbers = q.id.split("-").at(-1).split(".").map(Number);
		if (numbers.every((v, i) => !i || v - numbers[i - 1] === numbers[1] - numbers[0])) return "The step between terms is " + (numbers[1] - numbers[0]) + ".";
		if (numbers.every((v, i) => !i || v / numbers[i - 1] === numbers[1] / numbers[0])) return "Multiply each term by " + numbers[1] / numbers[0] + ".";
		return "The gap grows with each step.";
	}
	if (q.subject === "arabic") return q.prompt.split("\n").at(-1) + " means “" + correct + "”.";
	return q.explanation || "";
}
function take(room, data, now) {
	const g = room.game;
	if (data.action === "roll") room.events = roll(g);
	else if (data.action === "power") room.events = usePower(g, data.power, data.target);
	else if (data.action === "answer") {
		const question = g.pending?.question;
		room.events = answer(g, data.value);
		const result = room.events.find((e) => e.type === "answer");
		room.feedback = (result.correct ? "Correct! " : "The correct answer was ") + result.answer + ". " + explain(question, result.answer);
	} else fail("Unknown move.");
	if (data.action !== "answer") room.feedback = "";
	room.turnStart = now;
	room.questionEnd = g.phase === "question" && g.setup.timer ? now + DIFFICULTY[g.setup.difficulty].seconds * 1e3 : 0;
	if (g.phase === "over") room.ended = room.events.some((e) => e.reason === "boarded") ? "boarded" : "eruption";
}
async function roomRequest(request, db) {
	try {
		const url = new URL(request.url);
		if (request.method !== "POST") return json({ error: "Use POST." }, 405);
		if (request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) return json({ error: "Invalid origin." }, 403);
		const raw = await request.text();
		if (raw.length > 4096) fail("Request too large.");
		const data = JSON.parse(raw || "{}"), now = Date.now();
		const id = url.pathname.split("/")[3];
		if (!id) {
			const creator = member(data), code = crypto.randomUUID().slice(0, 8).toUpperCase();
			const room = {
				settings: options(data),
				members: [creator],
				game: null,
				events: [],
				feedback: "",
				deadline: 0,
				questionEnd: 0
			};
			await db.prepare("DELETE FROM rooms WHERE expires < ?").bind(now).run();
			await db.prepare("INSERT INTO rooms VALUES (?,0,?,?)").bind(code, JSON.stringify(room), now + hours).run();
			return json({
				...view(room, code, 0, 0),
				token: creator.token
			});
		}
		const rec = await db.prepare("SELECT body, revision FROM rooms WHERE id=? AND expires>?").bind(id, now).first();
		if (!rec) fail("Room expired or code incorrect.", 404);
		const room = JSON.parse(rec.body);
		if (room.game) Object.assign(room.game, {
			bank: questions_default,
			used: new Set(room.game.used),
			rng: createRng(crypto.getRandomValues(/* @__PURE__ */ new Uint32Array(1))[0])
		});
		let seat = room.members.findIndex((p) => "Bearer " + p.token === request.headers.get("Authorization"));
		let changed = false, token;
		if (data.action === "join" && seat < 0) {
			if (room.game || room.members.length >= 6) fail("This room has started or is full.");
			const p = member(data);
			if (room.members.some((x) => x.color === p.color)) fail("That avatar is taken. Choose another.");
			seat = room.members.length;
			room.members.push(p);
			token = p.token;
			changed = true;
		} else if (seat < 0) fail("Join the room to continue.", 403);
		const g = room.game;
		const presence = g && g.phase !== "over" ? await db.prepare("SELECT seen FROM presence WHERE room=? AND seat=?").bind(id, g.current).first() : null;
		if (data.action === "poll" || data.action === "join" || data.rev === rec.revision) await db.prepare("INSERT INTO presence VALUES (?,?,?) ON CONFLICT(room,seat) DO UPDATE SET seen=excluded.seen").bind(id, seat, now).run();
		if (observe(room, now, presence?.seen || 0)) changed = true;
		else if (data.action === "start") {
			if (seat !== 0 || g || room.members.length < 2) fail("Only the host can start with at least two players.");
			room.game = createGame({
				...room.settings,
				players: room.members.map(({ name, color }) => ({
					name,
					color
				}))
			}, questions_default);
			room.deadline = room.settings.matchMinutes ? now + room.settings.matchMinutes * 6e4 : 0;
			room.turnStart = now;
			changed = true;
		} else if (!["poll", "join"].includes(data.action)) {
			if (!g || g.phase === "over" || seat !== g.current || data.rev !== rec.revision) fail("The turn has changed.", 409);
			take(room, data, now);
			changed = true;
		}
		let revision = rec.revision;
		if (changed) {
			if (!(await db.prepare("UPDATE rooms SET body=?,revision=revision+1,expires=? WHERE id=? AND revision=?").bind(JSON.stringify({
				...room,
				game: saveGame(room.game)
			}), now + hours, id, revision).run()).meta.changes) fail("Room updated. Try again.", 409);
			revision++;
		}
		return json({
			...view(room, id, seat, revision),
			token
		});
	} catch (e) {
		return json({ error: e.status ? e.message : "Unable to complete this room request." }, e.status || 400);
	}
}
// server/cloudflare.js
var cloudflare_default = { fetch(request, env) {
	const path = new URL(request.url).pathname;
	if (path === "/api/rooms" || /^\/api\/rooms\/[A-Z0-9]{8}$/.test(path)) return roomRequest(request, env.DB);
	return new Response("Not found", { status: 404 });
} };
export { cloudflare_default as default };
