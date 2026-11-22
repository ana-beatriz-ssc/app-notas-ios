# Notas

App de notas para iPhone e iPad em que cada nota mistura texto digitado, desenhos e arquivos. É um PWA: instala pela Tela de Início, abre em tela cheia, funciona offline e guarda tudo no próprio aparelho.

**Acesse:** https://ana-beatriz-ssc.github.io/app-notas-ios/

## Recursos
- **Notas mistas**: digite e, onde quiser, insira desenhos, fotos e arquivos
- **Desenho** com Apple Pencil ou dedo: pressão, marca-texto, borracha, desfazer/refazer e rejeição da palma
- **Desenho em tela cheia** com zoom por pinça
- **Anexos** de qualquer tipo, que abrem no app certo do aparelho
- **Exportar a nota** em PDF, imagem (PNG), texto (.txt) ou Markdown (.md)
- **Pastas** para organizar as notas
- **Tela cheia no iPad**, escondendo a lista de notas
- **Folhas**: lisa, pautada, caderno, quadriculada, pontilhada e Cornell
- **9 temas** com modo claro, escuro ou automático
- Busca, notas fixadas, backup com anexos (exportar/importar), tutorial e ajuda

## Instalar
No iPhone ou iPad, abra o link acima **no Safari** → **Compartilhar** → **Adicionar à Tela de Início**.

## Privacidade
As notas e os anexos ficam só no aparelho, sem servidor nem conta. Para passar notas de um aparelho para outro, use **•••** → **Exportar backup** e **Importar backup**.

> Apagar o ícone da Tela de Início apaga as notas daquele aparelho. Faça backup antes.

## Desenvolvimento
Feito com HTML, CSS e JavaScript puros, sem dependências.

```
python -m http.server 8000
```

Abra `http://localhost:8000`. Ao publicar uma nova versão, aumente `VERSION` em `sw.js`.

| Arquivo | Função |
| --- | --- |
| `index.html` | Estrutura das telas |
| `styles.css` | Visual |
| `app.js` | Lista, editor, painéis e backup |
| `doc.js` | Editor da nota em blocos (texto, desenhos e anexos) |
| `ink.js` | Motor de desenho |
| `export.js` | Exportar em PDF, PNG, TXT e Markdown |
| `themes.js` | Temas e preferências |
| `help.js` | Tutorial e ajuda |
| `sw.js` | Funcionamento offline |
