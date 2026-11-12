# Draf laporan bug (untuk https://github.com/anthropics/claude-code/issues)

**Judul:** Claude in Chrome: Claude-initiated downloads never start and no download approval prompt appears (Windows, desktop app)

**Environment**
- Windows 11 Pro 10.0.26100, Google Chrome (profile "Profile 1"), Claude in Chrome extension 1.0.105
  (`fcoeoabgfenejglbffodgkkbkcdhcgfn`, updated from 1.0.104 on 2026-11-04 13:28)
- Claude Code in the Claude desktop app (Code tab), auto mode
- Same extension version on another PC: Claude-initiated downloads work there

**What happens**
When Claude clicks a site's Download control (Google Flow image "Download → 1K", RunningHub result "Download"), no
download starts. Also a page-script blob download (`<a download>` created via javascript_tool) does not start.
- Nothing in `chrome://downloads`, no `.crdownload`, nothing in the profile's `History` → `downloads` table
  (no failed/blocked entries either)
- No "allow download" approval card appears anywhere (Chrome, extension side panel, desktop app)
- The same button clicked by the human downloads immediately

**Expected**
Per https://support.claude.com/en/articles/12902446-manage-claude-in-chrome-permissions Claude asks before downloading a
file. Expected an approval prompt, then the download.

**Ruled out**
- No Chrome enterprise policies (`HKLM/HKCU\SOFTWARE\Policies\Google\Chrome` absent)
- "Ask where to save each file" off; download folder `C:\Users\Administrator\Downloads`
- Site settings: Automatic downloads = Allow for flow.google.com and runninghub.ai
- Click method: ref click, screenshot-coordinate click, and JS blob download all fail the same way
- Extension reconnected; retried after reconnect (2026-11-04 19:22): same result

**Steps**
1. Ask Claude (desktop app, Code tab) to open any page with a download link in Claude in Chrome and click Download.
2. Watch `chrome://downloads` and for an approval prompt.
