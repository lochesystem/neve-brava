# Neve Brava

Jogue a versão publicada em: **https://lochesystem.github.io/neve-brava/**

Vertical slice 3D de snowboard arcade para navegador. A descida combina carving contínuo, alta velocidade, obstáculos, quatro rampas, manobras, near misses, combo e recuperação rápida em uma montanha com aparência de ilustração tridimensional.

## Executar

Requer Node.js 22+.

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite, conecte um DualSense por USB ou Bluetooth e pressione um botão para que o navegador exponha o controle. O modo normal exige um DualSense reconhecido. Para desenvolvimento sem hardware:

```text
http://127.0.0.1:5173/?dev=1
```

## Controles

| Ação | DualSense | Fallback `?dev=1` |
| --- | --- | --- |
| Carving | Analógico esquerdo | A/D ou setas |
| Tuck/acelerar | R2 analógico | Shift |
| Frear | L2 analógico | Ctrl ou S |
| Carregar/soltar ollie | ✕ | Espaço |
| Grab | □ | F |
| Giro | L1/R1 | Q/E |
| Flip | △ | C |
| Preparar pouso | ○ | X |
| Usar item | R3 | R |
| Pausa | Options | Esc |

## Gates

```bash
npm test
npm run build
npm run check
```

## Implementado

- percurso autoral sinuoso de 3 km e aproximadamente 80–100 segundos, com centerline, câmera e terreno derivados da mesma geometria;
- cinco setores, quatro rampas e mais de 60 volumes de obstáculo/decorativos;
- carving, tuck, freio, ollie carregado, controle no ar e assistência de pouso;
- giros, flips, grabs, variedade, combo, near miss e avaliação de pouso;
- colisão em alta velocidade, queda única e retorno ao último ponto seguro;
- câmera amortecida com antecipação e FOV por velocidade;
- personagem apoiado visualmente na neve, terreno lateral completo, mais de 600 árvores/rochas instanciadas fora da pista, snowfall contínuo e spray de carving;
- HUD, título, configurações, pausa, desconexão e resultados;
- navegação completa por DualSense e gate de compatibilidade;
- gatilhos analógicos, deadzone radial e rumble com capability detection;
- áudio procedural de vento e feedback, iniciado somente após gesto;
- moedas de 100 créditos, caixas de armas por 200 e itens de vento, turbo e escudo;
- perfis Alta, Média e Performance;
- simulação em passo fixo de 60 Hz e regras críticas headless.

## Arquitetura

```text
src/core   — pista, matemática, simulação e pontuação sem Three.js/DOM
src/input  — Gamepad API, intents, rumble e áudio
src/view   — Three.js, câmera, mundo, personagem e partículas
src/main   — máquina de estados, único RAF, UI e composição
tests      — regras puras e invariantes da pista
```

O core possui o estado autoritativo. Renderer, UI, áudio e hápticos consomem snapshots/eventos e não aplicam consequências de gameplay.

## Validação e limites

Automatizado nesta versão: 14 testes de matemática, pista, pontuação e simulação; typecheck e build de produção.

Ainda exige homologação física: identificação do DualSense nos navegadores-alvo, intensidade do rumble, deadzone, latência Bluetooth, navegação de todos os elementos e uma descida completa no hardware. A Web Gamepad API não garante gatilhos adaptativos, LED, alto-falante ou hápticos avançados; esta build usa valores analógicos e `dual-rumble` quando expostos.

O bundle inclui Three.js e gera um aviso por ultrapassar 500 kB antes de gzip; o artefato comprimido atual fica em aproximadamente 142 kB. Code splitting não traria ganho relevante ao primeiro frame deste slice, porque o renderer é necessário desde a tela inicial.

Veja [docs/PRODUCTION-NOTES.md](docs/PRODUCTION-NOTES.md) para decisões, tuning, pista e playtest.
