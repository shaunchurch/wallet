import { readFile } from 'node:fs/promises';
import tailwindcss from '@tailwindcss/postcss';
import type { Plugin } from 'esbuild';
import postcss from 'postcss';

export function postcssPlugin(): Plugin {
  return {
    name: 'postcss',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const css = await readFile(args.path, 'utf-8');
        const result = await postcss([tailwindcss()]).process(css, {
          from: args.path,
        });
        return { contents: result.css, loader: 'css' };
      });
    },
  };
}
