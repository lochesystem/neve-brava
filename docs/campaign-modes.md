# Campanha e Arcade

- Campanha: Novo jogo reinicia a sequência, preservando recordes e pistas já liberadas no Arcade. Continuar recupera a etapa e o piloto. Pódio na corrida atual avança uma etapa; quarto lugar exige nova tentativa, mesmo que exista recorde anterior.
- Arcade: escolhe pistas liberadas; não altera a campanha.
- Save local: `neve-brava.campaign.v1`, com migração dos resultados antigos. Não há sincronização de progresso online.
- `?dev=1&campaign-test=1`: libera todas as pistas para testes e não persiste alterações.

## Panorama do Cânion Ferrugem

Gerado com a ferramenta integrada de geração de imagens (não CLI). Arquivo: `public/images/scenery/canion-ferrugem-v1.png`, 1774 × 887, proporção 2:1. Usa o mesmo renderizador de panorama fixo das demais pistas.

Prompt:

> Use case: stylized-concept. Asset type: 2:1 equirectangular 360-degree panorama sky texture for a stylized cartoon snowboarding game desert canyon track. Generate a single 2048x1024 image. Rust red sandstone mesas and distant layered canyon ridges encircle the horizon, warm golden late afternoon light, dusty ochre lower horizon and muted turquoise blue upper sky with a few soft painted clouds. Beautiful polished hand-painted game environment, atmospheric perspective and detailed rock strata, not flat geometric triangles. Horizon at vertical center, upper half mostly open sky, bottom half distant sandy basin. Distant landscape only, no near foreground objects, no roads, no bridge, no snow, no characters, no text or logos. Left and right edges should join seamlessly, restrained contrast and warm orange haze matching a desert racing course. Actual skybox artwork not a screenshot or UI mockup.
