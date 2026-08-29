# Notas de produção

> Projeto: Neve Brava
> Versão: 0.1
> Atualizado em: 2026-08-28
> Status: vertical slice implementado; hardware a validar
> Fonte de verdade para: decisões, tuning, pista e playtest

## Aprendizados incorporados

- `webslinger-city`: Three.js direto, simulação separada da apresentação, deadzone radial, FOV por velocidade, UI consciente do dispositivo e perfis de qualidade.
- `f-zone-vr`: velocidade com controle, pista derivada de uma única geometria lógica, rampas com aproximação/recepção, reinício limpo e validação que não termina no build.
- `aurora-wilds`: um loop central, delta limitado, HUD em frequência menor, recursos visuais com lifecycle e DualSense tratado como requisito.
- `snaredusk`: edge detection, input semântico, foco direcional e testes de comportamento percebido.

Dívidas deliberadamente evitadas: React por frame, engine monolítica, física pesada antes de provar necessidade, geração infinita antes de provar a linha, estado duplicado na UI e timers de gameplay fora do relógio da simulação.

## APIs verificadas

- A [Gamepad API da MDN](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API) confirma acesso a botões, eixos, conexão e atuadores expostos pelo navegador.
- `GamepadHapticActuator.playEffect()` possui [disponibilidade limitada](https://developer.mozilla.org/en-US/docs/Web/API/GamepadHapticActuator/playEffect); por isso rumble usa capability detection, cooldown e falha silenciosa.
- A documentação do Three.js confirma [WebGLRenderer, sombras e ACES tone mapping](https://threejs.org/docs/pages/WebGLRenderer.html) e o uso de [MeshToonMaterial](https://threejs.org/docs/pages/MeshToonMaterial.html) para a direção estilizada.

## Decisões

### ADR-001 — Uma descida autoral antes de mundo infinito

- Status: aceita.
- Decisão: percurso fixo e sinuoso de 3 km com cinco setores, centerline compartilhada e decisões laterais contínuas.
- Motivo: permite ajustar leitura, ritmo e segurança de cada salto.
- Reavaliar quando: duas sessões de playtest mostrarem repetição sem descoberta de linhas.

### ADR-002 — Física arcade própria

- Status: aceita para o slice.
- Decisão: simulação cinemática em coordenadas de percurso e passo fixo de 60 Hz.
- Motivo: carving, salto e recuperação exigem previsibilidade maior que física emergente.
- Consequência: terreno é uma faixa dirigida; expansão para freeride exigiria novo spike.

### ADR-003 — DualSense obrigatório, teclado escondido

- Status: aceita.
- Decisão: o fluxo normal só inicia com ID compatível; teclado existe apenas em `?dev=1`.
- Motivo: impede que controle, prompts, menus e hápticos sejam tratados como polimento tardio.
- Limite: IDs e atuadores expostos variam por navegador; homologação física permanece obrigatória.

### ADR-004 — Ilustração 3D procedural

- Status: aceita.
- Decisão: low-poly arredondado, toon materials, contornos seletivos, paleta funcional e formas exageradas.
- Motivo: entrega identidade desenhada sem depender de downloads ou assets externos.
- Reavaliar quando: style frame em movimento indicar que um rig/asset autoral dedicado elevaria claramente poses e manobras.

## Tuning inicial

| Parâmetro | Valor | Intervalo seguro | Intenção |
| --- | ---: | ---: | --- |
| Velocidade inicial | 18 m/s | 16–20 | começar com urgência desde o primeiro segundo |
| Velocidade máxima no chão | 45 m/s | 40–48 | cerca de 162 km/h com leitura arcade |
| Aceleração base | 5,8 m/s² | 4,5–7 | montanha sempre alimenta movimento |
| Bônus de tuck | 8,5 m/s² | 6–10 | R2 produz explosão perceptível |
| Freio máximo | 15 m/s² | 12–19 | correção forte sem parar instantaneamente |
| Velocidade lateral máxima | 18 m/s | 15–21 | cruzar a pista sem teleporte |
| Gravidade aérea | 18,5 m/s² | 16–22 | ar curto e expressivo |
| Recuperação | 0,9 s | 0,7–1,2 | colisão custa sem matar ritmo |
| Invulnerabilidade | 1,2 s | 0,8–1,5 | não recair no mesmo obstáculo |
| Deadzone | 16% | 8–30% | remover drift preservando precisão |

Todos os valores são tuning de protótipo e devem mudar por evidência de playtest, não preferência isolada.

## Pista

| Setor | Faixa | Função |
| --- | --- | --- |
| Primeiras curvas | 0–360 m | ensinar linha, obstáculo central e slalom largo |
| Bosque dos recortes | 360–820 m | primeira rampa e escolhas ao redor de árvores/rocha |
| Serpentina azul | 820–1.280 m | alternância lateral e segunda rampa construída |
| Vale do vento | 1.280–1.820 m | velocidade, portões e salto natural mais alto |
| Salto do sol | 1.820–3.000 m | escalada de obstáculos, corredor final e rampa clímax |

Malha visual, altura lógica, rampas e obstáculos usam os mesmos metros de progresso. A validação testa comprimento, inclinação, margens e recepções. Decoração procedimental recebe seed fixa e ocupa preferencialmente as bordas.

## Protocolo de playtest

### Hipóteses prioritárias

1. A prancha parece rápida sem parecer solta.
2. O jogador entende direção, tuck e ollie em até 30 segundos.
3. Pousos falhos são atribuídos ao alinhamento, não a regra invisível.
4. A segunda tentativa muda linha ou estratégia de combo.
5. DualSense e rumble parecem parte da neve e não somente equivalentes ao teclado.

### Roteiro

1. Entregar o controle sem explicar além de “termine a descida”.
2. Observar tempo até primeiro input, ollie e manobra.
3. Não corrigir erro durante a primeira tentativa.
4. Após o resultado, perguntar onde havia uma linha alternativa e por que cada queda aconteceu.
5. Pedir segunda tentativa com objetivo escolhido pelo jogador: tempo ou pontos.

### Registrar

- navegador, conexão USB/Bluetooth e ID reportado;
- tempo até primeiro salto;
- colisões por setor e causa percebida;
- velocidade média/máxima;
- manobras tentadas, aceitas e pousos perdidos;
- maior combo, near misses, reinícios e abandono;
- desconexão, drift, prompts incorretos ou vibração desconfortável.

### Aprovar quando

- 4 de 5 jogadores concluem após até duas tentativas;
- 4 de 5 explicam corretamente ao menos 80% das próprias quedas;
- ninguém fica preso ou perde controle após respawn;
- ao menos 3 escolhem repetir espontaneamente para melhorar um resultado;
- o fluxo inteiro funciona sem teclado/mouse em duas combinações navegador/conexão suportadas.

## Cortes preservando o núcleo

Se houver regressão de prazo ou performance, cortar nesta ordem: partículas secundárias, variação decorativa, outline distante, segundo nível de sombra e métricas avançadas. Preservar sensação da prancha, leitura da pista, salto/pouso, DualSense, câmera e replay rápido.
