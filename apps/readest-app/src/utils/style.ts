import { MONOSPACE_FONTS, SANS_SERIF_FONTS, SERIF_FONTS } from '@/services/constants';
import { ViewSettings } from '@/types/book';

import fontfacesCSS from '!!raw-loader!../styles/fonts.css';

const getFontStyles = (
  serif: string,
  sansSerif: string,
  monospace: string,
  defaultFont: string,
  fontSize: number,
  overrideFont: boolean,
) => {
  const serifFonts = [serif, ...SERIF_FONTS.filter((font) => font !== serif)];
  const sansSerifFonts = [sansSerif, ...SANS_SERIF_FONTS.filter((font) => font !== sansSerif)];
  const monospaceFonts = [monospace, ...MONOSPACE_FONTS.filter((font) => font !== monospace)];
  const fontStyles = `
    html {
      --serif: ${serifFonts.map((font) => `"${font}"`).join(', ')}, serif;
      --sans-serif: ${sansSerifFonts.map((font) => `"${font}"`).join(', ')}, sans-serif;
      --monospace: ${monospaceFonts.map((font) => `"${font}"`).join(', ')}, monospace;
    }
    body * {
      font-size: ${fontSize}px ${overrideFont ? '!important' : ''};
      font-family: revert ${overrideFont ? '!important' : ''};
      font-family: var(${defaultFont.toLowerCase() === 'serif' ? '--serif' : '--sans-serif'}) ${overrideFont ? '!important' : ''};
    }
  `;
  return fontStyles;
};

const getLayoutStyles = (
  spacing: number,
  justify: boolean,
  hyphenate: boolean,
  zoomLevel: number,
) => `
  @namespace epub "http://www.idpf.org/2007/ops";
  html {
    color-scheme: light dark;
  }
  /* https://github.com/whatwg/html/issues/5426 */
  @media (prefers-color-scheme: dark) {
    a:link {
        color: lightblue;
    }
  }
  body {
    zoom: ${zoomLevel}%; 
  }
  p, li, blockquote, dd {
    line-height: ${spacing};
    text-align: ${justify ? 'justify' : 'start'};
    -webkit-hyphens: ${hyphenate ? 'auto' : 'manual'};
    hyphens: ${hyphenate ? 'auto' : 'manual'};
    -webkit-hyphenate-limit-before: 3;
    -webkit-hyphenate-limit-after: 2;
    -webkit-hyphenate-limit-lines: 2;
    hanging-punctuation: allow-end last;
    widows: 2;
  }
  /* prevent the above from overriding the align attribute */
  [align="left"] { text-align: left; }
  [align="right"] { text-align: right; }
  [align="center"] { text-align: center; }
  [align="justify"] { text-align: justify; }

  pre {
    white-space: pre-wrap !important;
  }
  aside[epub|type~="endnote"],
  aside[epub|type~="footnote"],
  aside[epub|type~="note"],
  aside[epub|type~="rearnote"] {
    display: none;
  }
`;

export const getStyles = (viewSettings: ViewSettings) => {
  const layoutStyles = getLayoutStyles(
    viewSettings.lineHeight!,
    viewSettings.fullJustification!,
    viewSettings.hyphenation!,
    // FIXME: zoom level is not working in paginated mode
    viewSettings.scrolled ? viewSettings.zoomLevel! : 100,
  );
  const fontStyles = getFontStyles(
    viewSettings.serifFont!,
    viewSettings.sansSerifFont!,
    viewSettings.monospaceFont!,
    viewSettings.defaultFont!,
    viewSettings.defaultFontSize!,
    viewSettings.overrideFont!,
  );
  const userStylesheet = viewSettings.userStylesheet!;
  return `${layoutStyles}\n${fontStyles}\n${fontfacesCSS}\n${userStylesheet}`;
};
