const fs = require("node:fs/promises");
const { google } = require("googleapis");
const youtubeTranscript = require("youtube-transcript");
const _got = require("got");
const { youtubeApiKey } = require("../config/env.config");
const xml2js = require("xml2js");
const { sql } = require("../utilities/postgres.utility");
const { generate } = require("../utilities/unique.utility");
const he = require("he");

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

async function getPlaylistDetails(playlistId, youtubeClient) {
	const playlist = (
		await youtubeClient.playlists.list({
			id: [playlistId],
			part: ["id", "contentDetails", "localizations", "snippet", "status"],
			maxResults: 1
		})
	).data.items[0]

	let playlistItems = []
	let playlistItemsPageToken;

	do {
		const playlistItemsPage = await youtubeClient.playlistItems.list({
			playlistId,
			part: ["id", "contentDetails", "snippet", "status"],
			maxResults: 50,
			pageToken: playlistItemsPageToken
		})

		playlistItems = playlistItems.concat(playlistItemsPage.data.items)
		playlistItemsPageToken = playlistItemsPage.data.nextPageToken
	} while (playlistItemsPageToken)

	return {
		playlistId,
		playlist,
		playlistItems
	}
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
