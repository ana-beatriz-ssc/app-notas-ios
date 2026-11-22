# Notas

App de notas para iPhone e iPad, com escrita à mão e texto digitado. É um PWA: instala pela Tela de Início, abre em tela cheia, funciona offline e guarda tudo no próprio aparelho.

**Acesse:** https://ana-beatriz-ssc.github.io/app-notas-ios/

## Recursos
- **Escrita à mão** com Apple Pencil ou dedo: pressão, marca-texto, borracha, desfazer/refazer, várias páginas e rejeição da palma
- **Notas digitadas**, com a primeira linha como título
- **Pastas** para organizar as notas
- **Tela cheia no iPad**, escondendo a lista de notas
- **Folhas**: lisa, pautada, caderno, quadriculada, pontilhada e Cornell
- **Zoom** por pinça, botões ou atalhos de teclado
- **9 temas** com modo claro, escuro ou automático
- Busca, notas fixadas, backup (exportar/importar), tutorial e ajuda

## Instalar
No iPhone ou iPad, abra o link acima **no Safari** → **Compartilhar** → **Adicionar à Tela de Início**.

## Privacidade
As notas ficam só no aparelho, sem servidor nem conta. Para passar notas de um aparelho para outro, use **•••** → **Exportar backup** e **Importar backup**.

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
| `ink.js` | Motor de escrita à mão |
| `themes.js` | Temas e preferências |
| `help.js` | Tutorial e ajuda |
| `sw.js` | Funcionamento offline |
