# Campanha — primeira expansão

Seis pistas em três capítulos. Pé da montanha: Vale Bravo e Cânion Cristal.
Além da floresta: Bosque Torto, Passagem da Geleira e Cânion Ferrugem. Coroa da montanha: Pico Tempestade (final).

É preciso terminar entre os três primeiros para abrir a próxima etapa. O navegador salva
melhor posição e melhor tempo separadamente em `neve-brava.campaign.v1`.
Não há sincronização de save entre aparelhos. Multiplayer não consulta os desbloqueios.
O personagem escolhido é preservado entre etapas.

## Pista piloto

Passagem da Geleira tem 3,3 km por volta, túnel entre 470–730 m, bifurcação entre
910–1230 m e quatro saltos esculpidos na neve. A esquerda é estreita, com um tronco
para pular; a direita contorna uma elevação e exige desviar dos cristais. No trecho
de bifurcação, as linhas de referência têm aproximadamente 353 m (atalho) e 409 m
(principal), dando cerca de 1,4 segundo de diferença a 40 m/s sem obstáculos. Ambas reencontram a pista
sem teletransporte ou bônus artificial de posição. O ganho do atalho depende da execução.
O divisor tem colisão lateral; não é uma rede arbitrária de caminhos independentes.

O túnel tem seção arqueada com casca externa de gelo e teto físico variável por posição lateral.
Não há placas de aviso de salto, túnel ou atalho. As paredes e teto são geometria opaca simples; as rampas usam a própria malha do solo,
sem GLB de madeira. As regras físicas são compartilhadas pelos jogadores e bots do servidor.
A maquete e minimapa mostram a bifurcação. O panorama reutiliza o do Cânion.

## Teste

### Final: Pico Tempestade

A etapa 06 mantém os 3,6 km e o desbloqueio já existentes, mas agora tem galeria
violeta arqueada entre 800–1120 m (14 m de altura), quatro saltos naturais nos
marcadores 540, 1270, 2140 e 3280 m, com alturas de 4, 6, 7 e 8 m.
Três arcos de gelo com coroas douradas marcam o trecho final em 2890, 3060 e 3500 m.
Seus suportes ficam fora da pista; não são novos obstáculos invisíveis.
Os testes verificam aterrissagens alinhadas a 18, 40 e 58 m/s, além da suíte dos bots.
O panorama noturno é preservado. Validação online permanece para uma etapa posterior.

### Cânion

Cânion Ferrugem tem 3,5 km nominais por volta: areia, formações de arenito,
rochas e quatro rampas naturais. Não usa pinheiros, panorama nevado nem neve caindo.
Entre 1120–1740 m, a rota principal faz um S sobre uma ponte de madeira e cordas;
a esquerda segue pelo leito seco, mais estreito e curto, passando por baixo.
A altura é dependente da rota para jogadores e bots. O teto sob a ponte também
limita saltos e câmera. A estrutura usa geometria estática e postes instanciados.
Os testes verificam cruzamento, altura livre, vantagem de distância e conclusão dos bots.
As bifurcações mantêm a linha central na rota principal, com entrada lateral à esquerda
no atalho. No cânion, a ponte tem 24 m de largura e a passagem inferior 14 m.
O tablado não recebe rastros. Não são geradas pedras decorativas sobre as bordas sem
solo; os paredões do trecho da ponte são apoiados no fundo do leito seco.
A borda do atalho se conecta ao leito por uma encosta contínua. Rochas e pilares
preenchem a vista inferior, sem invadir a faixa jogável. Caixas nas bifurcações
usam contato no espaço 3D projetado no chão e validação de altura/ramo, compartilhados
entre jogador e bots; o cruzamento de um único marcador longitudinal não descarta o contato.
O solo inferior usa uma malha indexada com gradiente de cor e declive suave (6 m
ao longo de 140 m), independente da altura da ponte. A distribuição de pedras é
determinística, em grupos irregulares desde 8 m para fora da borda, sem fileiras.

Abra `?dev=1&campaign-test=1`, entre em Campanha e escolha Passagem da Geleira.
Este modo libera todas as etapas e NÃO grava resultados da campanha. Sem a flag,
o fluxo normal exige pódio e salva progresso. O botão de próxima etapa preserva o piloto.

## Onde ajustar

- `src/core/campaign.ts`: capítulos, sequência e progressão.
- `src/core/course.ts`: pista, túnel, divisor, obstáculos e altura/comprimento/impulso dos saltos.
- `src/view/courseStructures.ts`: visual das estruturas e placas.
- `src/view/desertScenery.ts`: ponte, leito seco, formações rochosas e construções do cânion.

Esta entrega é a base e uma pista piloto. Mais pistas e ramificações complexas ficam
para expansão após validar a jogabilidade desta primeira versão.
