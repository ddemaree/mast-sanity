/**
 * Seed pages for validating @mast/blocks on Astro against mast-sanity-dev.
 *
 * Run: node scripts/seed-astro-validation.mjs
 * Auth: SANITY_API_TOKEN or ~/.config/sanity/config.json authToken
 */

import {createClient} from '@sanity/client'
import {readFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {
    // ignore missing env files
  }
}

loadEnv(join(process.cwd(), '.env'))
loadEnv(join(process.cwd(), 'astro-app/.env'))
loadEnv(join(process.cwd(), 'frontend/.env.local'))

function cliToken() {
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), '.config/sanity/config.json'), 'utf8'))
    return cfg.authToken
  } catch {
    return undefined
  }
}

// Prefer env / CLI; default project is mast-sanity-dev when unset.
const projectId =
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.PUBLIC_SANITY_PROJECT_ID ||
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  'zj4til7w'
const dataset =
  process.env.SANITY_STUDIO_DATASET ||
  process.env.PUBLIC_SANITY_DATASET ||
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_DATASET
if (!dataset) {
  console.error('Set SANITY_STUDIO_DATASET (or PUBLIC_SANITY_DATASET) in .env')
  process.exit(1)
}
const token = cliToken() || process.env.SANITY_API_TOKEN

if (!token) {
  console.error('Need Sanity CLI login (sanity login) or SANITY_API_TOKEN')
  process.exit(1)
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2025-01-01',
  useCdn: false,
})

const key = () => Math.random().toString(36).slice(2, 12)

const ss = (staticValue) => ({
  _type: 'smartString',
  mode: 'static',
  staticValue,
})

const richText = (text) => ({
  _type: 'block',
  _key: key(),
  style: 'normal',
  markDefs: [],
  children: [{_type: 'span', _key: key(), text, marks: []}],
})

const heading = (text, level = 'h2', align = 'left') => ({
  _type: 'headingBlock',
  _key: key(),
  text: ss(text),
  level,
  size: 'inherit',
  align,
  color: 'default',
})

const eyebrow = (text, align = 'left') => ({
  _type: 'eyebrowBlock',
  _key: key(),
  text: ss(text),
  variant: 'text',
  color: 'brand',
  align,
})

const body = (paragraphs, align = 'left') => ({
  _type: 'richTextBlock',
  _key: key(),
  content: paragraphs.map(richText),
  size: 'inherit',
  align,
  color: 'default',
  maxWidth: 'full',
})

const button = (text, href = '#', variant = 'primary') => ({
  _type: 'buttonBlock',
  _key: key(),
  text: ss(text),
  link: {_type: 'link', linkType: 'href', href},
  variant,
  color: 'brand',
  icon: 'none',
})

const col = (content, widthDesktop = '12') => ({
  _type: 'column',
  _key: key(),
  content,
  widthDesktop,
  widthTablet: 'inherit',
  widthMobile: '12',
  verticalAlign: 'start',
  padding: '0',
})

const row = (columns, horizontalAlign = 'start', gap = '6') => ({
  _type: 'row',
  _key: key(),
  columns,
  horizontalAlign,
  verticalAlign: 'stretch',
  gap,
  wrap: true,
  reverseOnMobile: false,
})

const section = (label, rows, extras = {}) => ({
  _type: 'section',
  _key: key(),
  label,
  rows,
  maxWidth: 'container',
  paddingTop: 'default',
  ...extras,
})

const homePage = {
  _type: 'page',
  _id: 'home-page',
  name: 'Home',
  slug: {_type: 'slug', current: 'home'},
  pageBuilder: [
    section(
      'Hero',
      [
        row(
          [
            col([
              heading('Mast blocks on Astro', 'h1', 'center'),
              body(
                [
                  'This home page is served by the Astro consumer using @mast/blocks. Static sections render with zero client JS; interactive blocks hydrate as islands.',
                ],
                'center',
              ),
              button('Open validation page', '/astro-compat', 'primary'),
            ]),
          ],
          'center',
        ),
      ],
      {paddingTop: 'spacious'},
    ),
  ],
}

const mastDemoPage = {
  _type: 'page',
  _id: 'mast-in-sanity-page',
  name: 'Mast in Sanity',
  slug: {_type: 'slug', current: 'mast-in-sanity'},
  pageBuilder: [
    section('Intro', [
      row([
        col([
          heading('Mast in Sanity', 'h1'),
          body([
            'A demo page for the shared page builder package. Same blocks, schemas, and queries — rendered here through Astro.',
          ]),
          button('Back home', '/', 'secondary'),
        ]),
      ]),
    ]),
  ],
}

const astroCompatPage = {
  _type: 'page',
  _id: 'astro-compat-test',
  name: 'Astro Compat Test',
  slug: {_type: 'slug', current: 'astro-compat'},
  pageBuilder: [
    // Truly static: heading + rich text + button only (no eyebrow/tabs/blog grid)
    section('Static SSR', [
      row(
        [
          col([
            heading('Zero-JS static section', 'h1', 'center'),
            body(
              [
                'This section has no hydration-required blocks, so Astro should SSR it without client:visible.',
              ],
              'center',
            ),
            button('Go home', '/', 'primary'),
          ]),
        ],
        'center',
      ),
    ]),
    // Interactive: tabs (needs hydration; SSR placeholder until mount)
    section(
      'Interactive tabs',
      [
        row([
          col([
            heading('Hydrated tabs island', 'h2'),
            body(['Tabs intentionally render a placeholder on the server, then hydrate on the client.']),
            {
              _type: 'tabsBlock',
              _key: key(),
              orientation: 'horizontal',
              menuPosition: 'above',
              tabs: [
                {
                  _type: 'tabItem',
                  _key: key(),
                  label: 'Astro',
                  content: [
                    body(['Rendered via Astro hybrid output and React islands.']),
                  ],
                },
                {
                  _type: 'tabItem',
                  _key: key(),
                  label: 'Next.js',
                  content: [
                    body(['The original consumer still uses the same @mast/blocks package.']),
                  ],
                },
                {
                  _type: 'tabItem',
                  _key: key(),
                  label: 'Sanity',
                  content: [body(['One schema, shared GROQ queries, host-injected adapters.'])],
                },
              ],
            },
          ]),
        ]),
      ],
      {backgroundColor: 'secondary'},
    ),
    // Blog grid island
    section('Blog grid', [
      row([
        col([
          heading('Posts from Sanity', 'h2'),
          {
            _type: 'blogGridBlock',
            _key: key(),
            selectionMode: 'all',
            limit: 3,
            sortBy: 'date',
            sortOrder: 'desc',
            columns: '3',
          },
        ]),
      ]),
    ]),
    // Mixed: eyebrow forces hydration on this section
    section('Hydrated copy', [
      row(
        [
          col([
            eyebrow('Validation', 'center'),
            heading('Eyebrow forces an island', 'h2', 'center'),
            body(
              ['eyebrowBlock is in HYDRATION_REQUIRED_BLOCK_TYPES, so this whole section uses client:visible.'],
              'center',
            ),
          ]),
        ],
        'center',
      ),
    ]),
  ],
}

const docs = [homePage, mastDemoPage, astroCompatPage]

console.log(`Seeding ${docs.length} pages → ${projectId}/${dataset}`)
for (const doc of docs) {
  const result = await client.createOrReplace(doc)
  console.log(`  ✓ ${result._id} (${doc.slug.current})`)
}

// Verify projection fix for plain-string legacy path + smartString path
const check = await client.fetch(
  `*[_id=="astro-compat-test"][0]{
    "heading": pageBuilder[0].rows[0].columns[0].content[_type=="headingBlock"][0].text,
    "buttonText": pageBuilder[0].rows[0].columns[0].content[_type=="buttonBlock"][0].text,
    "buttonLink": pageBuilder[0].rows[0].columns[0].content[_type=="buttonBlock"][0].link
  }`,
)
console.log('Raw heading shape:', JSON.stringify(check?.heading))
console.log('Done.')
