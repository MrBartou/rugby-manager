import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const PACKAGE_JSON = resolve(__dirname, 'package.json');

/**
 * V0.60 : la version affichée vient du `package.json`, pas d'une constante
 * recopiée dans un composant. L'en-tête annonçait « Alpha V0.10 » cinquante
 * versions plus tard, ce que personne n'avait de raison de remarquer.
 */
const { version } = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { version: string };

/**
 * V0.62.1 : et il fallait encore relancer le serveur pour la voir changer.
 *
 * `define` fige la valeur au chargement de la configuration, et Vite ne
 * surveille que son propre fichier de configuration. Un `package.json` corrigé
 * pendant que le serveur tourne laissait donc l'ancienne version affichée, ce
 * qui donne exactement l'impression que le numéro ne bouge jamais. On ajoute le
 * fichier au watcher et on redemande un rechargement de la configuration.
 */
function versionEnDirect(): Plugin {
  return {
    name: 'version-en-direct',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(PACKAGE_JSON);
      server.watcher.on('change', chemin => {
        if (resolve(chemin) === PACKAGE_JSON) void server.restart();
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react(), versionEnDirect()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
