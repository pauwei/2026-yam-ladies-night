# Ladies Night — NFC Invitations

Personalized, NFC-enabled invitation pages for **Ladies Night**, hosted by The YAM Guys.
Each guest taps her card, an envelope opens, and her personal reservation is revealed.

- Warm terracotta + cream design that matches the printed invite
- Envelope-opening animation → reveal (with a "tap to open" prompt)
- One private page per guest at `/invite/<code>/`
- Random, non-guessable codes (no names in the URL)
- "Evening Schedule — soon to come" placeholder ready to fill in later
- Graceful "Reservation not found" page for bad/unknown codes

---

## How it works

`guests.json` is the single source of truth. `build.js` reads it and generates a
**self-contained** page for each guest at `invite/<code>/index.html`. Each page only
contains that one guest's details — the full guest list is never shipped in one file.

```
guests.json        ← edit this: event info + guest list
template.html      ← the invitation design (edit once, applies to everyone)
build.js           ← run this to (re)generate all guest pages
invite/<code>/     ← generated pages (do not hand-edit)
404.html           ← shown automatically for unknown codes
index.html         ← generic landing page
nfc-urls.txt/.csv  ← generated list of URLs for NFC programming
scripts/new-code.js← generate random guest codes
```

---

## Quick start

1. **Set your base URL and add guests** in `guests.json`. Add `"baseUrl"` at the top level:

   ```json
   {
     "baseUrl": "https://YOUR-GITHUB-USERNAME.github.io/ladies-night",
     "event": { ... },
     "guests": [ ... ]
   }
   ```

2. **Build:**

   ```bash
   node build.js
   ```

   (or pass the base URL directly: `node build.js https://YOUR-USERNAME.github.io/ladies-night`)

3. **Preview locally:**

   ```bash
   python3 -m http.server 4173
   # open http://localhost:4173/invite/a7k3p/
   ```

4. **Publish** (see Deploy below), then program each NFC tag with the URL from `nfc-urls.txt`.

---

## Adding / editing guests

Edit `guests.json`. Generate a fresh code first:

```bash
node scripts/new-code.js        # → e.g. 7kq3p
```

Add an entry:

```json
{
  "code": "7kq3p",
  "name": "Jane Doe",
  "firstName": "Jane",
  "status": "Confirmed",
  "table": "3",
  "seat": "2"
}
```

Then re-run `node build.js`. To change seating for everyone later, just edit
`guests.json` and rebuild — no page-by-page editing.

Codes are 5 characters, lowercase letters/numbers, with ambiguous characters
(`0 o 1 l i`) removed so they're easy to read and type. `new-code.js` checks
`guests.json` so it never produces a duplicate.

---

## Deploy to GitHub Pages

1. Create a repo named **`ladies-night`** and push this folder to it.
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`. Save.
3. Wait ~1 minute. Your site is live at
   `https://YOUR-USERNAME.github.io/ladies-night/`.
4. Make sure the `baseUrl` in `guests.json` matches, and that `.nojekyll` is committed
   (it is included here — it keeps GitHub Pages from mangling folders).

```bash
git add -A
git commit -m "Ladies Night invitations"
git remote add origin https://github.com/YOUR-USERNAME/ladies-night.git
git push -u origin main
```

---

## NFC programming

`build.js` writes **`nfc-urls.txt`** and **`nfc-urls.csv`** with every guest's URL.
Program each tag with the guest's URL using an app like **NFC Tools** (iOS/Android):
add a **URL/URI record**, write, and lock the tag if desired.

`nfc-urls.csv` matches the tracking columns in your Google Sheet:
`Guest Name, Code, URL, Card Printed, NFC Programmed, Tested`.

---

## Testing checklist

- [ ] Every URL in `nfc-urls.txt` opens the correct guest
- [ ] Names, table, and seat match your Google Sheet
- [ ] Date / time / location are correct
- [ ] An invalid code (e.g. `/invite/xxxxx/`) shows "Reservation not found"
- [ ] NFC tap tested on an iPhone and an Android phone
- [ ] Envelope opens and the invitation reveals smoothly

---

## Filling in the schedule later

When the evening schedule is ready, edit the `.soon` block in `template.html`
(replace "Soon to come" and the note with the real schedule) and re-run
`node build.js`. Every guest page updates at once.

---

## Privacy notes

GitHub Pages sites are public. Random codes keep names out of URLs, but a page is
still reachable by anyone who has (or guesses) the code. Do **not** add phone numbers,
dietary restrictions, private notes, or a full RSVP list to any page. Pages include
`noindex` so search engines won't list them, but treat them as shareable-if-tapped,
not secret.
