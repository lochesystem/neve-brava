import {readFileSync,existsSync} from 'node:fs';
import {expect,it} from 'vitest';
const file=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
it('preserva os IDs e focos dos comandos da tela inicial',()=>{
  const html=file('index.html');
  for(const id of ['campaign-button','multiplayer-button','install-button','settings-button']) {
    expect(html.match(new RegExp(`id="${id}"`,'g'))).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<button id="${id}" class="[^"]*focusable[^\"]*sr-button`));
  }
  expect(html).toContain('id="controller-name"');
});
it('mantém catálogo independente da engine e inclui fontes e arte locais',()=>{
  expect(file('src/ui/design-system.ts')).not.toMatch(/GameView|socket.io|main.ts/);
  for(const path of ['public/fonts/BarlowCondensed-ExtraBold.ttf','public/fonts/BarlowCondensed-OFL.txt','public/images/ui/snow-cap.png'])expect(existsSync(new URL(`../${path}`,import.meta.url))).toBe(true);
  expect(file('vite.config.ts')).toContain('design-system.html');
});
it('expõe estados acessíveis e preserva a separação da HUD',()=>{
  const css=file('src/ui/design-system.css');
  for(const state of [':focus-visible',':disabled','.gamepad-focus','prefers-reduced-motion'])expect(css).toContain(state);
  expect(css).not.toMatch(/\.hud|#hud/);
  expect(file('src/ui/title-screen.css')).toContain('min-height:44px');
});
