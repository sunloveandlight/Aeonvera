# Aeonvera Launch SEO Checklist

Launch date: August 19, 2026

## Prelaunch

- Keep `AEONVERA_WAITLIST_MODE=1` in production.
- Confirm `/waitlist` is the only public entry in the sitemap while waitlist mode is enabled.
- Confirm waitlist page social links:
  - Facebook: `https://www.facebook.com/profile.php?id=61590871547912`
  - Instagram: `https://www.instagram.com/aeonvera.ai/`
  - X: `https://x.com/aeonvera`
  - YouTube: `https://www.youtube.com/@Aeonvera`
- Confirm Organization JSON-LD `sameAs` matches the official social URLs.
- Review all health content before public exposure, especially pages marked `Clinical review planned`.

## Launch Day

- Set `AEONVERA_WAITLIST_MODE=0` or remove it from production.
- Verify `/` is the public homepage.
- Verify `/resources` is crawlable and is the main public share link for the Longevity Library.
- Verify `/sitemap.xml` includes:
  - `/resources`
  - `/resources/articles`
  - `/resources/guides`
  - `/resources/biomarkers`
  - all published article URLs
  - all published biomarker guide URLs
- Verify `/robots.txt` allows public marketing and resources pages while blocking app/auth/API routes.
- Decide post-launch `/waitlist` behavior:
  - preferred: 301 redirect `/waitlist` to `/`
  - alternate: keep `/waitlist` live with `noindex`
- Submit sitemap in Google Search Console.
- Test social previews for `/`, `/resources`, and the two flagship articles.

## Launch Share Path

Primary launch share URL:

`https://www.aeonvera.com/resources`

Secondary share URLs:

- `https://www.aeonvera.com/resources/science-of-living-longer-25-evidence-based-strategies`
- `https://www.aeonvera.com/resources/what-is-biological-age`
