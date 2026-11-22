// Classic scripts can run from file:// without cross-origin module requests.
import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';

for (const [page, entry, name] of [
  ['index', 'main', 'ShipAhead'],
  ['board3d', 'demo3d', 'ShipAheadBoard'],
]) {
  await build({
    configFile: false,
    base: './',
    build: {
      assetsDir: '',
      emptyOutDir: page === 'index',
      lib: { entry: 'src/' + entry + '.ts', formats: ['iife'], name,
        fileName: () => entry + '.js', cssFileName: entry },
    },
  });
  const html = await readFile(page + '.html', 'utf8');
  await writeFile('dist/' + page + '.html', html.replace(
    '<script type="module" src="/src/' + entry + '.ts"></script>',
    '<link rel="stylesheet" href="./' + entry + '.css"><script defer src="./' + entry + '.js"></script>',
  ));
}
