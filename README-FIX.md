# Replace 4 files so your GitHub Pages site is correct

Your repo `omgamimg1m-glitch/skyline-weather` uploaded correctly. This fixes the
one remaining problem: the site still declares the **Netlify** address as its home,
which would tell Google your site moved somewhere it no longer lives.

`github-url-fix.zip` contains only 4 corrected files:

```
index.html     canonical + og:url + og:image now point to your GitHub URL
guide.html     same
sitemap.xml    both <loc> entries rewritten
robots.txt     Sitemap: line rewritten
```

Everything else in the repo is untouched — the CSS, JS, locales and image are
identical and correct.

---

## Do this after you have turned on GitHub Pages

### 1. Confirm your site works first

Settings → Pages → set **Deploy from a branch**, `main`, `/ (root)`, Save.
Open <https://omgamimg1m-glitch.github.io/skyline-weather/> — you should see the
forecast page with live weather. If that 404s, stop and fix that first; the URL
fix is pointless until the site is up.

### 2. Delete the wrong homepage? No — leave Netlify alone for now

Your Netlify site is live, indexed in Google and verified in Search Console.
Nothing below breaks it. It simply stops being the address the code advertises.

### 3. Upload the 4 replacement files

1. Extract `github-url-fix.zip` to a folder
2. In your repo: **Add file** → **Upload files**
3. Drag the 4 files in
4. Commit message: `Point site at GitHub Pages address`
5. **Commit changes**

GitHub will replace the existing files because they have the same names. It does
not create duplicates.

### 4. Verify it took

Open your repo and click `index.html`. Near the top of the file you should see:

```html
<link rel="canonical" href="https://omgamimg1m-glitch.github.io/skyline-weather/" />
```

If it still says `netlify.app`, the upload didn't replace the file.

Then check the live site after a minute:

- <https://omgamimg1m-glitch.github.io/skyline-weather/robots.txt>
- <https://omgamimg1m-glitch.github.io/skyline-weather/sitemap.xml>

Both should return the file with your `github.io` address inside.

### 5. Tell Google about the new address

In Search Console, **add a second property** for
`https://omgamimg1m-glitch.github.io/skyline-weather/`, verify it, submit the new
sitemap, request indexing. Leave the old Netlify property in place.

---

## Which address do you actually want to keep?

You now have two live copies. Pick one deliberately.

### Option A — Keep Netlify as the main site (simplest, recommended)

Your Netlify site is already indexed and verified. Do **not** upload
`github-url-fix.zip`. GitHub just holds a backup copy of the code.

Downside: two copies of the same content exist online, and the GitHub one
advertises the Netlify address — which is at least honest, and the canonical tag
prevents it being treated as a duplicate.

### Option B — Move to GitHub Pages

Upload the fix. GitHub Pages becomes the real address. Google needs to be told
(via step 5) or you lose search visibility for a while.

Downside: `username.github.io/repo/` is a longer, more technical URL than
`skyline-free-weather.netlify.app`. Netlify also supports the `_headers` file for
caching and security headers; GitHub Pages ignores it.

**A custom domain solves this permanently** — one address, either host, no
duplicate. That is still the cleanest end state.

---

## What has been checked

- All 4 files verified: canonical, `og:url`, `og:image`, sitemap `<loc>`, robots
  `Sitemap:` line all name `omgamimg1m-glitch.github.io/skyline-weather`
- Zero remaining `netlify` strings anywhere in them
- `sitemap.xml` parses as valid XML
- The corrected build was served and rendered: 12 cards, live weather, no 404s,
  no page errors, canonical resolving to the new address
