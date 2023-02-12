const fs = require("node:fs/promises");
const { google } = require("googleapis");
const youtubeTranscript = require("youtube-transcript");
const _got = require("got");
const { youtubeApiKey } = require("../config/env.config");
const xml2js = require("xml2js");
const { sql } = require("../utilities/postgres.utility");
const { generate } = require("../utilities/unique.utility");
const he = require("he");
const { Configuration, OpenAIApi } = require("openai");
const { PineconeClient } = require("pinecone-client");

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";
const got = _got.extend({
	headers: {
		'user-agent': USER_AGENT
	}
});

const VIDEO_ID = "JcE-1xzQTE0";

exports.loadVideo = async function loadVideo({ id = VIDEO_ID } = {}) {
    const youtube = google.youtube({
		version: "v3",
		auth: youtubeApiKey
	});

    const transcripts = await getTranscriptsForVideos([id]);

    for (let i = 0; i < transcripts.length; i ++) {
        const { videoId, parts = [] } = transcripts[i];

		const { data } = await youtube.videos.list({
			id: videoId,
			part: ["id", "contentDetails", "localizations", "snippet", "status"],
			maxResults: 1
		});
		
		const { items: videos } = data;
		const video = videos.pop();
		const title = video.snippet.title;
		const author = video.snippet.channelTitle;
		const thumbUrl = video.snippet.thumbnails.high.url;
		const id = generate();

		await sql`
			insert into youtube_videos
			(id, slug, title, source, type, url, thumb_url, author, youtube_id, created_at)
			values
			(${id}, ${id}, ${title}, 'youtube', 'youtube-video', ${`https://www.youtube.com/watch?v=${videoId}`}, ${thumbUrl}, ${author}, ${videoId}, ${new Date()})
		`;

        for (let j = 0; j < parts.length; j ++) {
            let { text, start, dur: duration } = parts[j];

            text = he.decode(text);

            await sql`
                insert into youtube_video_transcriptions
                (id, youtube_video, text, start, duration, created_at)
                values
                (${generate()}, ${videoId}, ${text}, ${+start}, ${+duration}, ${new Date()})
                returning id, youtube_video, text
            `;
        }
    }

    return { videoIds: transcripts.map(({ videoId }) => videoId) };
}


async function getTranscriptsForVideos(videoIds = [], { concurrency = 4 } = {}) {
	const transcripts = [];

	for (let i = 0; i < videoIds.length; i ++) {
		const videoId = videoIds[i];
		const rtn = await getTranscriptForVideo(videoId);
		transcripts.push(rtn);
	}

	return transcripts.filter(Boolean);
}

async function getTranscriptForVideo(videoId) {
	const transcript = await getTranscriptForVideoImpl(videoId)
	if (transcript) {
		return transcript
	}

	console.log("transcript fallback", videoId)
	try {
		const res = await youtubeTranscript.default.fetchTranscript(
			videoId,
			{
				lang: "en",
				country: "EN"
			}
		)

		const parts = res.map((p) => ({
			text: p.text,
			start: `${p.offset / 1000}`,
			dur: `${p.duration / 1000}`
		}))
		console.log("transcript fallback success", videoId, parts.length)

		// console.log(JSON.stringify(res, null, 2))
		return {
			videoId,
			parts
		}
	} catch (err) {
		console.warn("transcript error", videoId, err.toString())
	}

	return null
}

async function getTranscriptForVideoImpl(videoId) {
	console.log("getTranscriptForVideo", videoId)

	try {
		const html = await got(`https://www.youtube.com/watch?v=${videoId}`, {
			retry: {
				limit: 2
			}
		}).text()

		await fs.writeFile("out.html", html, "utf-8")

		// TODO: clean this up; it"s too brittle...
		const videoPageHtml = html.split('"captions":')
		if (videoPageHtml.length < 2) {
			console.warn("getTranscriptForVideo error", videoId, "no captions found")
			return null
		}
		const captions = JSON.parse(videoPageHtml[1].split(',"videoDetails')[0].replace('\n', ''));
		const captionTracks =
			captions?.playerCaptionsTracklistRenderer?.captionTracks

		// Find an english track
		// TODO: add a better heuristic here
		const track = captionTracks.find((track) => {
			return /english/i.test(track?.name?.simpleText)
		})
		if (!track) {
			console.warn(
				"getTranscriptForVideo warning",
				videoId,
				"no english captions"
			)
			console.log(JSON.stringify(captionTracks, null, 2))
			return null
		}

		const rawTranscriptXml = await got(track.baseUrl, {
			retry: {
				limit: 2
			}
		}).text()
		const parser = new xml2js.Parser()
		const parts0 = await parser.parseStringPromise(rawTranscriptXml)
		const parts = parts0.transcript.text.map((text) => ({
			text: text._,
			start: text.$.start,
			dur: text.$.dur
		}))

		return {
			videoId,
			parts
		}
	} catch (err) {
		console.warn("getTranscriptForVideo error", videoId, err.toString())
		return null
	}
}

exports.createEmbeddings = async function createEmbeddings() {
	const transcriptions = await sql`
		select * from youtube_video_transcriptions
		where youtube_video = ${VIDEO_ID}
	`;

	const videos = await sql`
		select title from youtube_videos
		where youtube_id = ${VIDEO_ID}
	`;

	await saveVideoTranscriptsToPinecone({
		videoId: VIDEO_ID,
		transcriptions: transcriptions,
		videoTitle: videos[0].title
	});
}

async function saveVideoTranscriptsToPinecone({ videoId, transcriptions = [], videoTitle }) {
	const openai = new OpenAIApi(
		new Configuration({
			apiKey: process.env.OPENAI_API_KEY
		})
	);

	const pinecone = new PineconeClient({
		apiKey: process.env.PINECONE_API_KEY,
		baseUrl: process.env.PINECONE_BASE_URL,
		namespace: process.env.PINECONE_NAMESPACE
	});

	try {
		console.log('processing video', videoId, videoTitle);

		const videoEmbeddings = await getEmbeddingsForVideoTranscript({
			transcriptions: transcriptions,
			title: videoTitle,
			videoId: videoId,
			openai
		})
		
		console.log(videoEmbeddings);

		console.log(
			'video',
			videoId,
			'upserting',
			videoEmbeddings.length,
			'vectors'
		);

		await pinecone.upsert({
			vectors: videoEmbeddings
		})
	} catch (err) {
		console.warn(
			'error upserting transcripts for video',
			videoId,
			videoTitle,
			err
		)
	}

	return [];
}

async function getEmbeddingsForVideoTranscript({ transcriptions = [], videoId, title, openai, model = "text-embedding-ada-002", maxInputTokens = 100, concurrency = 4 }) {

	let pendingVectors = [];
	let currentStart = "";
	let currentNumTokensEstimate = 0;
	let currentInput = "";
	let currentPartIndex = 0;
	let currentVectorIndex = 0;
	let isDone = false;

	// Pre-compute the embedding inputs, making sure none of them are too long
	do {
		isDone = currentPartIndex >= transcriptions.length

		const part = transcriptions[currentPartIndex];

		const text = unescape(part?.text)
			.replaceAll('[Music]', '')
			.replaceAll(/[\t\n]/g, ' ')
			.replaceAll('  ', ' ')
			.trim()

		const numTokens = getNumTokensEstimate(text)

		if (!isDone && currentNumTokensEstimate + numTokens < maxInputTokens) {
			if (!currentStart) {
				currentStart = part.start
			}

			currentNumTokensEstimate += numTokens
			currentInput = `${currentInput} ${text}`

			++currentPartIndex
		} else {
			currentInput = currentInput.trim()
			if (isDone && !currentInput) {
				break
			}

			const currentVector = {
				id: `${videoId}:${currentVectorIndex++}`,
				input: currentInput,
				metadata: {
					title,
					videoId,
					text: currentInput,
					start: currentStart
				}
			}

			pendingVectors.push(currentVector)

			// reset current batch
			currentNumTokensEstimate = 0
			currentStart = ''
			currentInput = ''
		}
	} while (!isDone)

	// Evaluate all embeddings with a max concurrency
	let vectors = [];
	for (let i = 0; i < pendingVectors.length; i++) {
		const pendingVector = pendingVectors[i];
		
		const { data: embed } = await openai.createEmbedding({
			input: pendingVector.input,
			model: model
		})

		const vector = {
			id: pendingVector.id,
			metadata: pendingVector.metadata,
			values: embed.data[0].embedding
		}

		vectors.push(vector);
	}

	return vectors;
}

function getNumTokensEstimate(input) {
	const numTokens = (input || '')
		.split(/\s/)
		.map((token) => token.trim())
		.filter(Boolean).length

	return numTokens;
}