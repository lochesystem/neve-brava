# Snow Rush — Alpine Lodge v1

Visualização: `design-system.html`. Implementação compartilhada em `src/ui/design-system.css`; composição inicial em `src/ui/title-screen.css`. Apenas a home foi migrada. Não aplicar seletores globais à HUD.

## Fundamentos

- Tinta `--sr-ink`: texto e estrutura. Papel/neve: superfícies. Ouro: ação principal. Pinho: alternativa, foco e estado conectado. Coral: atenção.
- Tipografia: `--sr-display` (Barlow Condensed ExtraBold local, licença OFL em `public/fonts`) para títulos e ações; `--sr-body` para descrições.
- Espaçamento: `--sr-space-1` a `--sr-space-6`: 4, 8, 12, 16, 24, 32 px.
- Componentes opt-in: `.sr-panel`, `.sr-panel__surface`, `.sr-panel--snow`, `.sr-button`, `.sr-status`, `.sr-field`, `.sr-heading`, `.sr-copy`, `.sr-kicker`.
- Botões: `--primary`, `--pine`, `--quiet`. Usar `<button>` para ações e `<a>` para navegação. Estados reais: `:hover`, `:focus-visible`, `.gamepad-focus`, `:active`, `:disabled`. `.is-focused` apenas demonstração no catálogo.
- Ícones decorativos devem usar `aria-hidden="true"`; rótulos sempre texto real. Nunca colocar textos de ação dentro de imagens.
- Alvos touch >=44 px, foco com contorno externo; não depender só da cor. Respeitar `prefers-reduced-motion`. Paisagem compacta usa menos texto, não botões menores.

## Exemplo

```html
<div class="sr-panel sr-panel--snow">
  <div class="sr-panel__surface">
    <p class="sr-kicker">A montanha chamou.</p>
    <h2 class="sr-heading">Sua próxima aventura.</h2>
    <button class="sr-button sr-button--primary">Começar etapa</button>
  </div>
</div>
```

## Arte e performance

Logo e hero existentes preservados. Molduras e superfícies em CSS; sem blur ou filtros animados novos. Único bitmap novo: `public/images/ui/snow-cap.png` (336 KB), compartilhado entre painéis. Fundo transparente preservado; área vazia compensada no posicionamento CSS.

Gerado com ferramenta integrada de imagens (não CLI). Prompt: “Single reusable UI decoration for a cozy stylized snowboarding videogame: one very wide horizontal strip of soft accumulated white snow resting on the top edge of an invisible rectangular wooden sign. Transparent background, snow only. Front orthographic view, rounded irregular snow clumps, slightly drooping ends, short soft drips. White highlights, pale icy blue shading, stylized 3D game render. Snow shape ratio 12:1, tight bounding box. No falling flakes, icicles, scenery, text or symbols. Clean alpha cutout.”

## Próximas migrações

Migrar menus individualmente, preservando IDs e `.focusable` usados pelo InputManager. Não alterar a ordem de navegação, regras de desbloqueio ou o fluxo multiplayer só para adequar a aparência. A página de componentes é independente e não inicializa WebGL/socket do jogo.
