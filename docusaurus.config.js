// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const config = {
  title: 'Mansur Docs',
  tagline: 'Документация по контроллерам и игрушкам',
  url: 'https://whatdidu.github.io',
  baseUrl: '/LobachevskyWeb/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',

  organizationName: 'Whatdidu', // GitHub org/user name.
  projectName: 'LobachevskyWeb', // Repo name.

  i18n: {
    defaultLocale: 'ru',
    locales: ['ru'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl:
            'https://github.com/Whatdidu/LobachevskyWeb/edit/main/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Mansur Docs',
        logo: {
          alt: 'Mansur Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            position: 'left',
            label: 'Документация',
          },
          {
            href: 'https://github.com/Whatdidu/LobachevskyWeb',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Документация',
            items: [
              {
                label: 'Начало',
                to: '/docs',
              },
            ],
          },
          {
            title: 'Сообщество',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/Whatdidu/LobachevskyWeb',
              },
            ],
          },
        ],
        copyright: `© ${new Date().getFullYear()} Mansur`,
      },
    }),
};

module.exports = config;
