Drop your own video files into this folder.

The app now tries to auto-discover supported video files in this folder
when the page refreshes.

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
- manifest.json is optional for files in this folder, but useful for labels.
- Auto-discovery depends on your local web server exposing the folder listing.
