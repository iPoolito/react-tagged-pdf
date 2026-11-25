// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const repo = 'https://github.com/iPoolito/react-tagged-pdf';

export default defineConfig({
  // GitHub Pages project site: https://ipoolito.github.io/react-tagged-pdf/
  site: 'https://ipoolito.github.io',
  base: '/react-tagged-pdf',
  integrations: [
    starlight({
      title: 'react-tagged-pdf',
      description: 'Render React components to tagged PDF that passes the veraPDF PDF/UA-1 checks.',
      social: [{ icon: 'github', label: 'GitHub', href: repo }],
      editLink: { baseUrl: `${repo}/edit/main/site/` },
      sidebar: [
        { label: 'Start here', items: ['getting-started'] },
        { label: 'Examples', items: [{ autogenerate: { directory: 'examples' } }] },
        {
          label: 'Guides',
          items: ['guides/validation', 'guides/author-responsibilities'],
        },
        { label: 'Reference', items: ['reference/components'] },
      ],
    }),
  ],
});
