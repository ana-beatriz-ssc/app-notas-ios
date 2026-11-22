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
      text: 'Suas anotações do seu jeito: <b>escritas à mão</b> com caneta ou dedo, ou <b>digitadas</b>. Tudo fica salvo no aparelho e funciona sem internet.',
    },
    {
      art: art.pen,
      title: 'Escreva à mão',
      text: 'Toque no <b>lápis</b> e escolha <b>Nota manuscrita</b>. Use caneta, marca-texto e borracha, escolha cores e espessuras. Com o Apple Pencil, a força do traço muda a espessura, e a palma da mão é ignorada.',
    },
    {
      art: art.zoom,
      title: 'Folhas e zoom',
      text: 'Escolha a folha: lisa, pautada, caderno, quadriculada, pontilhada ou Cornell. <b>Pince com dois dedos</b> para aproximar ou afastar e arraste com dois dedos para mover.',
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
          <li><b>Nova nota:</b> toque no lápis no canto inferior e escolha <i>manuscrita</i> ou <i>digitada</i>.</li>
          <li><b>Título:</b> nas digitadas, a primeira linha vira o título. Nas manuscritas, toque no título acima da folha para renomear.</li>
          <li><b>Fixar:</b> o ícone de alfinete deixa a nota no topo da lista.</li>
          <li><b>Buscar:</b> procura no texto e nos títulos, sem precisar de acentos.</li>
          <li><b>Apagar:</b> ícone de lixeira. Não dá para desfazer.</li>
          <li>Notas deixadas em branco somem sozinhas ao voltar para a lista.</li>
        </ul>`,
    },
    {
      id: 'ink',
      title: 'Escrever à mão',
      html: `
        <ul>
          <li><b>Caneta:</b> traço que fica mais grosso quanto mais força você faz com o Apple Pencil.</li>
          <li><b>Marca-texto:</b> traço largo e transparente, para destacar.</li>
          <li><b>Borracha:</b> passe por cima de um traço para apagá-lo inteiro.</li>
          <li><b>Cor e espessura:</b> toque na bolinha colorida e na bolinha de tamanho da barra de ferramentas.</li>
          <li><b>Desfazer / refazer:</b> setas no topo da tela.</li>
        </ul>
        <h4>Caneta x dedo</h4>
        <p>No começo, o dedo escreve. Assim que você usa o Apple Pencil, o app passa a usar <b>o dedo para mover a folha</b> e só a caneta escreve, o que evita riscos da palma da mão. Para mudar, use o botão de <b>mão</b> na barra de ferramentas ou <b>•••</b> → <b>Temas e aparência</b>.</p>
        <p>Com dois dedos você sempre move e dá zoom, mesmo quando o dedo está escrevendo.</p>`,
    },
    {
      id: 'pages',
      title: 'Folhas e páginas',
      html: `
        <ul>
          <li>Toque no ícone de <b>folha</b> no topo para escolher: lisa, pautada, caderno, quadriculada, pontilhada ou Cornell (manuscritas).</li>
          <li>Nas manuscritas, a folha muda na página que está na tela. Ative <b>Aplicar a todas as páginas</b> para mudar tudo de uma vez.</li>
          <li>Para mais páginas, role até o fim e toque em <b>+ Nova página</b>.</li>
          <li>Nas digitadas, as linhas acompanham o texto conforme você escreve.</li>
        </ul>`,
    },
    {
      id: 'zoom',
      title: 'Zoom',
      html: `
        <ul>
          <li><b>Pince com dois dedos</b> para aproximar ou afastar. Funciona nas notas manuscritas e nas digitadas (o texto aumenta).</li>
          <li>Nas manuscritas, toque na <b>porcentagem</b> da barra para ver os botões − e +, ou para voltar ao tamanho da tela.</li>
          <li>Com teclado: <b>⌘ +</b>, <b>⌘ −</b> e <b>⌘ 0</b>. No notebook, também com <b>Ctrl + roda do mouse</b> ou pinça no trackpad.</li>
        </ul>`,
    },
    {
      id: 'themes',
      title: 'Temas e aparência',
      html: `
        <p>Em <b>•••</b> → <b>Temas e aparência</b> você escolhe entre Rosa (padrão), Rosa chá, Framboesa, Lavanda, Pêssego, Menta, Céu, Clássico e Grafite.</p>
        <p>Em <b>Aparência</b>: <b>Automático</b> segue o modo claro/escuro do aparelho, ou fixe em <b>Claro</b> ou <b>Escuro</b>. As folhas manuscritas continuam claras, como papel.</p>`,
    },
    {
      id: 'scribble',
      title: 'Escrever à mão e virar texto',
      html: `
        <p>Se quiser que sua letra vire texto digitado, crie uma <b>Nota digitada</b> e escreva nela com o Apple Pencil. Isso usa o recurso <b>Rabiscar</b> do iPad (Ajustes → Apple Pencil). Para guardar a letra como desenho, use a <b>Nota manuscrita</b>.</p>`,
    },
    {
      id: 'data',
      title: 'Seus dados e segurança',
      html: `
        <ul>
          <li>As notas ficam só no aparelho. Não vão para nenhum servidor.</li>
          <li><b>Atenção:</b> apagar o ícone do app da Tela de Início apaga as notas daquele aparelho. Exporte um backup antes.</li>
          <li>Faça backups de vez em quando (iCloud Drive é um bom lugar).</li>
        </ul>`,
    },
    {
      id: 'keys',
      title: 'Atalhos de teclado (iPad e notebook)',
      html: `
        <ul class="keys">
          <li><kbd>⌘ N</kbd> nova nota digitada</li>
          <li><kbd>⌘ ⇧ N</kbd> nova nota manuscrita</li>
          <li><kbd>⌘ F</kbd> buscar</li>
          <li><kbd>⌘ Z</kbd> / <kbd>⌘ ⇧ Z</kbd> desfazer / refazer (manuscritas)</li>
          <li><kbd>⌘ +</kbd> <kbd>⌘ −</kbd> <kbd>⌘ 0</kbd> zoom</li>
        </ul>`,
    },
  ];

  window.HelpContent = { ONBOARDING, HELP };
})();
