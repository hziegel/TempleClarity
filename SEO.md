# SEO notes

Already in `index.html`: title, meta description, robots, Open Graph and Twitter tags, JSON-LD (`WebApplication`), inline favicon, per-room page titles, a `<noscript>` fallback, one `<h1>` per room, valid language attribute.

## To add once the domain is live (replace `https://YOUR-DOMAIN`)

In `<head>`:

```html
<link rel="canonical" href="https://YOUR-DOMAIN/">
<meta property="og:url" content="https://YOUR-DOMAIN/">
<meta property="og:image" content="https://YOUR-DOMAIN/og-image.png">  <!-- 1200x630 -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://YOUR-DOMAIN/og-image.png">
```

`sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://YOUR-DOMAIN/</loc></url>
</urlset>
```

Add `Sitemap: https://YOUR-DOMAIN/sitemap.xml` to `robots.txt`, then submit the sitemap in Google Search Console and Bing Webmaster Tools.

## Limitation: hash routes

Rooms use `#` URLs (`/#about`). Search engines treat everything after `#` as the same page, so only the home page can rank. To make About, Terms and Search Activities indexable, serve real paths (`/about`, `/terms`) from the backend and switch the router to the History API, with the server returning `index.html` for those paths. Keep `/login`, `/profile` and the activity pages out of the index with `noindex` where appropriate.
