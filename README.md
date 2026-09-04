# Snow Rush

Jogue a versão publicada em: **https://lochesystem.github.io/neve-brava/**

Vertical slice 3D de snowboard arcade para navegador. A descida combina carving contínuo, alta velocidade, obstáculos, quatro rampas, manobras, near misses, combo e recuperação rápida em uma montanha com aparência de ilustração tridimensional.

## Executar

Requer Node.js 22+.

```bash
npm install
npm run dev
```

Para testar o multiplayer, execute também o servidor de salas e sincronização em outro terminal:

```bash
npm run dev:server
```

Abra o jogo em duas abas ou dispositivos. Em **MULTIPLAYER**, é possível buscar uma partida rápida ou criar uma sala privada com código de quatro caracteres. As salas aceitam de dois a quatro jogadores; vagas restantes continuam sendo ocupadas pelos oponentes do jogo.

Em produção, o site estático e o servidor são publicados separadamente. O arquivo `render.yaml` configura o backend no Render; depois de criar o serviço pelo blueprint, informe a URL resultante no build do site com `VITE_MULTIPLAYER_URL`. O valor padrão já aponta para `https://neve-brava-multiplayer.onrender.com`.

Abra o endereço exibido pelo Vite, conecte um DualSense por USB ou Bluetooth e pressione um botão para que o navegador exponha o controle. O modo normal exige um DualSense reconhecido. Para desenvolvimento sem hardware:

```text
http://127.0.0.1:5173/?dev=1
```

Para testar os especiais sem acumular moedas, ative `special-test`. A flag libera permanentemente apenas o especial do jogador; os oponentes continuam respeitando coleta e custo normalmente:

```text
http://127.0.0.1:5173/?dev=1&special-test=1
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
| Usar especial | L3 | T |
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
- salas multiplayer privadas por código e busca rápida, com escolha de piloto/pista, confirmação dos jogadores e largada sincronizada;
- sincronização online dos pilotos a 15 Hz e propagação de itens, especiais, quedas e chegada entre dois a quatro jogadores.

## Arquitetura

```text
src/core   — pista, matemática, simulação e pontuação sem Three.js/DOM
src/input  — Gamepad API, intents, rumble e áudio
src/view   — Three.js, câmera, mundo, personagem e partículas
src/multiplayer — cliente Socket.IO e adaptação da corrida local para rede
server     — servidor de salas, matchmaking e retransmissão em tempo real
shared     — contrato de rede compartilhado entre navegador e servidor
src/main   — máquina de estados, único RAF, UI e composição
tests      — regras puras e invariantes da pista
```

O core possui o estado autoritativo. Renderer, UI, áudio e hápticos consomem snapshots/eventos e não aplicam consequências de gameplay.

## Validação e limites

Automatizado nesta versão: 14 testes de matemática, pista, pontuação e simulação; typecheck e build de produção.

Ainda exige homologação física: identificação do DualSense nos navegadores-alvo, intensidade do rumble, deadzone, latência Bluetooth, navegação de todos os elementos e uma descida completa no hardware. A Web Gamepad API não garante gatilhos adaptativos, LED, alto-falante ou hápticos avançados; esta build usa valores analógicos e `dual-rumble` quando expostos.

O bundle inclui Three.js e gera um aviso por ultrapassar 500 kB antes de gzip; o artefato comprimido atual fica em aproximadamente 142 kB. Code splitting não traria ganho relevante ao primeiro frame deste slice, porque o renderer é necessário desde a tela inicial.

Veja [docs/PRODUCTION-NOTES.md](docs/PRODUCTION-NOTES.md) para decisões, tuning, pista e playtest.
