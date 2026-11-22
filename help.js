'use strict';
/* Conteúdo do tutorial de boas-vindas e da Central de Ajuda (?) */
(function () {
  const art = {
    welcome: `<svg viewBox="0 0 200 150" class="art" aria-hidden="true">
      <rect x="45" y="12" width="110" height="128" rx="12" fill="var(--paper)" stroke="var(--text-line)" stroke-width="2"/>
      <g stroke="var(--text-line)" stroke-width="2">
        <line x1="60" y1="48" x2="140" y2="48"/><line x1="60" y1="66" x2="140" y2="66"/>
        <line x1="60" y1="84" x2="140" y2="84"/><line x1="60" y1="102" x2="140" y2="102"/>
        <line x1="60" y1="120" x2="120" y2="120"/>
      </g>
      <path d="M62 44c8-14 14-14 16 0s8 14 14 0 10-12 14 0 8 8 14-2" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M62 80c10-6 22-8 34-2" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" opacity=".6"/>
    </svg>`,
    pen: `<svg viewBox="0 0 200 150" class="art" aria-hidden="true">
      <rect x="30" y="18" width="120" height="118" rx="10" fill="var(--paper)" stroke="var(--text-line)" stroke-width="2"/>
      <path d="M48 60c10-20 18-20 20-2s10 18 18 0 12-16 18 0" fill="none" stroke="#1c1c1e" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="46" y="84" width="74" height="14" rx="7" fill="var(--accent)" opacity=".35"/>
      <path d="M50 92h66" stroke="#1c1c1e" stroke-width="3" stroke-linecap="round"/>
      <g transform="rotate(40 150 80)">
        <rect x="140" y="20" width="16" height="96" rx="8" fill="var(--card)" stroke="var(--muted)" stroke-width="2"/>
        <path d="M140 116l8 18 8-18z" fill="var(--accent)"/>
      </g>
    </svg>`,
    zoom: `<svg viewBox="0 0 200 150" class="art" aria-hidden="true">
      <rect x="40" y="16" width="120" height="120" rx="10" fill="var(--paper)" stroke="var(--text-line)" stroke-width="2"/>
      <g stroke="var(--text-line)" stroke-width="2"><line x1="40" y1="56" x2="160" y2="56"/><line x1="40" y1="86" x2="160" y2="86"/><line x1="40" y1="116" x2="160" y2="116"/></g>
      <circle cx="76" cy="96" r="13" fill="var(--accent)" opacity=".85"/>
      <circle cx="124" cy="58" r="13" fill="var(--accent)" opacity=".85"/>
      <path d="M66 106l-16 16M134 48l16-16" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>
      <path d="M44 114l6 8 8-6M156 40l-6-8-8 6" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    sync: `<svg viewBox="0 0 200 150" class="art" aria-hidden="true">
      <rect x="18" y="30" width="58" height="96" rx="12" fill="var(--card)" stroke="var(--muted)" stroke-width="2.5"/>
      <rect x="104" y="20" width="82" height="112" rx="10" fill="var(--card)" stroke="var(--muted)" stroke-width="2.5"/>
      <g stroke="var(--text-line)" stroke-width="2"><line x1="28" y1="56" x2="66" y2="56"/><line x1="28" y1="70" x2="66" y2="70"/><line x1="114" y1="50" x2="176" y2="50"/><line x1="114" y1="66" x2="176" y2="66"/><line x1="114" y1="82" x2="176" y2="82"/></g>
      <path d="M84 62h14m-5-6 6 6-6 6M100 92H86m5-6-6 6 6 6" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    themes: `<svg viewBox="0 0 200 110" class="art small" aria-hidden="true">
      <circle cx="40" cy="55" r="20" fill="#d94f86"/><circle cx="80" cy="55" r="20" fill="#8a63d2"/>
      <circle cx="120" cy="55" r="20" fill="#23977b"/><circle cx="160" cy="55" r="20" fill="#2f74d0"/>
    </svg>`,
  };

  const ONBOARDING = [
    {
      art: art.welcome,
      title: 'Boas-vindas ao Notas',
      text: 'Numa mesma nota você <b>digita</b>, <b>desenha</b> com a caneta ou o dedo e <b>anexa arquivos</b>. Tudo fica salvo no aparelho e funciona sem internet.',
    },
    {
      art: art.pen,
      title: 'Digite, desenhe e anexe',
      text: 'Toque no <b>lápis</b> para criar uma nota e comece a digitar. Para desenhar ou anexar, toque no <b>⊕</b> no alto e escolha <b>Desenho</b>, <b>Foto</b> ou <b>Arquivo</b>. Ele entra onde está o cursor.',
    },
    {
      art: art.zoom,
      title: 'Desenhos com zoom',
      text: 'Use caneta, marca-texto e borracha. Com o Apple Pencil, a força muda a espessura e a palma da mão é ignorada. Toque em <b>⤢</b> no canto do desenho para abri-lo em tela cheia e <b>pinçar</b> para dar zoom.',
    },
    {
      art: art.themes,
      title: 'Escolha suas cores',
      text: 'O tema padrão é rosa, mas você pode trocar quando quiser em <b>•••</b> → <b>Temas e aparência</b>. Experimente:',
      slot: 'themes',
    },
    {
      art: art.sync,
      title: 'Leve suas notas para outro aparelho',
      text: 'Cada aparelho guarda as próprias notas. Para passar do iPhone para o iPad (ou o contrário), use <b>Exportar backup</b> e <b>Importar backup</b>. O passo a passo está no botão <b>?</b>.',
    },
  ];

  const HELP = [
    {
      id: 'sync',
      title: 'Sincronizar entre iPhone e iPad',
      open: true,
      html: `
        <p class="callout">As notas ficam guardadas <b>dentro de cada aparelho</b>. iPhone e iPad <b>não se atualizam sozinhos</b>: você leva as notas de um para o outro com um arquivo de backup.</p>
        <h4>Jeito mais rápido: AirDrop</h4>
        <ol>
          <li>No aparelho que tem as notas novas, toque em <b>•••</b> → <b>Exportar backup</b>.</li>
          <li>Na tela de compartilhar, toque em <b>AirDrop</b> e escolha o outro aparelho.</li>
          <li>No outro aparelho, aceite o arquivo. Ele fica no app <b>Arquivos</b>, normalmente na pasta <b>Downloads</b>.</li>
          <li>Abra o Notas nesse aparelho, toque em <b>•••</b> → <b>Importar backup</b> e escolha o arquivo <i>notas-backup-…json</i>.</li>
        </ol>
        <h4>Jeito mais organizado: iCloud Drive</h4>
        <ol>
          <li>Em <b>Exportar backup</b>, escolha <b>Salvar em Arquivos</b> → <b>iCloud Drive</b> e crie uma pasta, por exemplo <i>Backup Notas</i>.</li>
          <li>No outro aparelho (com o mesmo ID Apple), use <b>Importar backup</b> e abra o arquivo mais recente dessa pasta.</li>
        </ol>
        <p>Também funciona enviando o arquivo para você mesmo por e-mail ou WhatsApp e abrindo-o no outro aparelho.</p>
        <h4>Como a importação junta as notas</h4>
        <ul>
          <li>Notas que só existem no backup são <b>adicionadas</b>.</li>
          <li>Se a mesma nota existe nos dois lugares, fica a <b>versão editada por último</b>.</li>
          <li>Importar o mesmo arquivo de novo <b>não cria cópias</b>.</li>
          <li>Apagar uma nota <b>não</b> apaga no outro aparelho. Se ela estiver num backup antigo, volta ao importar. Apague nos dois.</li>
        </ul>
        <h4>Dica para não se perder</h4>
        <p>Escolha um aparelho como <b>principal</b>. Ao terminar de escrever no outro, exporte e importe no principal. Se você editar a mesma nota nos dois antes de sincronizar, só a versão mais recente é mantida.</p>`,
    },
    {
      id: 'install',
      title: 'Instalar na Tela de Início',
      html: `
        <ol>
          <li>Abra o endereço do app no <b>Safari</b>.</li>
          <li>Toque em <b>Compartilhar</b> (quadrado com seta para cima).</li>
          <li>Escolha <b>Adicionar à Tela de Início</b> → <b>Adicionar</b>.</li>
        </ol>
        <p>Use sempre <b>pelo ícone</b>: a aba do Safari e o app instalado guardam notas separadas.</p>`,
    },
    {
      id: 'notes',
      title: 'Criar, fixar, buscar e apagar',
      html: `
        <ul>
          <li><b>Nova nota:</b> toque no lápis no canto inferior e comece a digitar.</li>
          <li><b>Título:</b> a primeira linha de texto vira o título.</li>
          <li><b>Fixar:</b> o alfinete deixa a nota no topo da lista (no iPhone, fica em <b>•••</b>).</li>
          <li><b>Buscar:</b> procura no texto e no nome dos anexos, sem precisar de acentos.</li>
          <li><b>Apagar:</b> ícone de lixeira (no iPhone, em <b>•••</b>). Não dá para desfazer.</li>
          <li>Notas deixadas em branco somem sozinhas ao voltar para a lista.</li>
        </ul>`,
    },
    {
      id: 'folders',
      title: 'Pastas',
      html: `
        <ul>
          <li><b>Criar:</b> na lista, toque em <b>+ Pasta</b>, ao lado das pastas, embaixo da busca.</li>
          <li><b>Abrir:</b> toque no nome da pasta. <b>Todas</b> mostra todas as notas.</li>
          <li><b>Nota nova</b> criada com uma pasta aberta já fica nela.</li>
          <li><b>Mover:</b> dentro da nota, toque no ícone de pasta no alto da tela.</li>
          <li><b>Renomear ou apagar:</b> toque de novo na pasta que está aberta. Apagar a pasta não apaga as notas: elas continuam em <b>Todas</b>.</li>
          <li>O backup leva as pastas junto.</li>
        </ul>`,
    },
    {
      id: 'ink',
      title: 'Desenhar e escrever à mão',
      html: `
        <ul>
          <li><b>Inserir um desenho:</b> toque no <b>⊕</b> no alto → <b>Desenho</b>. O quadro entra onde está o cursor do texto.</li>
          <li><b>Caneta:</b> traço que fica mais grosso quanto mais força você faz com o Apple Pencil.</li>
          <li><b>Marca-texto:</b> traço largo e transparente, para destacar.</li>
          <li><b>Borracha:</b> passe por cima de um traço para apagá-lo inteiro.</li>
          <li><b>Cor e espessura:</b> toque na bolinha colorida e na bolinha de tamanho da barra de ferramentas.</li>
          <li><b>Desfazer / refazer:</b> setas no topo da tela.</li>
          <li><b>Tamanho do quadro:</b> arraste a alça embaixo dele. Ao escrever perto do fim, ele cresce sozinho.</li>
          <li><b>Apagar ou mudar o fundo:</b> toque em <b>•••</b> no canto do desenho.</li>
        </ul>
        <h4>Caneta x dedo</h4>
        <p>No começo, o dedo desenha. Assim que você usa o Apple Pencil, <b>o dedo passa a rolar a nota</b> e só a caneta desenha, o que evita riscos da palma da mão. Para mudar, use o botão de <b>mão</b> na barra de ferramentas ou <b>•••</b> → <b>Temas e aparência</b>.</p>`,
    },
    {
      id: 'zoom',
      title: 'Zoom e desenho em tela cheia',
      html: `
        <ul>
          <li>Toque em <b>⤢</b> no canto de um desenho para abri-lo em tela cheia. Lá você <b>pinça com dois dedos</b> para aproximar e arrasta com dois dedos para mover. Toque em <b>Concluído</b> para voltar.</li>
          <li>No desenho ampliado, a <b>porcentagem</b> na barra mostra os botões − e + e o <b>Ajustar à tela</b>.</li>
          <li><b>Pince sobre o texto</b> para aumentar ou diminuir as letras.</li>
          <li>Com teclado: <b>⌘ +</b>, <b>⌘ −</b> e <b>⌘ 0</b>. No notebook, também com <b>Ctrl + roda do mouse</b> ou pinça no trackpad.</li>
        </ul>`,
    },
    {
      id: 'pages',
      title: 'Folha: linhas e fundo',
      html: `
        <ul>
          <li>Toque no ícone de <b>folha</b> no topo (no iPhone, <b>•••</b> → <b>Folha</b>) para escolher as linhas do texto: lisa, pautada, caderno, quadriculada ou pontilhada.</li>
          <li>Ali também dá para mudar o fundo de todos os desenhos da nota (inclui o modelo Cornell) e o tamanho do texto.</li>
          <li>Para mudar o fundo de um desenho só, toque em <b>•••</b> no canto dele → <b>Fundo do Desenho</b>.</li>
        </ul>`,
    },
    {
      id: 'files',
      title: 'Anexar arquivos e fotos',
      html: `
        <ul>
          <li>Toque no <b>⊕</b> no alto → <b>Foto ou vídeo</b> (da galeria ou da câmera) ou <b>Arquivo</b> (do app Arquivos, iCloud Drive etc.). Dá para escolher vários de uma vez.</li>
          <li>Qualquer tipo de arquivo serve: PDF, Word, planilha, áudio… até 200 MB cada.</li>
          <li>Toque no anexo para <b>abrir ou compartilhar</b> (ele abre no app certo do aparelho), renomear ou remover. Fotos também podem ser vistas em tela cheia.</li>
          <li>No iPad e no computador, também dá para <b>colar</b> uma imagem ou <b>arrastar</b> arquivos para dentro da nota.</li>
          <li>Os anexos ficam guardados no aparelho e vão junto no backup. Arquivos grandes deixam o backup grande.</li>
        </ul>`,
    },
    {
      id: 'export',
      title: 'Exportar uma nota (PDF, imagem, texto)',
      html: `
        <p>Dentro da nota, toque no ícone de <b>compartilhar</b> no alto e escolha:</p>
        <ul>
          <li><b>PDF:</b> a nota inteira, com texto, desenhos e fotos, em folhas A4. Bom para imprimir ou mandar.</li>
          <li><b>Imagem (PNG):</b> uma imagem por folha, boa para o WhatsApp.</li>
          <li><b>Texto (.txt)</b> ou <b>Markdown (.md):</b> só o texto digitado. Desenhos e anexos aparecem como uma indicação.</li>
        </ul>
        <p>Isso exporta <b>uma nota</b> para outras pessoas ou apps. Para levar <b>todas</b> as notas para outro aparelho, use o <b>backup</b>.</p>`,
    },
    {
      id: 'themes',
      title: 'Temas e aparência',
      html: `
        <p>Em <b>•••</b> → <b>Temas e aparência</b> você escolhe entre Rosa (padrão), Rosa chá, Framboesa, Lavanda, Pêssego, Menta, Céu, Clássico e Grafite.</p>
        <p>Em <b>Aparência</b>: <b>Automático</b> segue o modo claro/escuro do aparelho, ou fixe em <b>Claro</b> ou <b>Escuro</b>.</p>
        <h4>Cor da folha e das linhas</h4>
        <p>Ali mesmo (ou no ícone de <b>folha</b> dentro da nota) você escolhe a <b>cor da folha dos desenhos</b>: Automático (clara no modo claro, escura no modo escuro), Branco, Creme, Tom do tema, Cinza, Grafite, Preto, Azul-noite ou Verde-lousa. Também escolhe a <b>cor das linhas</b>, que vale para os desenhos e para o texto.</p>
        <p>Na folha escura, a caneta preta aparece <b>branca</b> (e volta a ser preta se você trocar para uma folha clara). As exportações em PDF e imagem usam a folha escolhida.</p>`,
    },
    {
      id: 'scribble',
      title: 'Escrever à mão e virar texto',
      html: `
        <p>Se você escrever com o Apple Pencil <b>sobre o texto</b> (fora dos desenhos), o iPad transforma sua letra em texto digitado. É o recurso <b>Rabiscar</b> (Ajustes → Apple Pencil). Para guardar a letra como desenho, escreva dentro de um <b>quadro de desenho</b>.</p>`,
    },
    {
      id: 'data',
      title: 'Seus dados e segurança',
      html: `
        <ul>
          <li>As notas e os anexos ficam só no aparelho. Não vão para nenhum servidor.</li>
          <li><b>Atenção:</b> apagar o ícone do app da Tela de Início apaga as notas daquele aparelho. Exporte um backup antes.</li>
          <li>Faça backups de vez em quando (iCloud Drive é um bom lugar).</li>
        </ul>`,
    },
    {
      id: 'keys',
      title: 'Atalhos de teclado (iPad e notebook)',
      html: `
        <ul class="keys">
          <li><kbd>⌘ N</kbd> nova nota</li>
          <li><kbd>⌘ ⇧ N</kbd> nova nota já com um desenho</li>
          <li><kbd>⌘ F</kbd> buscar</li>
          <li><kbd>⌘ \</kbd> esconder ou mostrar a lista (iPad)</li>
          <li><kbd>⌘ Z</kbd> / <kbd>⌘ ⇧ Z</kbd> desfazer / refazer (desenhos, fora do texto)</li>
          <li><kbd>⌘ +</kbd> <kbd>⌘ −</kbd> <kbd>⌘ 0</kbd> zoom</li>
        </ul>`,
    },
  ];

  window.HelpContent = { ONBOARDING, HELP };
})();
