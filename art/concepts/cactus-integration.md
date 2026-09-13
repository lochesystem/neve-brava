# Cacto — integração

- Modelo original preservado em `public/models/cactus.glb`.
- Rig próprio em `src/experiments/cactusGrabRig.ts`; animação é preparada e reutilizada pelo mesmo sistema dos outros pilotos.
- Tronco/crista estáveis, ilhas da prancha e botas rígidas, pesos contínuos nos ombros e pernas. Laboratório: `/grab-lab.html?character=cactus`.
- Personagem secreto solo: terminar Cânion Ferrugem no pódio na campanha libera o Cacto permanentemente no save local. Novo jogo mantém esse desbloqueio.
- `?dev=1&campaign-test=1` permite testar todos os pilotos sem salvar progresso.
- Especial e voz ainda não definidos; slot de especial fica oculto. Multiplayer continua com os quatro pilotos existentes.

## Arte do minimapa

Ferramenta: ImageGen integrada (skill imagegen). Referência: `cactus-rider-v5-forward.png`. Resultado: `public/images/minimap/cactus.png`.

Prompt final:

Use case: stylized-concept. Generate ONE square game minimap avatar of the reference cactus character, HEAD ONLY. Reference is identity reference: green ribbed cactus, amber brown eyes, thick green angled eyebrows, confident sly smile, three tan large crest spines. Redraw a compact front-facing head with large readable facial features suitable for a 32px game icon, not a crop of full-body image. Head fills almost entire square with slight margin for crest. Stylized polished 3D cartoon game render matching reference. Transparent background with real alpha. No torso, vest, arms, legs, board, circle, border, letters, watermark. Preserve character identity.
