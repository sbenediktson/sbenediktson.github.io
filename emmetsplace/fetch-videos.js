#!/usr/bin/env node
// Fetches Emmet Cohen's YouTube stream data and writes videos.json
// Run locally: YOUTUBE_API_KEY=your_key node fetch-videos.js
// In CI: key comes from GitHub Actions secret

const fs = require("fs");

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("Missing YOUTUBE_API_KEY environment variable");
  process.exit(1);
}

function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

function tsToSeconds(ts) {
  const parts = ts.split(":").map(Number);
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
}

const skipSong = /^(introduction of|intro to|intermission|set break|break\b|gratitude|thank)|\b(introduces|welcomes|solo)\b/i;

function cleanSongTitle(title) {
  return title.replace(/\s*[-–].*$/, "").trim();
}

function parseSongs(description) {
  const songs = [];
  for (const line of description.split("\n")) {
    const m = line.match(/^(\d+:\d{2}(?::\d{2})?)\s+(.+)$/);
    if (!m) continue;
    const title = m[2].trim();
    if (skipSong.test(title)) continue;
    songs.push({ title: cleanSongTitle(title), start: tsToSeconds(m[1]) });
  }
  return songs;
}

const skipArtistName = /^(recorded|signup|sign up|subscribe|follow|visit|ticket|merch|stream|buy|listen|available|support|learn|check|watch|like|share|comment|produc|mix|master|photograph|video|film|edit|artwork|design|engineer|live at|live from|new york|new orleans|shot |set list|setlist|special thanks|thank|sponsor|presented|hosted|booking|contact|email|website|facebook|twitter|instagram|youtube|spotify|apple)/i;

function parseArtists(description) {
  const artists = [];
  for (const line of description.split("\n")) {
    const match = line.match(/^([A-Z][^-\n]{1,40})\s*[-–]\s*([A-Za-z][^\n]{1,40})$/);
    if (!match) continue;
    const name = match[1].trim();
    const instrument = match[2].trim();
    if (name.includes("http") || name.includes("@")) continue;
    if (instrument.includes("http") || /^\d/.test(instrument)) continue;
    if (skipArtistName.test(name) || skipArtistName.test(instrument) || skipArtistName.test(name + " " + instrument)) continue;
    artists.push({ name, instrument });
  }
  return artists;
}

async function fetchChannelVideos() {
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=EmmetCohen&key=${API_KEY}`
  );
  const channelData = await channelRes.json();
  const uploadsId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

  const ids = [];
  let pageToken = null;
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=50&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url);
    const data = await res.json();
    for (const item of (data.items || [])) {
      const id = item.snippet.resourceId?.videoId;
      if (id) ids.push(id);
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return ids;
}

async function fetchVideoData(ids) {
  const batches = [];
  for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
  const results = {};
  await Promise.all(batches.map(async (batch) => {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,liveStreamingDetails&id=${batch.join(",")}&key=${API_KEY}`
    );
    const data = await res.json();
    for (const item of (data.items || [])) {
      const desc = item.snippet.description || "";
      results[item.id] = {
        title: item.snippet.title,
        duration: parseDuration(item.contentDetails?.duration || ""),
        isLive: !!item.liveStreamingDetails,
        streamDate: item.liveStreamingDetails?.actualStartTime || item.snippet.publishedAt,
        artists: parseArtists(desc),
        songs: parseSongs(desc),
      };
    }
  }));
  return results;
}

async function main() {
  console.log("Fetching channel videos...");
  const ids = await fetchChannelVideos();
  console.log(`Found ${ids.length} video IDs`);

  console.log("Fetching video details...");
  const data = await fetchVideoData(ids);
  console.log(`Fetched details for ${Object.keys(data).length} videos`);

  const output = { generatedAt: new Date().toISOString(), ids, data };
  fs.writeFileSync("videos.json", JSON.stringify(output));
  console.log("Wrote videos.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
