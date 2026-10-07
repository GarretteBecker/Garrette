# Water Treatment Landing Page — How to Publish It

The whole page is one file: **`bm-water-treatment-elementor.html`** (in this folder).
It goes into **one Elementor HTML widget**. Your normal header and footer stay as they are.

---

## 1. Page settings

| Setting | Use this |
|---|---|
| Page title (WordPress) | `Water Treatment` |
| URL slug | `water-treatment-lancaster-pa` → **/water-treatment-lancaster-pa/** |
| Template | **Elementor Full Width** |
| SEO title | `Water Treatment & Water Softener Installation \| Lancaster PA \| B&M` |
| Meta description | `Free in-home water test from B&M, a veteran-owned local company. Water softeners, whole-home filtration & reverse osmosis in Lancaster & York Counties, PA.` |
| Focus keyphrase (Yoast / Rank Math) | `water treatment Lancaster PA` |
| Comments | Off |
| Search engine visibility | Allowed (index) |

The SEO title is 66 characters, so Google may trim the end on some screens. If you want it to always show
in full, use `Water Softener & Water Treatment in Lancaster, PA | B&M` (54 characters).

---

## 2. Paste it into Elementor (about 5 minutes)

1. **WordPress dashboard → Pages → Add New** (or open your existing **Water Treatment** page).
2. Type the title **Water Treatment**.
3. In the right-hand sidebar, find **URL** (sometimes under *Summary* or *Permalink*) and set it to
   `water-treatment-lancaster-pa`.
4. In the same sidebar, set **Template** to **Elementor Full Width**. Click **Save draft**.
5. Click **Edit with Elementor**.
6. Click the **gear icon** (Page Settings, bottom-left or top bar) and confirm:
   - **Page Layout: Elementor Full Width**
   - **Hide Title: ON**
7. Click the **+** in the empty page and pick the **single box** layout (one container).
8. Click the new container and set it up so the page can stretch edge to edge:
   - **Layout** tab → **Content Width: Full Width**
   - **Layout** tab → **Gaps: 0**
   - **Advanced** tab → **Padding: 0** on all four sides (click the chain-link icon to unlock, then type 0 in each box)
   - *(Older Elementor with "Sections" instead of containers: Section → Layout → **Content Width: Full Width** and **Columns Gap: No Gap**; then click the column → Advanced → **Padding 0**.)*
9. In the widget search box on the left, type **HTML**, then drag the **HTML** widget into the container.
10. Click inside the **HTML Code** box, press **Ctrl+A** (Mac: **Cmd+A**), then **paste the entire file**.
11. Click **Publish** (or **Update**).
12. Open the live page in a new tab and check it. Some things (the phone sticky bar, smooth scrolling)
    only behave properly on the live page, not inside the editor.
13. If you use a caching plugin (WP Rocket, LiteSpeed, etc.) or Cloudflare, **clear the cache**.

**Getting the code:** open `bm-water-treatment-elementor.html` on GitHub and click the **Copy raw file**
button (the two-squares icon above the code). That copies the whole file in one click.

---

## 3. Before you publish — replace these

Use **Ctrl+F** in the HTML box (or paste the code into Notepad/TextEdit first) to find each one.

| Find this | What to do |
|---|---|
| `PASTE GOHIGHLEVEL FORM EMBED HERE` | Delete that line and paste your GHL form embed code in its place (GHL: **Sites → Forms → your form → Integrate → Embed**). Until you do, visitors see a "Prefer to schedule by phone?" box with a Call button, so the page still works. Once the form is in, that box hides itself automatically. |
| `REPLACE WITH REAL B&M WATER SOFTENER INSTALLATION PHOTO` (2 spots: hero + softener section) | Upload the photo (**Media → Add New**), copy its **File URL**, paste it between the quotes in `src=""`, and update the `alt="…"` text to describe the photo. |
| `REPLACE WITH REAL B&M RO INSTALLATION PHOTO` | Same as above. |
| `REPLACE WITH REAL B&M WATER TEST / HOMEOWNER PHOTO` | Same as above. |
| `REPLACE WITH REAL B&M GOOGLE REVIEW` (3 spots) | Paste a real review word for word, the reviewer's name exactly as Google shows it, and the project type. **The three cards are hidden on the live page until you're done** (you still see them in the Elementor editor). When all three are real, find `bmwt-reviews-grid" hidden` and delete the word `hidden`. Until then, visitors see the heading and the **Read Our Google Reviews** button. |
| `based in Columbia` | Confirm this line is how you want your home base described. Edit it if not. |

Photos until replaced show a clean branded panel (icon + caption), not a broken image.

**Photo tips:** landscape or portrait is fine, the frame crops automatically. Aim for about 1600px wide
and under 400 KB. Compress before uploading (e.g. squoosh.app or TinyPNG).

---

## 4. Optional changes

- **Phone number / GoHighLevel tracking number:** search the code for `PHONE NUMBER SETTINGS`. Change the
  two lines under it (`BMWT_PHONE_DISPLAY` and `BMWT_PHONE_DIAL`). Every button and number on the
  page switches. Your main number stays in the page code for Google, which is the recommended way to
  use a tracking number. *(If you use GHL "number pools" with their own swap script, leave these alone.)*
- **Colors / corner rounding / page width:** search for `BRAND SETTINGS`. The first seven lines control
  the whole page.
- **Phone sticky bar:** search for `STICKY BAR`. The comment explains how to give the chat bubble more
  room or turn the bar off.
- **Manufacturer / warranty / certification badge:** search for `OPTIONAL BADGE SPOT`. Add it only
  once it's confirmed.
- **FAQ schema:** search for `FAQ SCHEMA`. It matches the visible FAQ word for word. If you edit an FAQ
  answer, edit it in both places, or delete the schema block. No business (LocalBusiness/Organization)
  schema is included, so nothing doubles up with your SEO plugin.

---

## 5. Quick test (desktop + phone)

**Desktop**
- [ ] Page loads with your normal header and footer; no second header or footer.
- [ ] Colored section backgrounds run edge to edge (if they stop short, redo step 8).
- [ ] Every **Schedule Your Free Water Test** button glides down to the form, and the form heading isn't hidden under your header.
- [ ] Press **Tab** a few times: each button and link shows a visible outline.
- [ ] FAQ questions open and close; the arrow flips.
- [ ] **Read Our Google Reviews** opens your Google listing in a new tab.
- [ ] No sideways scrolling.

**Phone (test on your own phone, on the live page)**
- [ ] Headline, buttons and text are easy to read without zooming.
- [ ] **Call B&M Today** opens the dialer with **717-449-8789**.
- [ ] After you scroll past the top buttons, the **Call Now / Free Water Test** bar appears at the bottom.
- [ ] The bar does **not** cover the chat bubble, and the chat bubble still opens.
- [ ] The bar disappears when you reach the form and at the bottom of the page.
- [ ] **Free Water Test** in the bar (and every Schedule button) jumps straight to the form box.
- [ ] Once the GHL form is in: submit a test entry and confirm it lands in GoHighLevel.

**If something doesn't work**
- FAQ won't open, or the phone bar never appears: a caching/speed plugin is probably delaying
  JavaScript. In WP Rocket or Perfmatters, add `bmwt-page` under *Delay JavaScript → Excluded
  JavaScript*. If WP Rocket's *Remove Unused CSS* is on, add `(.*)bmwt(.*)` to its *CSS Safelist*.
  Then clear the cache. (Cloudflare and LiteSpeed are already handled inside the code.)
- The page looks squeezed in the middle: the container still has padding or is set to "Boxed" (step 8).
