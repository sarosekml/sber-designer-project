import hljs from 'highlight.js';
import katex from 'katex';
import { marked } from 'marked';

const renderer = {
  code(code: string, infostring: string) {
    const language = (infostring || '').match(/\S*/)?.[0];
    if (language === 'latex') {
      return code;
    } else {
      const validLanguage = hljs.getLanguage(language ?? '') ? language : 'plaintext';
      try {
        const highlighted = validLanguage && hljs.highlight(code, { language: validLanguage }).value;
        return `<pre><code class="hljs ${validLanguage}">${highlighted}</code></pre>`;
      } catch (error) {
        console.error(`Ошибка при подсветке кода: ${error}`);
        return `<pre><code class="hljs">${hljs.highlightAuto(code).value}</code></pre>`;
      }
    }
  },
};
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
marked.use({ renderer });

export const preprocessText = (text: string) => {
  return text.replace(/(\$\$(?<katexMath1>[^?$]*)\$\$)|(\$(?<katexMath2>[^?$]*)\$)/gm, (match, ...args) => {
    const hasNamedGroups = typeof args.at(-1) === 'object';
    let katexMathResult;
    if (hasNamedGroups) {
      if (args.at(-1)?.['katexMath1']) {
        katexMathResult = args.at(-1)['katexMath1'];
      }
      if (args.at(-1)?.['katexMath2']) {
        katexMathResult = args.at(-1)['katexMath2'];
      }
    }
    return katex.renderToString(katexMathResult ? katexMathResult : match, { output: 'mathml', throwOnError: false });
  });
};
