Drop your own video files into this folder.

The app now tries to auto-discover supported video files in this folder
when the page refreshes. If the local server does not expose a folder
listing, the app still probes numbered MP4 files from 1.mp4 through
40.mp4 automatically.

You can still list files in manifest.json if you want explicit control
or custom labels, like this:

{
  "videos": [
    "my-video-01.mp4",
    "my-video-02.mp4",
    {
      "file": "my-video-03.webm",
      "label": "custom clip 03"
    }
  ]
}

Notes:
- Keep files in this same folder unless you intentionally use a relative path.
- MP4 and WebM are the safest formats for browser playback.
- After adding files or editing manifest.json, refresh the page.
- If you use manifest.json, every array item needs a comma except the last one.
- File paths in manifest.json should match the filename case, such as 12.MP4.
- manifest.json is optional for files in this folder, but useful for labels.
- Non-numbered files depend on your local web server exposing the folder listing
  or being listed in manifest.json.
