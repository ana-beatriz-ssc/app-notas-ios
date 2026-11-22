# Notas: app para iPhone e iPad (sem precisar de Mac)

É um **PWA**: um app web que o iOS instala na Tela de Início. Abre em tela cheia,
funciona sem internet e guarda as notas no próprio aparelho.

## O que tem (versão 2)
- **Notas manuscritas**: escreva com Apple Pencil ou dedo. A letra fica como você escreveu, sem virar texto.
  - Caneta que responde à pressão, marca-texto e borracha
  - 12 cores de caneta, 6 de marca-texto, 3 espessuras
  - Desfazer e refazer, várias páginas, rejeição da palma da mão
- **Notas digitadas**: a primeira linha vira o título. Com o Apple Pencil, dá para usar o Rabiscar.
- **Folhas**: lisa, pautada, caderno, quadriculada, pontilhada e Cornell (esta só nas manuscritas)
- **Zoom**: pinça com dois dedos, botões −/+, ⌘+/⌘−, Ctrl + roda do mouse
- **Temas**: Rosa (padrão), Rosa chá, Framboesa, Lavanda, Pêssego, Menta, Céu, Clássico e Grafite,
  com aparência automática, clara ou escura
- **Tutorial** no primeiro uso e **Ajuda (?)** com passo a passo, principalmente de como sincronizar os aparelhos
- Busca, notas fixadas e backup (exportar/importar)

## Como colocar no iPhone e no iPad (GitHub Pages)
1. Crie um repositório no GitHub e envie estes arquivos para a branch `main`.
   **Escolha o nome do repositório de vez**: ele faz parte do endereço, e mudar depois obriga a reinstalar o app.
2. No repositório: **Settings** → **Pages** → em *Source*, escolha **Deploy from a branch** → `main` / `(root)` → **Save**.
3. Depois de 1 a 2 minutos, o endereço aparece ali, algo como `https://seu-usuario.github.io/nome-do-repo/`.
4. No iPhone/iPad, abra o endereço **no Safari** → **Compartilhar** → **Adicionar à Tela de Início**.
5. Use sempre **pelo ícone**.

As notas **não** vão para o GitHub: ficam só no aparelho. O repositório público mostra apenas o código do app.
Nunca envie para o repositório um arquivo `notas-backup-*.json` (o `.gitignore` já bloqueia esse nome).

## Como atualizar (quando já estiver publicado)
1. Em `sw.js`, aumente a versão, por exemplo de `'v3'` para `'v4'`.
2. Envie os arquivos alterados para a branch `main` (o GitHub Pages publica sozinho em 1 a 2 minutos).
3. No aparelho, abra o app, feche e abra de novo para carregar a versão nova.

## Sincronizar iPhone e iPad
Cada aparelho guarda as próprias notas. Para passar de um para o outro: **•••** → **Exportar backup** →
AirDrop (ou Salvar em Arquivos → iCloud Drive). No outro aparelho: **•••** → **Importar backup**.
Fica a versão mais recente de cada nota, e importar de novo não duplica nada. O passo a passo completo está no **?** dentro do app.

⚠️ Apagar o ícone da Tela de Início apaga as notas daquele aparelho. Faça backup antes.

## Testar no notebook
Na pasta, rode `python -m http.server 8000` e abra `http://localhost:8000`.
No Chrome, F12 → ícone de celular simula iPhone e iPad. O mouse funciona como caneta.

## Arquivos
- `index.html`: estrutura das telas
- `styles.css`: visual
- `themes.js`: temas e preferências
- `ink.js`: motor da escrita à mão (traços, folhas, zoom, páginas)
- `help.js`: textos do tutorial e da ajuda
- `app.js`: lista, editor, painéis, backup
- `sw.js`: funcionamento offline
- `manifest.webmanifest` e `icons/`: nome e ícone do app
