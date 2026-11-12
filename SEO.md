# SEO notes

Already in `index.html`: title, meta description, robots, Open Graph and Twitter tags, JSON-LD (`WebApplication`), inline favicon, per-room page titles, a `<noscript>` fallback, one `<h1>` per room, valid language attribute.

## Domain setup (templeclarity.com)

Done in the repo: canonical URL, Open Graph and Twitter image (`og-image.png`, 1200x630), `sitemap.xml`, and the `Sitemap:` line in `robots.txt`. When you deploy, serve `index.html`, `og-image.png`, `robots.txt` and `sitemap.xml` from the site root.

Then:

1. Redirect `www.templeclarity.com` to `templeclarity.com` (or the reverse) so there is only one version of the site.
2. Serve everything over HTTPS and redirect HTTP to HTTPS.
3. Add the site to Google Search Console and Bing Webmaster Tools, and submit `https://templeclarity.com/sitemap.xml`.
4. Check link previews with the Facebook Sharing Debugger and the LinkedIn Post Inspector.

## Limitation: hash routes

Rooms use `#` URLs (`/#about`). Search engines treat everything after `#` as the same page, so only the home page can rank. To make About, Terms and Search Activities indexable, serve real paths (`/about`, `/terms`) from the backend and switch the router to the History API, with the server returning `index.html` for those paths. Keep `/login`, `/profile` and the activity pages out of the index with `noindex` where appropriate.
