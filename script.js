// ============================================
// CONFIGURAÇÕES E CONSTANTES
// ============================================
// Configurações do Google Sheets
const SHEET_ID = '1We0xDOamU_iIGNcm_YxZ8jbBGNWK1PIyljgDb9xWf84';
const API_KEY = 'AIzaSyCShYO-EV8ZcjuOFuYedULIrfcwOgbcwsU';
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbysRomAyxbYAgrqdqqURTTAbwnGFiv9VXD_x11nzwdYbwmKMySmReWH9MBNcR3aeX9S/exec';

// URLs da API
const PRODUTOS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Produtos?key=${API_KEY}`;
const UNIDADES_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Unidades?key=${API_KEY}`;
const MOVIMENTACOES_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Movimentações?key=${API_KEY}`;
const RECEBIMENTOS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Recebimentos?key=${API_KEY}`;
const ESTOQUE_GERAL_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Estoque Geral?key=${API_KEY}`;

// Variáveis globais
let produtos = [];
let unidades = [];
let movimentacoes = [];
let recebimentos = [];
let graficoEstoque = null;
let graficoStatus = null;
let graficoDestinos = null;
let graficoCategorias = null;
let unidadeAtual = null;

// Dados do Estoque Geral
let estoqueGeral = [];

// Categorias pré-definidas
let categorias = [
    { id: 1, nome: 'Insumos', tipo: 'Matéria Prima', descricao: 'Insumos para produção' },
    { id: 2, nome: 'Embalagem Papelão', tipo: 'Embalagem', descricao: 'Caixas de papelão' },
    { id: 3, nome: 'Embalagem Filme', tipo: 'Embalagem', descricao: 'Filme stretch e plástico' },
    { id: 4, nome: 'Embalagem Sacaria', tipo: 'Embalagem', descricao: 'Sacos e big bags' }
];

// Destinos para transferência
const destinos = [
    'Farinheira',
    'Doméstica',
    'Massas',
    'Biscoito',
    'Transferência MV'
];

// Tipos de embalagem
const tiposEmbalagem = ['UN', 'MALA', 'PCT', 'CX', 'FD', 'PLT'];

// ============================================
// VARIÁVEIS PARA MÚLTIPLOS PRODUTOS E VOLUMES
// ============================================
let contadorProdutosRecebimento = 0;
let contadorProdutosUnidade = 0;
let produtosRecebimentoData = {};
let produtosUnidadeData = {};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    carregarDados();
    setupEventListeners();
    preencherFiltros();
});

// Configurar event listeners
function setupEventListeners() {
    // Elementos que SEMPRE existem
    document.getElementById('menu-painel')?.addEventListener('click', () => mostrarView('painel'));
    document.getElementById('menu-produtos')?.addEventListener('click', () => mostrarView('produtos'));
    document.getElementById('menu-unidades')?.addEventListener('click', () => mostrarView('unidades'));
    document.getElementById('menu-scanner')?.addEventListener('click', () => mostrarView('scanner'));
    document.getElementById('menu-recebimentos')?.addEventListener('click', () => mostrarView('recebimentos'));
    document.getElementById('menu-movimentacoes')?.addEventListener('click', () => mostrarView('movimentacoes'));
    document.getElementById('menu-relatorios')?.addEventListener('click', () => mostrarView('relatorios'));
    document.getElementById('menu-categorias')?.addEventListener('click', () => mostrarView('categorias'));
    
    document.getElementById('salvar-produto')?.addEventListener('click', salvarProduto);
    document.getElementById('salvar-unidade')?.addEventListener('click', salvarUnidade);
    document.getElementById('salvar-categoria')?.addEventListener('click', salvarCategoria);
    document.getElementById('salvar-recebimento')?.addEventListener('click', salvarRecebimento);
    document.getElementById('salvar-unidade-multipla')?.addEventListener('click', salvarUnidadeMultipla);
    document.getElementById('salvar-recebimento-multiplo')?.addEventListener('click', salvarRecebimentoMultiplo);
    
    document.getElementById('search-produto')?.addEventListener('keyup', filtrarProdutos);
    document.getElementById('filtro-categoria-produto')?.addEventListener('change', filtrarProdutos);
    document.getElementById('filtro-embalagem-produto')?.addEventListener('change', filtrarProdutos);
    
    document.getElementById('filtro-produto-unidades')?.addEventListener('change', filtrarUnidades);
    document.getElementById('filtro-status-unidades')?.addEventListener('change', filtrarUnidades);
    document.getElementById('filtro-destino-unidades')?.addEventListener('change', filtrarUnidades);
    document.getElementById('filtro-embalagem-unidades')?.addEventListener('change', filtrarUnidades);
    
    document.getElementById('produto-tipo-embalagem')?.addEventListener('change', toggleCampoQtdEmbalagem);
    document.getElementById('unidade-sku')?.addEventListener('change', atualizarInfoEmbalagem);
    document.getElementById('unidade-volume')?.addEventListener('input', calcularQuantidadeAutomatica);
    document.getElementById('unidade-fora-padrao')?.addEventListener('change', toggleCampoQuantidadeReal);
    
    document.getElementById('recebimento-sku')?.addEventListener('change', atualizarInfoRecebimento);
    document.getElementById('recebimento-volume')?.addEventListener('input', calcularQuantidadeRecebimento);
    
    // Busca de produtos para múltiplos volumes (verificar se existem)
    const buscaUnidade = document.getElementById('busca-produto-unidade');
    if (buscaUnidade) buscaUnidade.addEventListener('keyup', filtrarProdutosUnidade);
    
    const buscaRecebimento = document.getElementById('busca-produto-recebimento-principal');
    if (buscaRecebimento) buscaRecebimento.addEventListener('keyup', filtrarProdutosRecebimentoPrincipal);
    
    // Event listener para o filtro de período
    const periodoFilter = document.getElementById('filtro-recebimento-periodo');
    if (periodoFilter) {
        periodoFilter.addEventListener('change', function() {
            const periodo = this.value;
            const containerInicio = document.getElementById('filtro-data-inicio-container');
            const containerFim = document.getElementById('filtro-data-fim-container');
            
            if (containerInicio && containerFim) {
                if (periodo === 'personalizado') {
                    containerInicio.style.display = 'block';
                    containerFim.style.display = 'block';
                } else {
                    containerInicio.style.display = 'none';
                    containerFim.style.display = 'none';
                }
            }
        });
    }
    
    // Event listeners para filtros do Estoque Geral
    const filtroSku = document.getElementById('filtro-estoque-sku');
    const filtroDescricao = document.getElementById('filtro-estoque-descricao');
    const filtroStatus = document.getElementById('filtro-estoque-status');
    const filtroUnidade = document.getElementById('filtro-estoque-unidade');
    
    if (filtroSku) filtroSku.addEventListener('keyup', filtrarEstoqueGeral);
    if (filtroDescricao) filtroDescricao.addEventListener('keyup', filtrarEstoqueGeral);
    if (filtroStatus) filtroStatus.addEventListener('change', filtrarEstoqueGeral);
    if (filtroUnidade) filtroUnidade.addEventListener('change', filtrarEstoqueGeral);
    
}

// Mostrar/esconder campo de quantidade por embalagem
function toggleCampoQtdEmbalagem() {
    const tipo = document.getElementById('produto-tipo-embalagem').value;
    const campoQtd = document.getElementById('campo-qtd-por-embalagem');
    const unidadeSpan = document.getElementById('unidade-embalagem');
    
    if (tipo && tipo !== 'UN') {
        campoQtd.style.display = 'block';
        unidadeSpan.textContent = tipo;
    } else {
        campoQtd.style.display = 'none';
        document.getElementById('produto-qtd-por-embalagem').value = 1;
    }
}

// Mostrar/esconder campo de quantidade real
function toggleCampoQuantidadeReal() {
    const campoReal = document.getElementById('campo-quantidade-real');
    campoReal.style.display = this.checked ? 'block' : 'none';
    
    if (!this.checked) {
        calcularQuantidadeAutomatica();
    }
}

// Calcular quantidade automática baseada no volume
function calcularQuantidadeAutomatica() {
    const sku = document.getElementById('unidade-sku').value;
    if (!sku) return;
    
    const produto = produtos.find(p => p.sku === sku);
    if (!produto) return;
    
    const volume = parseInt(document.getElementById('unidade-volume').value) || 1;
    const qtdPorEmbalagem = parseInt(produto.qtdPorEmbalagem) || 1;
    const foraPadrao = document.getElementById('unidade-fora-padrao').checked;
    
    if (!foraPadrao) {
        const quantidadeTotal = volume * qtdPorEmbalagem;
        document.getElementById('unidade-quantidade').value = quantidadeTotal;
    }
}

// Atualizar informações da embalagem e unidade base ao selecionar produto
function atualizarInfoEmbalagem() {
    const select = document.getElementById('unidade-sku');
    const selectedOption = select.options[select.selectedIndex];
    const tipoEmbalagem = selectedOption.dataset.tipo || 'UN';
    const qtdPorEmbalagem = parseInt(selectedOption.dataset.qtd) || 1;
    const sku = select.value;
    const produto = produtos.find(p => p.sku === sku);
    
    document.getElementById('volume-label').textContent = `Volume (${tipoEmbalagem})`;
    document.getElementById('volume-descricao').textContent = `Número de ${tipoEmbalagem}`;
    
    // Atualizar a unidade base no modal
    const unidadeBase = produto?.unidadeBase || 'UN';
    document.getElementById('quantidade-unidade').textContent = `(${unidadeBase})`;
    document.getElementById('quantidade-descricao').textContent = `Total em ${unidadeBase}`;
    
    calcularQuantidadeAutomatica();
}

// ============================================
// FUNÇÕES PARA MÚLTIPLOS PRODUTOS NO RECEBIMENTO
// ============================================

// Abrir modal de recebimento múltiplo
function abrirModalRecebimentoMultiplo() {
    // Resetar contadores
    contadorProdutosRecebimento = 0;
    produtosRecebimentoData = {};
    
    // Limpar container
    const container = document.getElementById('produtos-recebimento-container');
    if (container) container.innerHTML = '';
    
    // Adicionar primeiro produto
    adicionarProdutoRecebimento();
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('modalRecebimentoMultiplo'));
    modal.show();
}

// Adicionar novo produto ao recebimento
function adicionarProdutoRecebimento() {
    const produtoIndex = contadorProdutosRecebimento;
    const container = document.getElementById('produtos-recebimento-container');
    
    const divProduto = document.createElement('div');
    divProduto.className = 'produto-recebimento mb-4 p-3 border rounded';
    divProduto.id = `produto-recebimento-${produtoIndex}`;
    
    const deleteBtnDisplay = produtoIndex === 0 ? 'style="display: none;"' : '';
    
    divProduto.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="text-warning">
                <i class="bi bi-box"></i> Produto #${produtoIndex + 1}
            </h5>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="removerProdutoRecebimento(${produtoIndex})" ${deleteBtnDisplay}>
                <i class="bi bi-trash"></i> Remover Produto
            </button>
        </div>
        
        <!-- Dados do Produto -->
        <div class="row mb-3">
            <div class="col-md-6">
                <label class="form-label">Buscar Produto</label>
                <div class="d-flex">
                    <input type="text" class="form-control busca-produto-recebimento-principal" 
                           id="busca-produto-recebimento-${produtoIndex}" 
                           placeholder="Digite para buscar..." 
                           data-produto-index="${produtoIndex}">
                    <input type="hidden" class="produto-sku" id="produto-sku-${produtoIndex}">
                </div>
            </div>
            <div class="col-md-3">
                <label class="form-label">Tipo Embalagem</label>
                <input type="text" class="form-control produto-tipo-embalagem" id="produto-tipo-embalagem-${produtoIndex}" readonly>
            </div>
            <div class="col-md-3">
                <label class="form-label">Qtd Padrão por Embalagem</label>
                <input type="text" class="form-control produto-qtd-padrao" id="produto-qtd-padrao-${produtoIndex}" readonly>
            </div>
        </div>
        
        <!-- Lista de produtos para busca -->
        <div class="lista-produtos-recebimento-container" id="lista-produtos-recebimento-${produtoIndex}" 
             style="max-height: 200px; overflow-y: auto; border: 1px solid #2d3748; border-radius: 8px; background-color: #1e293b; display: none; margin-bottom: 15px;">
            <!-- Produtos serão inseridos aqui via JS -->
        </div>
        
        <!-- Volumes deste produto -->
        <div class="volumes-produto-container ms-4" id="volumes-produto-${produtoIndex}">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="text-info">
                    <i class="bi bi-layers"></i> Volumes
                </h6>
                <button type="button" class="btn btn-sm btn-success" onclick="adicionarVolumeProduto(${produtoIndex})">
                    <i class="bi bi-plus"></i> Adicionar Volume
                </button>
            </div>
        </div>
        
        <!-- Totais por produto -->
        <div class="row mt-2 text-end">
            <div class="col-md-12">
                <strong>Total deste produto:</strong> 
                <span class="produto-total-un" id="produto-total-un-${produtoIndex}" style="color: #fbbf24; font-weight: 700;">0</span> UN
            </div>
        </div>
    `;
    
    container.appendChild(divProduto);
    
    // Inicializar dados do produto
    if (!produtosRecebimentoData[produtoIndex]) {
        produtosRecebimentoData[produtoIndex] = {
            sku: '',
            nome: '',
            tipoEmbalagem: '',
            qtdPadrao: 0,
            volumes: {}
        };
    }
    
    // Adicionar primeiro volume para este produto
    produtosRecebimentoData[produtoIndex].volumes = {};
    adicionarVolumeProduto(produtoIndex);
    
    // Configurar busca de produto
    configurarBuscaProdutoRecebimentoMultiplo(produtoIndex);
    
    contadorProdutosRecebimento++;
    atualizarTotaisRecebimento();
}

// Remover produto do recebimento
function removerProdutoRecebimento(produtoIndex) {
    const produto = document.getElementById(`produto-recebimento-${produtoIndex}`);
    if (produto) {
        produto.remove();
        delete produtosRecebimentoData[produtoIndex];
        atualizarTotaisRecebimento();
        atualizarContagemProdutosRecebimento();
    }
}

// Adicionar volume a um produto
function adicionarVolumeProduto(produtoIndex) {
    if (!produtosRecebimentoData[produtoIndex]) {
        produtosRecebimentoData[produtoIndex] = { volumes: {} };
    }
    
    const volumesContainer = document.getElementById(`volumes-produto-${produtoIndex}`);
    if (!volumesContainer) return;
    
    // Encontrar o próximo índice de volume disponível
    let volumeIndex = 0;
    while (document.getElementById(`volume-produto-${produtoIndex}-${volumeIndex}`)) {
        volumeIndex++;
    }
    
    // Determinar se é o primeiro volume (padrão) ou adicional (fora do padrão)
    const isPrimeiroVolume = volumeIndex === 0;
    const tipo = isPrimeiroVolume ? 'padrao' : 'fora-padrao';
    const badgeClass = isPrimeiroVolume ? 'bg-success' : 'bg-warning';
    const badgeText = isPrimeiroVolume ? 'PADRÃO' : 'FORA DO PADRÃO';
    
    // Pegar valores padrão do produto
    const qtdPadrao = parseFloat(document.getElementById(`produto-qtd-padrao-${produtoIndex}`)?.value) || 250;
    const tipoEmbalagem = document.getElementById(`produto-tipo-embalagem-${produtoIndex}`)?.value || 'ML';
    
    // Valores iniciais
    const qtdInicial = isPrimeiroVolume ? 10 : 1;
    const unPorEmbInicial = isPrimeiroVolume ? qtdPadrao : 168;
    
    const divVolume = document.createElement('div');
    divVolume.className = 'volume-row mb-3 p-3 border rounded';
    divVolume.id = `volume-produto-${produtoIndex}-${volumeIndex}`;
    
    const deleteBtnDisplay = isPrimeiroVolume ? 'style="display: none;"' : '';
    
    divVolume.innerHTML = `
        <div class="d-flex justify-content-between mb-2">
            <h6 class="text-info">
                <i class="bi bi-box"></i> Volume #${volumeIndex + 1}
                <span class="badge ${badgeClass} ms-2" id="badge-produto-${produtoIndex}-volume-${volumeIndex}">${badgeText}</span>
            </h6>
            <button type="button" class="btn btn-sm btn-danger" onclick="removerVolumeProduto(${produtoIndex}, ${volumeIndex})" ${deleteBtnDisplay}>
                <i class="bi bi-trash"></i>
            </button>
        </div>
        <div class="row">
            <div class="col-md-3">
                <label class="form-label">Tipo</label>
                <select class="form-select tipo-volume-produto" onchange="alterarTipoVolumeProduto(${produtoIndex}, ${volumeIndex})">
                    <option value="padrao" ${isPrimeiroVolume ? 'selected' : ''}>Padrão</option>
                    <option value="fora-padrao" ${!isPrimeiroVolume ? 'selected' : ''}>Fora do Padrão</option>
                </select>
            </div>
            <div class="col-md-2">
                <label class="form-label">Volume (Embalagem)</label>
                <input type="text" class="form-control volume-embalagem-produto" id="volume-embalagem-produto-${produtoIndex}-${volumeIndex}" value="${tipoEmbalagem}" readonly>
            </div>
            <div class="col-md-2">
                <label class="form-label">Quantidade</label>
                <input type="number" class="form-control volume-qtd-produto" id="volume-qtd-produto-${produtoIndex}-${volumeIndex}" value="${qtdInicial}" min="1" step="1" oninput="calcularTotalVolumeProduto(${produtoIndex}, ${volumeIndex})">
            </div>
            <div class="col-md-2">
                <label class="form-label">UN por Embalagem</label>
                <input type="number" class="form-control volume-un-por-emb-produto" id="volume-un-por-emb-produto-${produtoIndex}-${volumeIndex}" value="${unPorEmbInicial}" min="1" step="0.01" oninput="calcularTotalVolumeProduto(${produtoIndex}, ${volumeIndex})" ${isPrimeiroVolume ? 'readonly' : ''}>
            </div>
            <div class="col-md-3">
                <label class="form-label">Total UN (automático)</label>
                <input type="number" class="form-control volume-total-produto" id="volume-total-produto-${produtoIndex}-${volumeIndex}" readonly style="background-color: #1e293b; color: #fbbf24; font-weight: 700;">
            </div>
        </div>
        <div class="row mt-2">
            <div class="col-md-4">
                <label class="form-label">Lote</label>
                <input type="text" class="form-control volume-lote-produto" id="volume-lote-produto-${produtoIndex}-${volumeIndex}" oninput="atualizarDadosVolumeProduto(${produtoIndex}, ${volumeIndex})">
            </div>
            <div class="col-md-4">
                <label class="form-label">Validade</label>
                <input type="date" class="form-control volume-validade-produto" id="volume-validade-produto-${produtoIndex}-${volumeIndex}" oninput="atualizarDadosVolumeProduto(${produtoIndex}, ${volumeIndex})">
            </div>
            <div class="col-md-4">
                <label class="form-label">Localização</label>
                <input type="text" class="form-control volume-localizacao-produto" id="volume-localizacao-produto-${produtoIndex}-${volumeIndex}" oninput="atualizarDadosVolumeProduto(${produtoIndex}, ${volumeIndex})">
            </div>
        </div>
    `;
    
    volumesContainer.appendChild(divVolume);
    
    // Inicializar dados do volume
    if (!produtosRecebimentoData[produtoIndex].volumes) {
        produtosRecebimentoData[produtoIndex].volumes = {};
    }
    
    produtosRecebimentoData[produtoIndex].volumes[volumeIndex] = {
        tipo: tipo,
        qtd: qtdInicial,
        unPorEmbalagem: unPorEmbInicial,
        totalUN: qtdInicial * unPorEmbInicial,
        lote: '',
        validade: '',
        localizacao: ''
    };
    
    calcularTotalVolumeProduto(produtoIndex, volumeIndex);
    atualizarTotaisRecebimento();
}

// Remover volume de um produto
function removerVolumeProduto(produtoIndex, volumeIndex) {
    const volume = document.getElementById(`volume-produto-${produtoIndex}-${volumeIndex}`);
    if (volume) {
        volume.remove();
        if (produtosRecebimentoData[produtoIndex]?.volumes) {
            delete produtosRecebimentoData[produtoIndex].volumes[volumeIndex];
        }
        atualizarTotalProduto(produtoIndex);
        atualizarTotaisRecebimento();
    }
}

// Alterar tipo de volume (padrão/fora do padrão)
function alterarTipoVolumeProduto(produtoIndex, volumeIndex) {
    const select = document.querySelector(`#volume-produto-${produtoIndex}-${volumeIndex} .tipo-volume-produto`);
    const badge = document.getElementById(`badge-produto-${produtoIndex}-volume-${volumeIndex}`);
    const unPorEmbInput = document.getElementById(`volume-un-por-emb-produto-${produtoIndex}-${volumeIndex}`);
    const qtdPadrao = parseFloat(document.getElementById(`produto-qtd-padrao-${produtoIndex}`).value) || 250;
    
    if (select.value === 'padrao') {
        badge.textContent = 'PADRÃO';
        badge.className = 'badge bg-success ms-2';
        unPorEmbInput.value = qtdPadrao;
        unPorEmbInput.readOnly = true;
    } else {
        badge.textContent = 'FORA DO PADRÃO';
        badge.className = 'badge bg-warning ms-2';
        unPorEmbInput.readOnly = false;
    }
    
    // Atualizar dados
    if (produtosRecebimentoData[produtoIndex]?.volumes?.[volumeIndex]) {
        produtosRecebimentoData[produtoIndex].volumes[volumeIndex].tipo = select.value;
        if (select.value === 'padrao') {
            produtosRecebimentoData[produtoIndex].volumes[volumeIndex].unPorEmbalagem = qtdPadrao;
        }
    }
    
    calcularTotalVolumeProduto(produtoIndex, volumeIndex);
}

// Calcular total de um volume
function calcularTotalVolumeProduto(produtoIndex, volumeIndex) {
    const qtd = parseFloat(document.getElementById(`volume-qtd-produto-${produtoIndex}-${volumeIndex}`).value) || 0;
    const unPorEmb = parseFloat(document.getElementById(`volume-un-por-emb-produto-${produtoIndex}-${volumeIndex}`).value) || 0;
    const total = qtd * unPorEmb;
    
    document.getElementById(`volume-total-produto-${produtoIndex}-${volumeIndex}`).value = total.toFixed(2);
    
    // Atualizar dados
    if (produtosRecebimentoData[produtoIndex]?.volumes?.[volumeIndex]) {
        produtosRecebimentoData[produtoIndex].volumes[volumeIndex].qtd = qtd;
        produtosRecebimentoData[produtoIndex].volumes[volumeIndex].unPorEmbalagem = unPorEmb;
        produtosRecebimentoData[produtoIndex].volumes[volumeIndex].totalUN = total;
    }
    
    atualizarTotalProduto(produtoIndex);
    atualizarTotaisRecebimento();
}

// Atualizar dados do volume
function atualizarDadosVolumeProduto(produtoIndex, volumeIndex) {
    if (!produtosRecebimentoData[produtoIndex]?.volumes?.[volumeIndex]) return;
    
    produtosRecebimentoData[produtoIndex].volumes[volumeIndex].lote = 
        document.getElementById(`volume-lote-produto-${produtoIndex}-${volumeIndex}`)?.value || '';
    produtosRecebimentoData[produtoIndex].volumes[volumeIndex].validade = 
        document.getElementById(`volume-validade-produto-${produtoIndex}-${volumeIndex}`)?.value || '';
    produtosRecebimentoData[produtoIndex].volumes[volumeIndex].localizacao = 
        document.getElementById(`volume-localizacao-produto-${produtoIndex}-${volumeIndex}`)?.value || '';
}

// Atualizar total de um produto
function atualizarTotalProduto(produtoIndex) {
    let totalProduto = 0;
    const volumes = document.querySelectorAll(`#volumes-produto-${produtoIndex} .volume-total-produto`);
    
    volumes.forEach(input => {
        totalProduto += parseFloat(input.value) || 0;
    });
    
    const totalElement = document.getElementById(`produto-total-un-${produtoIndex}`);
    if (totalElement) {
        totalElement.textContent = totalProduto.toFixed(2);
    }
}

// Atualizar totais gerais do recebimento
function atualizarTotaisRecebimento() {
    const totalProdEl = document.getElementById('total-produtos-recebimento');
    const totalVolEl = document.getElementById('total-volumes-recebimento');
    const totalGeralEl = document.getElementById('total-geral-un-recebimento');
    
    if (!totalProdEl || !totalVolEl || !totalGeralEl) return; // Sai se os elementos não existirem
    
    let totalProdutos = 0;
    let totalVolumes = 0;
    let totalGeralUN = 0;
    
    for (let i = 0; i < contadorProdutosRecebimento; i++) {
        const produto = document.getElementById(`produto-recebimento-${i}`);
        if (produto) {
            totalProdutos++;
            const volumes = produto.querySelectorAll('.volume-row');
            totalVolumes += volumes.length;
            
            const totalProduto = parseFloat(document.getElementById(`produto-total-un-${i}`)?.textContent) || 0;
            totalGeralUN += totalProduto;
        }
    }
    
    totalProdEl.textContent = totalProdutos;
    totalVolEl.textContent = totalVolumes;
    totalGeralEl.textContent = totalGeralUN.toFixed(2);
}

// Atualizar contagem de produtos no recebimento (para reindexação)
function atualizarContagemProdutosRecebimento() {
    let novosContadores = [];
    const produtos = document.querySelectorAll('.produto-recebimento');
    
    produtos.forEach((produto, index) => {
        // Atualizar IDs e atributos
        produto.id = `produto-recebimento-${index}`;
        
        // Atualizar título
        const titulo = produto.querySelector('h5');
        if (titulo) {
            titulo.innerHTML = `<i class="bi bi-box"></i> Produto #${index + 1}`;
        }
        
        // Atualizar inputs
        const buscaInput = produto.querySelector('.busca-produto-recebimento-principal');
        if (buscaInput) {
            buscaInput.id = `busca-produto-recebimento-${index}`;
            buscaInput.setAttribute('data-produto-index', index);
        }
        
        const skuInput = produto.querySelector('.produto-sku');
        if (skuInput) skuInput.id = `produto-sku-${index}`;
        
        const tipoInput = produto.querySelector('.produto-tipo-embalagem');
        if (tipoInput) tipoInput.id = `produto-tipo-embalagem-${index}`;
        
        const qtdInput = produto.querySelector('.produto-qtd-padrao');
        if (qtdInput) qtdInput.id = `produto-qtd-padrao-${index}`;
        
        const lista = produto.querySelector('.lista-produtos-recebimento-container');
        if (lista) lista.id = `lista-produtos-recebimento-${index}`;
        
        const volumesDiv = produto.querySelector('.volumes-produto-container');
        if (volumesDiv) volumesDiv.id = `volumes-produto-${index}`;
        
        const totalSpan = produto.querySelector('.produto-total-un');
        if (totalSpan) totalSpan.id = `produto-total-un-${index}`;
        
        // Atualizar índices nos botões de remover volume
        const removeButtons = produto.querySelectorAll('[onclick^="removerVolumeProduto"]');
        removeButtons.forEach(btn => {
            const match = btn.getAttribute('onclick').match(/removerVolumeProduto\((\d+), (\d+)\)/);
            if (match) {
                const oldProdutoIndex = match[1];
                const volumeIndex = match[2];
                btn.setAttribute('onclick', `removerVolumeProduto(${index}, ${volumeIndex})`);
            }
        });
        
        // Atualizar índices nos selects de tipo
        const tipoSelects = produto.querySelectorAll('[onchange^="alterarTipoVolumeProduto"]');
        tipoSelects.forEach(select => {
            const match = select.getAttribute('onchange').match(/alterarTipoVolumeProduto\((\d+), (\d+)\)/);
            if (match) {
                const oldProdutoIndex = match[1];
                const volumeIndex = match[2];
                select.setAttribute('onchange', `alterarTipoVolumeProduto(${index}, ${volumeIndex})`);
            }
        });
        
        // Atualizar índices nos inputs de cálculo
        const qtdInputs = produto.querySelectorAll('[oninput^="calcularTotalVolumeProduto"]');
        qtdInputs.forEach(input => {
            const match = input.getAttribute('oninput').match(/calcularTotalVolumeProduto\((\d+), (\d+)\)/);
            if (match) {
                const oldProdutoIndex = match[1];
                const volumeIndex = match[2];
                input.setAttribute('oninput', `calcularTotalVolumeProduto(${index}, ${volumeIndex})`);
            }
        });
        
        // Reconfigurar busca
        configurarBuscaProdutoRecebimentoMultiplo(index);
        
        novosContadores.push(index);
    });
    
    contadorProdutosRecebimento = novosContadores.length;
}

// Configurar busca de produto para um produto específico
function configurarBuscaProdutoRecebimentoMultiplo(produtoIndex) {
    const inputBusca = document.getElementById(`busca-produto-recebimento-${produtoIndex}`);
    const listaContainer = document.getElementById(`lista-produtos-recebimento-${produtoIndex}`);
    
    if (!inputBusca || !listaContainer) return;
    
    inputBusca.addEventListener('keyup', function() {
        const termo = this.value.toLowerCase();
        
        // Limpar e preencher lista
        listaContainer.innerHTML = '';
        
        produtos.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(p => {
            if (p.nome.toLowerCase().includes(termo) || p.sku.toLowerCase().includes(termo)) {
                const item = document.createElement('a');
                item.href = '#';
                item.className = 'list-group-item list-group-item-action bg-dark text-white border-secondary';
                item.setAttribute('data-sku', p.sku);
                item.setAttribute('data-tipo', p.tipoEmbalagem);
                item.setAttribute('data-qtd', p.qtdPorEmbalagem);
                item.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <span>${p.nome}</span>
                        <small class="text-muted">${p.sku}</small>
                    </div>
                    <small class="text-info">${p.categoria} - ${p.tipoEmbalagem} (${p.qtdPorEmbalagem} UN)</small>
                `;
                
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    selecionarProdutoRecebimentoMultiplo(produtoIndex, p.sku, p.nome, p.tipoEmbalagem, p.qtdPorEmbalagem);
                });
                
                listaContainer.appendChild(item);
            }
        });
        
        listaContainer.style.display = listaContainer.children.length > 0 ? 'block' : 'none';
    });
    
    inputBusca.addEventListener('focus', function() {
        if (this.value) {
            const event = new Event('keyup');
            inputBusca.dispatchEvent(event);
        }
    });
}

// Selecionar produto no recebimento múltiplo
function selecionarProdutoRecebimentoMultiplo(produtoIndex, sku, nome, tipoEmbalagem, qtdPorEmbalagem) {
    document.getElementById(`busca-produto-recebimento-${produtoIndex}`).value = nome;
    document.getElementById(`produto-sku-${produtoIndex}`).value = sku;
    document.getElementById(`produto-tipo-embalagem-${produtoIndex}`).value = tipoEmbalagem;
    document.getElementById(`produto-qtd-padrao-${produtoIndex}`).value = qtdPorEmbalagem;
    document.getElementById(`lista-produtos-recebimento-${produtoIndex}`).style.display = 'none';
    
    // Atualizar dados do produto
    if (!produtosRecebimentoData[produtoIndex]) {
        produtosRecebimentoData[produtoIndex] = { volumes: {} };
    }
    
    produtosRecebimentoData[produtoIndex].sku = sku;
    produtosRecebimentoData[produtoIndex].nome = nome;
    produtosRecebimentoData[produtoIndex].tipoEmbalagem = tipoEmbalagem;
    produtosRecebimentoData[produtoIndex].qtdPadrao = qtdPorEmbalagem;
    
    // Atualizar todas as linhas de volume deste produto com o novo tipo de embalagem
    const volumes = document.querySelectorAll(`#volumes-produto-${produtoIndex} .volume-embalagem-produto`);
    volumes.forEach(input => {
        input.value = tipoEmbalagem;
    });
    
    // Atualizar o primeiro volume se for padrão
    const primeiroVolume = document.getElementById(`volume-un-por-emb-produto-${produtoIndex}-0`);
    if (primeiroVolume && primeiroVolume.readOnly) {
        primeiroVolume.value = qtdPorEmbalagem;
        calcularTotalVolumeProduto(produtoIndex, 0);
    }
}

// ============================================
// FUNÇÃO SALVAR RECEBIMENTO MÚLTIPLO - CORRIGIDA
// ============================================

async function salvarRecebimentoMultiplo() {
    const dataRecebimento = document.getElementById('recebimento-multiplo-data').value;
    const numeroNF = document.getElementById('recebimento-multiplo-nf').value;
    const fornecedor = document.getElementById('recebimento-multiplo-fornecedor').value;
    const status = document.getElementById('recebimento-multiplo-status')?.value || 'Disponível';
    const observacoes = document.getElementById('recebimento-multiplo-observacoes')?.value || '';
    
    if (!dataRecebimento || !numeroNF || !fornecedor) {
        alert('Data, NF e Fornecedor são obrigatórios!');
        return;
    }
    
    // Construir a estrutura da unidade com múltiplos produtos e volumes
    const idUnidade = gerarIdUnico();
    const produtosArray = [];
    let totalVolumes = 0;
    let totalUN = 0;
    let resumoProdutos = [];
    
    // Coletar dados de cada produto
    for (let produtoIndex = 0; produtoIndex < contadorProdutosRecebimento; produtoIndex++) {
        const produtoDiv = document.getElementById(`produto-recebimento-${produtoIndex}`);
        if (!produtoDiv) continue;
        
        const sku = document.getElementById(`produto-sku-${produtoIndex}`)?.value;
        if (!sku) {
            alert(`Selecione um produto para o Produto #${produtoIndex + 1}`);
            return;
        }
        
        const produto = produtos.find(p => p.sku === sku);
        const tipoEmbalagem = document.getElementById(`produto-tipo-embalagem-${produtoIndex}`).value;
        
        const volumesArray = [];
        let temVolume = false;
        let totalProdutoUN = 0;
        
        // Coletar volumes deste produto
        for (let volumeIndex = 0; volumeIndex < 100; volumeIndex++) {
            const volumeRow = document.getElementById(`volume-produto-${produtoIndex}-${volumeIndex}`);
            if (!volumeRow) continue;
            
            const qtd = parseFloat(document.getElementById(`volume-qtd-produto-${produtoIndex}-${volumeIndex}`).value) || 0;
            const unPorEmb = parseFloat(document.getElementById(`volume-un-por-emb-produto-${produtoIndex}-${volumeIndex}`).value) || 0;
            
            if (qtd <= 0 || unPorEmb <= 0) {
                alert(`Volume #${volumeIndex + 1} do Produto #${produtoIndex + 1} tem valores inválidos`);
                return;
            }
            
            temVolume = true;
            const totalUNVolume = qtd * unPorEmb;
            totalProdutoUN += totalUNVolume;
            
            volumesArray.push({
                tipo: produtosRecebimentoData[produtoIndex]?.volumes?.[volumeIndex]?.tipo || (volumeIndex === 0 ? 'padrao' : 'fora-padrao'),
                qtdVolumes: qtd,
                unPorEmbalagem: unPorEmb,
                totalUN: totalUNVolume,
                lote: document.getElementById(`volume-lote-produto-${produtoIndex}-${volumeIndex}`)?.value || '',
                validade: document.getElementById(`volume-validade-produto-${produtoIndex}-${volumeIndex}`)?.value || '',
                localizacao: document.getElementById(`volume-localizacao-produto-${produtoIndex}-${volumeIndex}`)?.value || ''
            });
        }
        
        if (!temVolume) {
            alert(`Adicione pelo menos um volume para o Produto #${produtoIndex + 1}`);
            return;
        }
        
        produtosArray.push({
            sku: sku,
            nome: produto?.nome || '',
            tipoEmbalagem: tipoEmbalagem,
            volumes: volumesArray
        });
        
        totalVolumes += volumesArray.reduce((sum, v) => sum + v.qtdVolumes, 0);
        totalUN += totalProdutoUN;
        resumoProdutos.push(`${produto?.nome?.substring(0, 20)}... (${volumesArray.length} vols)`);
    }
    
    if (produtosArray.length === 0) {
        alert('Adicione pelo menos um produto!');
        return;
    }
    
    // Criar a unidade única com todos os produtos e volumes
    const unidadeUnica = {
        id: idUnidade,
        tipo: 'unidade-multipla',
        dataRecebimento: dataRecebimento,
        numeroNF: numeroNF,
        fornecedor: fornecedor,
        observacoes: observacoes,
        status: status,
        produtos: produtosArray,
        totalVolumes: totalVolumes,
        totalUN: totalUN,
        resumo: produtosArray.map(p => `${p.nome.substring(0, 20)}...`).join('; ')
    };
    
    try {
        // ============================================
        // ENVIO 1: Salvar no Google Sheets via Web App
        // ============================================
        console.log('📤 Enviando unidade para o Google Sheets...', unidadeUnica);
        
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tipo: 'unidade-multipla',
                id: idUnidade,
                dados: JSON.stringify(unidadeUnica),
                timestamp: new Date().toISOString()
            })
        });
        
        // ============================================
        // ENVIO 2: Salvar como recebimento (FORMATO CORRETO)
        // ============================================
        const recebimentoRegistro = {
            tipo: 'recebimento',
            idUnidade: idUnidade,
            data: dataRecebimento,
            nf: numeroNF,
            fornecedor: fornecedor,
            produtos: produtosArray.length,
            volumes: totalVolumes,
            totalUN: totalUN,
            resumo: resumoProdutos.join(' | ')
        };
        
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recebimentoRegistro)
        });
        
        // ============================================
        // ADICIONAR À LISTA LOCAL (FORMATO CORRETO)
        // ============================================
        unidades.push(unidadeUnica);
        
        // CORREÇÃO: Adicionar recebimento com a estrutura correta
        recebimentos.push({
            idUnidade: idUnidade,
            data: dataRecebimento,
            nf: numeroNF,
            fornecedor: fornecedor,
            produtos: produtosArray.length,
            volumes: totalVolumes,
            totalUN: totalUN,
            resumo: resumoProdutos.join(' | ')
        });
        
        // Fechar modal
        const modalElement = document.getElementById('modalRecebimentoMultiplo');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) modal.hide();
        
        // Atualizar interface
        atualizarTabelaUnidades();
        atualizarTabelaRecebimentos();
        
        alert(`✅ Recebimento concluído! Unidade criada: ${idUnidade}`);
        
    } catch (error) {
        console.error('❌ Erro detalhado:', error);
        alert(`Erro ao salvar: ${error.message}`);
    }
}

// ============================================
// FUNÇÕES PARA UNIDADE MÚLTIPLA (CRIAÇÃO MANUAL)
// ============================================

function abrirModalUnidadeMultiplo() {
    alert('Função em desenvolvimento - use o recebimento múltiplo');
}

// ============================================
// FUNÇÕES DE RECEBIMENTO (ORIGINAIS)
// ============================================

// Preencher select de SKUs nos filtros
function preencherFiltroSKU() {
    const select = document.getElementById('filtro-recebimento-sku');
    if (!select) return;
    
    select.innerHTML = '<option value="">Todos os SKUs</option>';
    
    // Pegar SKUs únicos dos produtos
    const skusUnicos = [...new Set(produtos.map(p => p.sku))];
    skusUnicos.sort().forEach(sku => {
        const produto = produtos.find(p => p.sku === sku);
        select.innerHTML += `<option value="${sku}">${sku} - ${produto?.nome || ''}</option>`;
    });
}

// Função para calcular datas baseado no período
function calcularDatasPorPeriodo(periodo) {
    const hoje = new Date();
    let dataInicio = new Date();
    let dataFim = new Date();
    
    // Ajustar para o fuso horário local
    const ajustarData = (data) => {
        return data.toISOString().split('T')[0];
    };
    
    switch(periodo) {
        case 'hoje':
            dataInicio = new Date(hoje.setHours(0,0,0,0));
            dataFim = new Date(hoje.setHours(23,59,59,999));
            break;
            
        case 'semana':
            const primeiroDiaSemana = hoje.getDate() - hoje.getDay();
            dataInicio = new Date(hoje.setDate(primeiroDiaSemana));
            dataInicio.setHours(0,0,0,0);
            dataFim = new Date(hoje.setDate(primeiroDiaSemana + 6));
            dataFim.setHours(23,59,59,999);
            break;
            
        case 'mes':
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
            break;
            
        case 'ano':
            dataInicio = new Date(hoje.getFullYear(), 0, 1);
            dataFim = new Date(hoje.getFullYear(), 11, 31, 23, 59, 59);
            break;
            
        case 'personalizado':
            return {
                inicio: document.getElementById('filtro-recebimento-data-inicio')?.value || '',
                fim: document.getElementById('filtro-recebimento-data-fim')?.value || ''
            };
    }
    
    return {
        inicio: ajustarData(dataInicio),
        fim: ajustarData(dataFim)
    };
}

// Filtrar recebimentos
function filtrarRecebimentos() {
    const periodo = document.getElementById('filtro-recebimento-periodo')?.value || 'mes';
    const nfFiltro = document.getElementById('filtro-recebimento-nf')?.value.toLowerCase() || '';
    const skuFiltro = document.getElementById('filtro-recebimento-sku')?.value || '';
    
    let filtrados = [...recebimentos];
    
    // Filtrar por período
    if (periodo) {
        const datas = calcularDatasPorPeriodo(periodo);
        if (datas.inicio && datas.fim) {
            filtrados = filtrados.filter(r => {
                const dataRecebimento = r.data;
                return dataRecebimento >= datas.inicio && dataRecebimento <= datas.fim;
            });
        }
    }
    
    // Filtrar por NF
    if (nfFiltro) {
        filtrados = filtrados.filter(r => r.nf && r.nf.toLowerCase().includes(nfFiltro));
    }
    
    // Filtrar por SKU
    if (skuFiltro) {
        filtrados = filtrados.filter(r => r.sku === skuFiltro);
    }
    
    atualizarTabelaRecebimentos(filtrados);
}

// Atualizar informações no recebimento
function atualizarInfoRecebimento() {
    const select = document.getElementById('recebimento-sku');
    const selectedOption = select.options[select.selectedIndex];
    const sku = select.value;
    const produto = produtos.find(p => p.sku === sku);
    
    if (produto) {
        document.getElementById('recebimento-produto').value = produto.nome;
        document.getElementById('recebimento-unidade').value = produto.tipoEmbalagem || 'UN';
        document.getElementById('recebimento-qtd-embalagem').value = produto.qtdPorEmbalagem || 1;
        calcularQuantidadeRecebimento();
    }
}

// Calcular quantidade total no recebimento
function calcularQuantidadeRecebimento() {
    const volume = parseInt(document.getElementById('recebimento-volume').value) || 1;
    const qtdPorEmbalagem = parseInt(document.getElementById('recebimento-qtd-embalagem').value) || 1;
    const quantidadeTotal = volume * qtdPorEmbalagem;
    document.getElementById('recebimento-quantidade').value = quantidadeTotal;
}

// Salvar recebimento (original)
async function salvarRecebimento() {
    const dataRecebimento = document.getElementById('recebimento-data').value;
    const sku = document.getElementById('recebimento-sku').value;
    const produto = produtos.find(p => p.sku === sku);
    
    if (!dataRecebimento || !sku) {
        alert('Data e SKU são obrigatórios!');
        return;
    }
    
    const recebimento = {
        tipo: 'recebimento',
        dataRecebimento: dataRecebimento,
        numeroNF: document.getElementById('recebimento-nf').value,
        fornecedor: document.getElementById('recebimento-fornecedor').value,
        codigoSKU: sku,
        nomeProduto: produto.nome,
        lote: document.getElementById('recebimento-lote').value,
        validade: document.getElementById('recebimento-validade').value,
        quantidade: parseInt(document.getElementById('recebimento-quantidade').value),
        volume: parseInt(document.getElementById('recebimento-volume').value),
        unidadeMedida: document.getElementById('recebimento-unidade').value,
        qtdPorEmbalagem: parseInt(document.getElementById('recebimento-qtd-embalagem').value),
        localizacao: document.getElementById('recebimento-localizacao').value,
        responsavel: 'Sistema',
        observacoes: document.getElementById('recebimento-observacoes').value
    };
    
    try {
        // Salvar recebimento
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recebimento)
        });
        
        // Criar unidade automaticamente
        const idUnidade = gerarIdUnico();
        const unidade = {
            tipo: 'unidade',
            id: idUnidade,
            sku: sku,
            lote: recebimento.lote,
            validade: recebimento.validade,
            volume: recebimento.volume,
            quantidade: recebimento.quantidade,
            unidadeEmbalagem: recebimento.unidadeMedida,
            status: 'Disponível',
            localizacao: recebimento.localizacao || '-',
            destino: '',
            foraPadrao: false,
            qtdRealPorEmbalagem: null,
            tipoEntrada: 'Recebimento'
        };
        
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(unidade)
        });
        
        // Limpar formulário
        document.getElementById('form-recebimento').reset();
        bootstrap.Modal.getInstance(document.getElementById('modalRecebimento')).hide();
        
        // Recarregar dados
        await carregarDados();
        
        alert('Recebimento registrado com sucesso!');
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao registrar recebimento.');
    }
}

// Carregar recebimentos
async function carregarRecebimentos() {
    try {
        console.log('📥 Carregando recebimentos da planilha...');
        
        const response = await fetch(RECEBIMENTOS_URL);
        const data = await response.json();
        
        if (data.values && data.values.length > 1) {
            // Pular cabeçalho (linha 1) e mapear dados
            recebimentos = data.values.slice(1).map(row => {
                // Função para converter string com vírgula para número
                const converter = (valor) => {
                    if (!valor) return 0;
                    if (typeof valor === 'string') {
                        return parseFloat(valor.replace(',', '.')) || 0;
                    }
                    return parseFloat(valor) || 0;
                };
                
                // CORREÇÃO: Usar colunas corretas
                const quantidadeTotal = converter(row[7]);           // Coluna H: Quantidade Total
                const volumeNumero = converter(row[8]);              // Coluna I: Volume (número)
                const unidadeVolume = row[9] || 'UN';                // Coluna J: Unidade de Medida
                const volumeTexto = volumeNumero ? `${volumeNumero} ${unidadeVolume}` : ''; // Montar texto
                const qtdPorEmbalagem = converter(row[10]);          // Coluna K: Qtd/Emb
                
                return {
                    // Dados básicos
                    data: row[0] || '',                          // Coluna A: Data
                    nf: row[1] || '-',                           // Coluna B: NF
                    fornecedor: row[2] || '-',                   // Coluna C: Fornecedor
                    sku: row[3] || '',                           // Coluna D: SKU
                    produto: row[4] || '',                       // Coluna E: Produto
                    lote: row[5] || '',                          // Coluna F: Lote
                    validade: row[6] || '',                      // Coluna G: Validade
                    
                    // CORRIGIDO: Separar número e unidade
                    quantidadeTotal: quantidadeTotal,             // Coluna H: Quantidade Total
                    volumeNumero: volumeNumero,                   // Coluna I: Volume (número)
                    unidadeVolume: unidadeVolume,                 // Coluna J: Unidade
                    volumeTexto: volumeTexto,                     // Texto completo montado
                    
                    // Outros campos
                    qtdPorEmbalagem: qtdPorEmbalagem,             // Coluna K: Qtd/Emb
                    localizacao: row[11] || '-',                  // Coluna L: Local
                    responsavel: row[12] || 'Sistema',            // Coluna M: Resp
                    observacoes: row[13] || '',                   // Coluna N: Obs
                    
                    // ID da unidade (gerado artificialmente)
                    idUnidade: `REC-${row[0]?.replace(/-/g, '')}-${row[1] || 'NF'}`
                };
            });
            
            console.log(`✅ ${recebimentos.length} recebimentos carregados`);
        } else {
            console.log('ℹ️ Nenhum recebimento encontrado na planilha');
            recebimentos = [];
        }
        
        // Atualizar a tabela
        atualizarTabelaRecebimentos();
        
    } catch (error) {
        console.error('❌ Erro ao carregar recebimentos:', error);
        recebimentos = [];
    }
}

// ============================================
// FUNÇÃO VER DETALHES DO RECEBIMENTO - CORRIGIDA
// ============================================

function verRecebimento(idUnidade) {
    // Buscar o recebimento pelo ID da unidade
    const recebimento = recebimentos.find(r => r.idUnidade === idUnidade);
    if (!recebimento) {
        alert('Recebimento não encontrado!');
        return;
    }
    
    console.log('Recebimento encontrado:', recebimento);
    
    // Preencher dados da NF
    document.getElementById('recebimento-data').textContent = formatarData(recebimento.data) || '-';
    document.getElementById('recebimento-nf').textContent = recebimento.nf || '-';
    document.getElementById('recebimento-fornecedor').textContent = recebimento.fornecedor || '-';
    document.getElementById('recebimento-responsavel').textContent = recebimento.responsavel || 'Sistema';
    
    // Preencher resumo
    document.getElementById('recebimento-total-produtos').textContent = recebimento.produtos || '1';
    document.getElementById('recebimento-total-volumes').textContent = recebimento.volumes || '-';
    document.getElementById('recebimento-total-un').textContent = (recebimento.totalUN || 0).toFixed(2);
    document.getElementById('recebimento-observacoes').textContent = recebimento.observacoes || '-';
    
    // Buscar produtos relacionados
    const tbody = document.getElementById('tabela-produtos-recebimento');
    tbody.innerHTML = '';
    
    // Se tiver dados completos do recebimento (com produtos)
    if (recebimento.produtosDetalhados && recebimento.produtosDetalhados.length > 0) {
        recebimento.produtosDetalhados.forEach(p => {
            p.volumes.forEach(v => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.nome || '-'}</td>
                    <td>${p.sku || '-'}</td>
                    <td>${v.lote || '-'}</td>
                    <td>${formatarData(v.validade) || '-'}</td>
                    <td>${v.qtdVolumes || '-'} ${p.tipoEmbalagem || ''}</td>
                    <td>${v.unPorEmbalagem || '-'}</td>
                    <td class="text-warning">${(v.totalUN || 0).toFixed(2)}</td>
                    <td>${v.localizacao || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        });
    } 
    // Se não tiver detalhes, usar os dados básicos
    else {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${recebimento.produto || recebimento.resumo || '-'}</td>
            <td>${recebimento.sku || '-'}</td>
            <td>${recebimento.lote || '-'}</td>
            <td>${formatarData(recebimento.validade) || '-'}</td>
            <td>${recebimento.volumeNumero || recebimento.volumes || '-'} ${recebimento.unidadeVolume || ''}</td>
            <td>${recebimento.qtdPorEmbalagem || '-'}</td>
            <td class="text-warning">${(recebimento.quantidadeTotal || recebimento.totalUN || 0).toFixed(2)}</td>
            <td>${recebimento.localizacao || '-'}</td>
        `;
        tbody.appendChild(tr);
    }
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('modalDetalhesRecebimento'));
    modal.show();
}

// ============================================
// FUNÇÕES DO ESTOQUE GERAL
// ============================================

// Carregar estoque geral da planilha
async function carregarEstoqueGeral() {
   try {
        console.log('📊 Carregando estoque geral da planilha...');
        
        const response = await fetch(ESTOQUE_GERAL_URL);
        const data = await response.json();
        
        if (data.values && data.values.length > 1) {
            estoqueGeral = data.values.slice(1).map(row => {
                // Função auxiliar para converter string com vírgula
                const converter = (valor) => {
                    if (!valor) return 0;
                    if (typeof valor === 'string') {
                        return parseFloat(valor.replace(',', '.')) || 0;
                    }
                    return parseFloat(valor) || 0;
                };
                
                return {
                    codigo: row[0] || '',
                    unidade: row[1] || '',
                    descricao: row[2] || '',
                    qtdSistema: converter(row[3]),
                    quantidadeAnterior: converter(row[4]),
                    lancamentos: converter(row[5]),
                    quantidadeTotal: converter(row[6]),
                    abastecimentos: converter(row[7]),
                    fisicoAtual: converter(row[8]),
                    estSistemaReal: converter(row[9]),
                    status: row[10] || 'NORMAL'
                };
            }).filter(item => item.codigo);
            
            console.log(`✅ ${estoqueGeral.length} itens carregados`);
        }
        
        atualizarTabelaEstoqueGeral();
    } catch (error) {
        console.error('❌ Erro ao carregar estoque geral:', error);
        estoqueGeral = [];
    }
}

// Atualizar tabela do estoque geral
function atualizarTabelaEstoqueGeral(dadosFiltrados = null) {
    const tbody = document.getElementById('tabela-estoque-geral');
    if (!tbody) return;
    
    const dados = dadosFiltrados || estoqueGeral;
    
    tbody.innerHTML = '';
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center">Nenhum item encontrado na aba Estoque Geral</td></tr>';
        return;
    }
    
    dados.forEach(item => {
        const tr = document.createElement('tr');
        
        let statusClass = '';
        if (item.status === 'ESTOQUE ZERADO' || item.fisicoAtual <= 0) statusClass = 'table-danger';
        else if (item.status === 'ESTOQUE BAIXO' || (item.fisicoAtual > 0 && item.fisicoAtual < 10)) statusClass = 'table-warning';
        
        tr.className = statusClass;
        
        tr.innerHTML = `
            <td><strong>${item.codigo}</strong></td>
            <td>${item.unidade}</td>
            <td>${item.descricao}</td>
            <td class="text-end">${item.qtdSistema.toFixed(2).replace('.', ',')}</td>
            <td class="text-end">${item.quantidadeAnterior.toFixed(2).replace('.', ',')}</td>
            <td class="text-end">${item.lancamentos.toFixed(2).replace('.', ',')}</td>
            <td class="text-end"><strong>${item.quantidadeTotal.toFixed(2).replace('.', ',')}</strong></td>
            <td class="text-end text-danger">${item.abastecimentos.toFixed(2).replace('.', ',')}</td>
            <td class="text-end"><strong class="${item.fisicoAtual <= 0 ? 'text-danger' : item.fisicoAtual < 10 ? 'text-warning' : 'text-success'}">${item.fisicoAtual.toFixed(2).replace('.', ',')}</strong></td>
            <td class="text-end">${item.estSistemaReal.toFixed(2).replace('.', ',')}</td>
            <td>
                <span class="badge ${item.status === 'NORMAL' ? 'bg-success' : item.status === 'ESTOQUE BAIXO' ? 'bg-warning' : 'bg-danger'}">
                    ${item.status}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Filtrar estoque geral
function filtrarEstoqueGeral() {
    const skuFiltro = document.getElementById('filtro-estoque-sku')?.value.toLowerCase() || '';
    const descricaoFiltro = document.getElementById('filtro-estoque-descricao')?.value.toLowerCase() || '';
    const statusFiltro = document.getElementById('filtro-estoque-status')?.value || '';
    const unidadeFiltro = document.getElementById('filtro-estoque-unidade')?.value || '';
    
    let filtrados = [...estoqueGeral];
    
    if (skuFiltro) {
        filtrados = filtrados.filter(item => item.codigo.toLowerCase().includes(skuFiltro));
    }
    
    if (descricaoFiltro) {
        filtrados = filtrados.filter(item => item.descricao.toLowerCase().includes(descricaoFiltro));
    }
    
    if (statusFiltro) {
        filtrados = filtrados.filter(item => item.status === statusFiltro);
    }
    
    if (unidadeFiltro) {
        filtrados = filtrados.filter(item => item.unidade === unidadeFiltro);
    }
    
    atualizarTabelaEstoqueGeral(filtrados);
}

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

// Mostrar view
function mostrarView(view) {
    const views = ['painel', 'produtos', 'unidades', 'scanner', 'recebimentos', 'movimentacoes', 'relatorios', 'categorias'];
    views.forEach(v => {
        const el = document.getElementById(`${v}-view`);
        if (el) el.style.display = 'none';
    });
    
    const viewEl = document.getElementById(`${view}-view`);
    if (viewEl) viewEl.style.display = 'block';
    
    document.querySelectorAll('.list-group-item').forEach(item => item.classList.remove('active'));
    const menu = document.getElementById(`menu-${view}`);
    if (menu) menu.classList.add('active');
    
    if (view === 'scanner') setupQRCode();
    if (view === 'unidades') {
        preencherFiltros();
        atualizarTabelaUnidades();
    }
    if (view === 'recebimentos') {
        preencherSelectProdutosRecebimento();
        preencherFiltroSKU();
        carregarRecebimentos();
    }
    if (view === 'relatorios') gerarRelatorios();
    if (view === 'categorias') atualizarTabelaCategorias();
    if (view === 'painel') {
        carregarEstoqueGeral();
        atualizarPainel();
        atualizarGraficosPainel();
    }
}

// Preencher select de produtos no recebimento
function preencherSelectProdutosRecebimento() {
    const select = document.getElementById('recebimento-sku');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um produto</option>';
    produtos.forEach(p => {
        select.innerHTML += `<option value="${p.sku}" data-tipo="${p.tipoEmbalagem}" data-qtd="${p.qtdPorEmbalagem}">${p.nome} (${p.sku})</option>`;
    });
}

// Preencher todos os filtros
function preencherFiltros() {
    const selectCategoria = document.getElementById('filtro-categoria-produto');
    if (selectCategoria) {
        selectCategoria.innerHTML = '<option value="">Todas as categorias</option>';
        categorias.forEach(c => {
            selectCategoria.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
        });
    }
    
    preencherSelectProdutos();
    
    const selectEmbalagem = document.getElementById('filtro-embalagem-unidades');
    if (selectEmbalagem) {
        selectEmbalagem.innerHTML = '<option value="">Todas embalagens</option>';
        tiposEmbalagem.forEach(t => {
            if (t !== 'UN') {
                selectEmbalagem.innerHTML += `<option value="${t}">${t}</option>`;
            }
        });
    }
}

// Preencher select de produtos
function preencherSelectProdutos() {
    const select = document.getElementById('unidade-sku');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um produto</option>';
    produtos.forEach(p => {
        const embalagem = p.tipoEmbalagem || 'UN';
        const qtdInfo = p.qtdPorEmbalagem ? ` (${p.qtdPorEmbalagem} UN por ${embalagem})` : '';
        select.innerHTML += `<option value="${p.sku}" data-tipo="${embalagem}" data-qtd="${p.qtdPorEmbalagem || 1}">${p.nome} - ${embalagem}${qtdInfo}</option>`;
    });
}

// Carregar dados
async function carregarDados() {
    try {
        console.log('Carregando dados...');
        
        const produtosRes = await fetch(PRODUTOS_URL);
        const produtosData = await produtosRes.json();
        if (produtosData.values && produtosData.values.length > 1) {
            produtos = produtosData.values.slice(1).map(row => {
                let sku = row[0] || '';
                
                if (sku && !isNaN(sku) && sku.length < 8) {
                    sku = sku.padStart(8, '0');
                }
                
                return {
                    sku: sku,
                    nome: row[1] || '',
                    descricao: row[2] || '',
                    categoria: row[3] || 'Insumos',
                    tipoEmbalagem: row[4] || 'UN',
                    qtdPorEmbalagem: parseInt(row[5]) || 1,
                    unidadeBase: row[6] || 'UN',
                    imagem: row[7] || ''
                };
            }).filter(p => p.sku);
            
            console.log(`✅ ${produtos.length} produtos carregados`);
        }

        const unidadesRes = await fetch(UNIDADES_URL);
const unidadesData = await unidadesRes.json();
if (unidadesData.values && unidadesData.values.length > 1) {
    // Primeiro, carregar todas as unidades cruas
    const unidadesRaw = unidadesData.values.slice(1).map(row => {
        let sku = row[1] || '';
        
        if (sku && !isNaN(sku) && sku.length < 8) {
            sku = sku.padStart(8, '0');
        }
        
        const quantidadeStr = row[5] || '0';
        const quantidade = parseFloat(quantidadeStr.replace(',', '.')) || 0;
        
        return {
            id: row[0] || '',
            sku: sku,
            lote: row[2] || '',
            validade: row[3] || '',
            volume: parseInt(row[4]) || 1,
            quantidade: quantidade,  
            unidadeEmbalagem: row[6] || 'UN',
            status: row[7] || 'Disponível',
            localizacao: row[8] || '-',
            destino: row[9] || '',
            foraPadrao: row[10] === 'Sim',
            qtdRealPorEmbalagem: row[11] ? parseFloat(row[11].replace(',', '.')) : null,
            tipoEntrada: row[12] || 'Manual'
        };
    }).filter(u => u.id);
    
    // ============================================
    // AGRUPAR UNIDADES MÚLTIPLAS PELO ID BASE
    // ============================================
    const unidadesMap = new Map();
    const produtosMap = new Map(); // Cache de produtos para evitar buscas repetidas
    
    unidadesRaw.forEach(u => {
        // Extrair ID base (remover sufixo -P1V1, -P1V2 etc)
        const idBase = u.id.replace(/-P\d+V\d+$/, '');
        
        if (u.id.includes('-P') && u.id.includes('V')) {
            // É uma unidade múltipla (tem -P1V1, -P1V2)
            if (!unidadesMap.has(idBase)) {
                // Buscar nome do produto
                let nomeProduto = u.sku;
                if (!produtosMap.has(u.sku)) {
                    const produto = produtos.find(p => p.sku === u.sku);
                    produtosMap.set(u.sku, produto?.nome || u.sku);
                }
                nomeProduto = produtosMap.get(u.sku);
                
                // Criar unidade múltipla
                unidadesMap.set(idBase, {
                    id: idBase,
                    tipo: 'unidade-multipla',
                    produtos: [{
                        sku: u.sku,
                        nome: nomeProduto,
                        tipoEmbalagem: u.unidadeEmbalagem,
                        volumes: []
                    }],
                    totalVolumes: 0,
                    totalUN: 0,
                    status: u.status,
                    tipoEntrada: u.tipoEntrada,
                    numeroNF: u.numeroNF,
                    fornecedor: u.fornecedor,
                    dataRecebimento: u.dataRecebimento
                });
            }
            
            // Adicionar volume à unidade múltipla
            const unidadeMultipla = unidadesMap.get(idBase);
            const produto = unidadeMultipla.produtos[0];
            
            produto.volumes.push({
                tipo: u.foraPadrao ? 'fora-padrao' : 'padrao',
                qtdVolumes: u.volume,
                unPorEmbalagem: u.qtdRealPorEmbalagem || (u.quantidade / u.volume),
                totalUN: u.quantidade,
                lote: u.lote,
                validade: u.validade,
                localizacao: u.localizacao
            });
            
            unidadeMultipla.totalVolumes += u.volume;
            unidadeMultipla.totalUN += u.quantidade;
            
        } else {
            // É unidade simples
            unidadesMap.set(u.id, {
                ...u,
                tipo: 'unidade'
            });
        }
    });
    
    unidades = Array.from(unidadesMap.values());
    console.log(`✅ ${unidades.length} unidades carregadas (${unidadesRaw.length} linhas agrupadas em ${unidades.length} unidades)`);
}

        const movRes = await fetch(MOVIMENTACOES_URL);
        const movData = await movRes.json();
        if (movData.values && movData.values.length > 1) {
            movimentacoes = movData.values.slice(1).map(row => {
                let sku = row[3] || '';
                
                if (sku && !isNaN(sku) && sku.length < 8) {
                    sku = sku.padStart(8, '0');
                }
                
                return {
                    data: row[0] || '',
                    tipo: row[1] || '',
                    idUnidade: row[2] || '',
                    sku: sku,
                    volume: parseInt(row[4]) || 0,
                    quantidade: parseFloat(row[5]) || 0,
                    unidadeEmbalagem: row[6] || '',
                    destino: row[7] || '',
                    responsavel: row[8] || '',
                    observacao: row[9] || ''
                };
            }).filter(m => m.data);
            
            console.log(`✅ ${movimentacoes.length} movimentações carregadas`);
        }

        await carregarRecebimentos();
        atualizarInterface();
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        carregarDadosExemplo();
    }
}

// Dados de exemplo
function carregarDadosExemplo() {
    produtos = [
        { sku: '00000001', nome: 'PRODUTO EXEMPLO 1', descricao: 'Descrição 1', categoria: 'Insumos', tipoEmbalagem: 'ML', qtdPorEmbalagem: 250, unidadeBase: 'UN', imagem: '' },
        { sku: '00000002', nome: 'PRODUTO EXEMPLO 2', descricao: 'Descrição 2', categoria: 'Embalagem Papelão', tipoEmbalagem: 'CX', qtdPorEmbalagem: 50, unidadeBase: 'UN', imagem: '' }
    ];
    
    unidades = [];
    movimentacoes = [];
    recebimentos = [];
    atualizarInterface();
}

// Atualizar interface
function atualizarInterface() {
    atualizarPainel();
    atualizarCardsProdutos();
    atualizarTabelaUnidades();
    atualizarTabelaMovimentacoes();
    atualizarUltimasMovimentacoes();
    preencherFiltros();
    atualizarGraficosPainel();
}

// ============================================
// FUNÇÕES DE UNIDADES (ORIGINAIS MODIFICADAS)
// ============================================

// Atualizar painel
function atualizarPainel() {
    const unidadesAtivas = unidades.filter(u => u.quantidade > 0 || u.produtos);
    
    const totalProdutosEl = document.getElementById('total-produtos');
    const totalUnidadesEl = document.getElementById('total-unidades');
    const proximosVencerEl = document.getElementById('proximos-vencer');
    const estoqueBaixoEl = document.getElementById('estoque-baixo');
    
    if (totalProdutosEl) totalProdutosEl.textContent = produtos.length;
    if (totalUnidadesEl) totalUnidadesEl.textContent = unidadesAtivas.length;
    
    const hoje = new Date();
    const proximosVencer = unidadesAtivas.filter(u => {
        if (u.tipo === 'unidade-multipla') {
            let temProximo = false;
            u.produtos.forEach(p => {
                p.volumes.forEach(v => {
                    if (v.validade) {
                        const validade = new Date(v.validade);
                        const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
                        if (dias <= 30 && dias > 0) temProximo = true;
                    }
                });
            });
            return temProximo;
        } else {
            if (!u.validade) return false;
            const validade = new Date(u.validade);
            const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
            return dias <= 30 && dias > 0;
        }
    }).length;
    
    if (proximosVencerEl) proximosVencerEl.textContent = proximosVencer;
    
    const estoqueBaixo = unidadesAtivas.filter(u => {
        if (u.tipo === 'unidade-multipla') {
            return u.totalUN < 10;
        } else {
            return u.quantidade < 10;
        }
    }).length;
    
    if (estoqueBaixoEl) estoqueBaixoEl.textContent = estoqueBaixo;
}

// Atualizar cards de produtos
function atualizarCardsProdutos() {
    const container = document.getElementById('cards-produtos');
    if (!container) return;
    
    const categoriaFiltro = document.getElementById('filtro-categoria-produto')?.value || '';
    const embalagemFiltro = document.getElementById('filtro-embalagem-produto')?.value || '';
    const termoBusca = document.getElementById('search-produto')?.value.toLowerCase() || '';
    
    let produtosFiltrados = produtos;
    
    if (categoriaFiltro) {
        produtosFiltrados = produtosFiltrados.filter(p => p.categoria === categoriaFiltro);
    }
    
    if (embalagemFiltro) {
        produtosFiltrados = produtosFiltrados.filter(p => p.tipoEmbalagem === embalagemFiltro);
    }
    
    if (termoBusca) {
        produtosFiltrados = produtosFiltrados.filter(p => 
            p.nome.toLowerCase().includes(termoBusca) || 
            p.sku.toLowerCase().includes(termoBusca)
        );
    }
    
    container.innerHTML = '';
    
    if (produtosFiltrados.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted">Nenhum produto encontrado</p></div>';
        return;
    }
    
    produtosFiltrados.forEach(produto => {
        const unidadesProduto = unidades.filter(u => 
            (u.sku === produto.sku && u.quantidade > 0) || 
            (u.tipo === 'unidade-multipla' && u.produtos.some(p => p.sku === produto.sku))
        );
        
        let totalVolume = 0;
        let totalQuantidade = 0;
        
        unidadesProduto.forEach(u => {
            if (u.tipo === 'unidade-multipla') {
                u.produtos.forEach(p => {
                    if (p.sku === produto.sku) {
                        p.volumes.forEach(v => {
                            totalVolume += v.qtdVolumes;
                            totalQuantidade += v.totalUN;
                        });
                    }
                });
            } else {
                totalVolume += u.volume;
                totalQuantidade += u.quantidade;
            }
        });
        
        const card = document.createElement('div');
        card.className = 'col-md-4 mb-3';
        card.innerHTML = `
            <div class="card h-100 ${getCategoriaClass(produto.categoria)}">
                ${produto.imagem ? `<img src="${produto.imagem}" class="card-img-top" style="height: 150px; object-fit: cover;">` : ''}
                <div class="card-body">
                    <h5 class="card-title">${produto.nome}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">SKU: ${produto.sku}</h6>
                    <span class="badge ${getCategoriaBadgeClass(produto.categoria)}">${produto.categoria}</span>
                    <span class="badge bg-info">${produto.tipoEmbalagem}</span>
                    <p class="card-text mt-2">${produto.descricao || ''}</p>
                    <div class="row mt-3">
                        <div class="col-6">
                            <small>Volume: ${totalVolume} ${produto.tipoEmbalagem}</small>
                        </div>
                        <div class="col-6">
                            <small>Total: ${totalQuantidade.toFixed(2)} ${produto.unidadeBase || 'UN'}</small>
                        </div>
                    </div>
                    <div class="mt-3">
                        <button class="btn btn-sm btn-primary" onclick="verProduto('${produto.sku}')">
                            <i class="bi bi-eye"></i> Ver unidades
                        </button>
                        <button class="btn btn-sm btn-success" onclick="abrirModalUnidade('${produto.sku}')">
                            <i class="bi bi-plus"></i> Nova unidade
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Filtrar produtos
function filtrarProdutos() {
    atualizarCardsProdutos();
}

// Ver produto (modal)
function verProduto(sku) {
    const produto = produtos.find(p => p.sku === sku);
    
    const unidadesProduto = unidades.filter(u => 
        (u.sku === sku && u.quantidade > 0) || 
        (u.tipo === 'unidade-multipla' && u.produtos.some(p => p.sku === sku))
    );
    
    document.getElementById('modalVerProduto-titulo').textContent = `${produto.nome} - SKU: ${sku} (${produto.tipoEmbalagem})`;
    
    const tbody = document.getElementById('tabela-unidades-produto');
    tbody.innerHTML = '';
    
    if (unidadesProduto.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhuma unidade ativa encontrada</td></tr>';
    } else {
        unidadesProduto.forEach(u => {
            if (u.tipo === 'unidade-multipla') {
                u.produtos.forEach(p => {
                    if (p.sku === sku) {
                        p.volumes.forEach(v => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td><small class="text-warning">${u.id}</small><br><small>Múltiplo</small></td>
                                <td>${v.lote}</td>
                                <td>${formatarData(v.validade)}</td>
                                <td>${p.tipoEmbalagem}</td>
                                <td>${v.qtdVolumes}</td>
                                <td>${v.totalUN.toFixed(2).replace('.', ',')} ${produto?.unidadeBase || 'UN'}</td>
                                <td><span class="badge ${u.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${u.status}</span></td>
                                <td>${v.localizacao}</td>
                                <td>
                                    <button class="btn btn-sm btn-info" onclick="verUnidade('${u.id}')">
                                        <i class="bi bi-eye"></i>
                                    </button>
                                </td>
                            `;
                            tbody.appendChild(tr);
                        });
                    }
                });
            } else {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><small>${u.id}</small></td>
                    <td>${u.lote}</td>
                    <td>${formatarData(u.validade)}</td>
                    <td>${u.unidadeEmbalagem}</td>
                    <td>${u.volume}</td>
                    <td>${u.quantidade.toFixed(2).replace('.', ',')} ${produto?.unidadeBase || 'UN'}</td>
                    <td><span class="badge ${u.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${u.status}</span></td>
                    <td>${u.localizacao}</td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="verUnidade('${u.id}')">
                            <i class="bi bi-eye"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalVerProduto'));
    modal.show();
}

// Abrir modal unidade
function abrirModalUnidade(sku) {
    preencherSelectProdutos();
    document.getElementById('form-unidade').reset();
    document.getElementById('unidade-id').value = '';
    document.getElementById('unidade-sku').value = sku || '';
    document.getElementById('unidade-volume').value = '1';
    document.getElementById('unidade-status').value = 'Disponível';
    document.getElementById('campo-quantidade-real').style.display = 'none';
    
    if (sku) {
        atualizarInfoEmbalagem();
    } else {
        document.getElementById('quantidade-unidade').textContent = '(UN)';
        document.getElementById('quantidade-descricao').textContent = 'Total de unidades';
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalUnidade'));
    modal.show();
}

// Salvar produto
async function salvarProduto() {
    let sku = document.getElementById('produto-sku').value;
    
    if (sku) {
        sku = String(sku).trim();
        if (sku.length < 8 && !isNaN(sku)) {
            sku = sku.padStart(8, '0');
        }
    }
    
    const tipoEmbalagem = document.getElementById('produto-tipo-embalagem').value;
    const qtdPorEmbalagem = tipoEmbalagem !== 'UN' ? 
        parseInt(document.getElementById('produto-qtd-por-embalagem').value) : 1;
    
    const produto = {
        tipo: 'produto',
        sku: sku,
        nome: document.getElementById('produto-nome').value,
        descricao: document.getElementById('produto-descricao').value,
        categoria: document.getElementById('produto-categoria').value,
        tipoEmbalagem: tipoEmbalagem,
        qtdPorEmbalagem: qtdPorEmbalagem,
        unidadeBase: document.getElementById('produto-unidade-base').value,
        imagem: document.getElementById('produto-imagem').value || ''
    };
    
    if (!produto.sku || !produto.nome || !produto.categoria || !produto.tipoEmbalagem) {
        alert('SKU, Nome, Categoria e Tipo de Embalagem são obrigatórios!');
        return;
    }
    
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(produto)
        });
        
        produtos.push(produto);
        
        bootstrap.Modal.getInstance(document.getElementById('modalProduto')).hide();
        document.getElementById('form-produto').reset();
        atualizarInterface();
        
        alert('Produto salvo com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        alert('Erro ao salvar produto.');
    }
}

// Salvar unidade (original)
async function salvarUnidade() {
    const id = document.getElementById('unidade-id').value || gerarIdUnico();
    const sku = document.getElementById('unidade-sku').value;
    const produto = produtos.find(p => p.sku === sku);
    
    const volume = parseFloat(document.getElementById('unidade-volume').value);
    const foraPadrao = document.getElementById('unidade-fora-padrao').checked;
    
    let quantidade = parseFloat(document.getElementById('unidade-quantidade').value);
    
    if (isNaN(quantidade)) quantidade = 0;
    
    if (foraPadrao) {
        const qtdReal = parseFloat(document.getElementById('unidade-quantidade-real').value);
        if (!isNaN(qtdReal)) {
            quantidade = volume * qtdReal;
        }
    }
    
    const unidade = {
        tipo: 'unidade',
        id: id,
        sku: sku,
        lote: document.getElementById('unidade-lote').value,
        validade: document.getElementById('unidade-validade').value,
        volume: volume,
        quantidade: quantidade,
        unidadeEmbalagem: produto?.tipoEmbalagem || 'UN',
        status: document.getElementById('unidade-status').value,
        localizacao: document.getElementById('unidade-localizacao').value || '-',
        destino: '',
        foraPadrao: foraPadrao,
        qtdRealPorEmbalagem: foraPadrao ? parseFloat(document.getElementById('unidade-quantidade-real').value) : null,
        tipoEntrada: 'Manual'
    };
    
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(unidade)
        });
        
        if (document.getElementById('unidade-id').value) {
            const index = unidades.findIndex(u => u.id === id);
            if (index !== -1) unidades[index] = unidade;
        } else {
            unidades.push(unidade);
        }
        
        bootstrap.Modal.getInstance(document.getElementById('modalUnidade')).hide();
        atualizarInterface();
        
        alert(`Unidade ${document.getElementById('unidade-id').value ? 'atualizada' : 'criada'} com sucesso!`);
    } catch (error) {
        console.error('Erro ao salvar unidade:', error);
        alert('Erro ao salvar unidade.');
    }
}

// Salvar categoria
async function salvarCategoria() {
    const categoria = {
        id: categorias.length + 1,
        nome: document.getElementById('categoria-nome').value,
        tipo: document.getElementById('categoria-tipo').value,
        descricao: document.getElementById('categoria-descricao').value
    };
    
    if (!categoria.nome || !categoria.tipo) {
        alert('Nome e tipo são obrigatórios!');
        return;
    }
    
    categorias.push(categoria);
    
    bootstrap.Modal.getInstance(document.getElementById('modalCategoria')).hide();
    document.getElementById('form-categoria').reset();
    
    atualizarTabelaCategorias();
    preencherFiltros();
    
    alert('Categoria salva com sucesso!');
}

// Atualizar tabela de categorias
function atualizarTabelaCategorias() {
    const tbody = document.getElementById('tabela-categorias');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    categorias.forEach(cat => {
        const totalProdutos = produtos.filter(p => p.categoria === cat.nome).length;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cat.nome}</td>
            <td>${cat.tipo}</td>
            <td>${cat.descricao || ''}</td>
            <td>${totalProdutos}</td>
            <td>
                <button class="btn btn-sm btn-warning"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Gerar ID único
function gerarIdUnico() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'UN-';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    id += '-';
    for (let i = 0; i < 4; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// Atualizar tabela de unidades (MODIFICADA)
// ============================================
// FUNÇÃO ATUALIZAR TABELA DE UNIDADES - VERSÃO ORIGINAL RESTAURADA
// ============================================
function atualizarTabelaUnidades(unidadesFiltradas = null) {
    const tbody = document.getElementById('tabela-unidades');
    if (!tbody) return;
    
    const dados = unidadesFiltradas || unidades.filter(u => u.quantidade > 0 || u.produtos);
    
    tbody.innerHTML = '';
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center">Nenhuma unidade ativa encontrada</td></tr>';
        return;
    }
    
    dados.forEach(u => {
        // Verificar se é unidade múltipla (com vários produtos)
        if (u.tipo === 'unidade-multipla') {
            // Para unidades múltiplas, criar uma linha para cada produto/volume
            u.produtos.forEach((produto, pIndex) => {
                produto.volumes.forEach((volume, vIndex) => {
                    const tr = document.createElement('tr');
                    
                    // Encontrar o produto nos dados principais para pegar categoria
                    const produtoInfo = produtos.find(p => p.sku === produto.sku);
                    
                    tr.innerHTML = `
                        <td><small class="text-warning">${u.id}</small><br><small class="text-info">M${pIndex+1}V${vIndex+1}</small></td>
                        <td>${produto.nome}</td>
                        <td><span class="badge ${getCategoriaBadgeClass(produtoInfo?.categoria)}">${produtoInfo?.categoria || '-'}</span></td>
                        <td><span class="badge bg-info">${produto.tipoEmbalagem}</span></td>
                        <td>${volume.lote || '-'}</td>
                        <td>${formatarData(volume.validade) || '-'}</td>
                        <td>${volume.qtdVolumes}</td>
                        <td>${volume.totalUN.toFixed(2).replace('.', ',')} ${produtoInfo?.unidadeBase || 'UN'}</td>
                        <td><span class="badge ${u.tipoEntrada === 'Recebimento' ? 'bg-info' : 'bg-secondary'}">Recebimento</span></td>
                        <td><span class="badge ${u.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${u.status}</span></td>
                        <td>${u.destino || '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-info" onclick="verUnidade('${u.id}')" title="Ver detalhes">
                                <i class="bi bi-eye"></i>
                            </button>
                            ${u.status === 'Disponível' && volume.totalUN > 0 ? `
                                <button class="btn btn-sm btn-warning" onclick="abrirModalTransferencia('${u.id}', '${produto.sku}', '${volume.lote}', '${volume.validade}', '${produto.nome}', ${volume.qtdVolumes}, ${volume.totalUN}, '${produto.tipoEmbalagem}', '${produtoInfo?.unidadeBase || 'UN'}', ${produtoInfo?.qtdPorEmbalagem || 1})" title="Dar baixa">
                                    <i class="bi bi-arrow-right"></i>
                                </button>
                            ` : ''}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            });
        } else {
            // Unidade simples (formato original)
            const produto = produtos.find(p => p.sku === u.sku);
            const validadeDate = new Date(u.validade);
            const hoje = new Date();
            const vencido = validadeDate < hoje;
            
            // CORREÇÃO: Formatar com 2 casas decimais
            const quantidadeFormatada = u.quantidade.toFixed(2).replace('.', ',');
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><small>${u.id}</small></td>
                <td>${produto ? produto.nome : u.sku}</td>
                <td><span class="badge ${getCategoriaBadgeClass(produto?.categoria)}">${produto?.categoria || '-'}</span></td>
                <td><span class="badge bg-info">${u.unidadeEmbalagem}</span></td>
                <td>${u.lote}</td>
                <td class="${vencido ? 'text-danger fw-bold' : ''}">${formatarData(u.validade)}</td>
                <td>${u.volume}</td>
                <td>${quantidadeFormatada} ${produto?.unidadeBase || 'UN'}</td>
                <td><span class="badge ${u.tipoEntrada === 'Recebimento' ? 'bg-info' : 'bg-secondary'}">${u.tipoEntrada || 'Manual'}</span></td>
                <td><span class="badge ${u.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${u.status}</span></td>
                <td>${u.destino || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="verUnidade('${u.id}')" title="Ver detalhes">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${u.status === 'Disponível' && u.quantidade > 0 ? `
                        <button class="btn btn-sm btn-warning" onclick="abrirModalTransferencia('${u.id}', '${u.sku}', '${u.lote}', '${u.validade}', '${produto?.nome || ''}', ${u.volume}, ${u.quantidade}, '${u.unidadeEmbalagem}', '${produto?.unidadeBase || 'UN'}', ${produto?.qtdPorEmbalagem || 1})" title="Dar baixa">
                            <i class="bi bi-arrow-right"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        }
    });
}

// ============================================
// FUNÇÃO ABRIR MODAL TRANSFERÊNCIA - ATUALIZADA
// ============================================
function abrirModalTransferencia(id, sku, lote, validade, produtoNome, volume, quantidade, unidade, unidadeBase, qtdPorEmbalagem) {
    const url = `baixa-view.html?id=${id}&sku=${sku}&lote=${lote}&validade=${validade}&produto=${encodeURIComponent(produtoNome)}&volume=${volume}&quantidade=${quantidade}&unidade=${unidade}&unidadeBase=${unidadeBase}&qtdPorEmbalagem=${qtdPorEmbalagem}`;
    
    window.open(url, '_blank', 'width=700,height=800');
}

// ============================================
// FUNÇÃO ATUALIZAR TABELA RECEBIMENTOS - SEM DEBUG
// ============================================
function atualizarTabelaRecebimentos(recebimentosFiltrados = null) {
    const tbody = document.getElementById('tabela-recebimentos');
    if (!tbody) return;
    
    const dados = recebimentosFiltrados || recebimentos;
    
    tbody.innerHTML = '';
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum recebimento encontrado</td></tr>';
        return;
    }
    
    // Mostrar os últimos 50 recebimentos em ordem reversa
    dados.slice(-50).reverse().forEach(r => {
        const tr = document.createElement('tr');
        
        // ============================================
        // BUSCAR PRODUTO COM DIFERENTES ESTRATÉGIAS
        // ============================================
        let produto = null;
        
        if (r.sku) {
            // Estratégia 1: Comparação exata
            produto = produtos.find(p => p.sku === r.sku);
            
            // Estratégia 2: Remover zeros à esquerda
            if (!produto) {
                const skuLimpo = String(r.sku).replace(/^0+/, '');
                produto = produtos.find(p => String(p.sku).replace(/^0+/, '') === skuLimpo);
            }
            
            // Estratégia 3: Adicionar zeros à esquerda
            if (!produto && !isNaN(r.sku)) {
                const skuComZeros = String(r.sku).padStart(8, '0');
                produto = produtos.find(p => p.sku === skuComZeros);
            }
            
            // Estratégia 4: Comparação como string sem espaços
            if (!produto) {
                const skuString = String(r.sku).trim();
                produto = produtos.find(p => String(p.sku).trim() === skuString);
            }
        }
        
        // ============================================
        // BUSCAR UNIDADES
        // ============================================
        let unidadeVolume = 'UN';
        let unidadeBase = 'UN';
        
        if (produto) {
            unidadeVolume = produto.tipoEmbalagem || 'UN';
            unidadeBase = produto.unidadeBase || 'UN';
        } else {
            // Fallback: tentar adivinhar pela descrição do produto
            if (r.produto) {
                const produtoPorNome = produtos.find(p => 
                    p.nome && r.produto && p.nome.includes(r.produto.substring(0, 10))
                );
                if (produtoPorNome) {
                    unidadeVolume = produtoPorNome.tipoEmbalagem || 'UN';
                    unidadeBase = produtoPorNome.unidadeBase || 'UN';
                }
            }
        }
        
        // Resumo do produto
        const resumoProduto = r.produto ? 
            (r.produto.length > 30 ? r.produto.substring(0, 30) + '...' : r.produto) : 
            '-';
        
        // Volume com unidade correta
        const volumeDisplay = r.volumeNumero ? 
            `${r.volumeNumero} ${unidadeVolume}` : 
            (r.volumeTexto ? `${r.volumeTexto} ${unidadeVolume}` : '-');
        
        // Quantidade com unidade base
        const quantidadeDisplay = (r.quantidadeTotal || 0).toFixed(2);
        
        tr.innerHTML = `
            <td><small class="text-warning">${r.idUnidade || '-'}</small></td>
            <td>${formatarData(r.data)}</td>
            <td>${r.nf || '-'}</td>
            <td>${r.fornecedor || '-'}</td>
            <td>${resumoProduto}</td>
            <td><strong class="text-info">${volumeDisplay}</strong></td>
            <td><strong class="text-warning">${quantidadeDisplay}</strong> ${unidadeBase}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="verRecebimento('${r.idUnidade}')">
                    <i class="bi bi-eye"></i> Ver
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================
// FUNÇÃO VER UNIDADE - COMPLETA E CORRIGIDA
// ============================================
function verUnidade(id) {
    unidadeAtual = unidades.find(u => u.id === id);
    if (!unidadeAtual) return;
    
    // Determinar a base da URL
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    
    // ============================================
    // CASO 1: UNIDADE MÚLTIPLA (vários produtos/volumes)
    // ============================================
    if (unidadeAtual.tipo === 'unidade-multipla') {
        document.getElementById('detalhe-id').textContent = unidadeAtual.id;
        document.getElementById('detalhe-nf').textContent = unidadeAtual.numeroNF || '-';
        document.getElementById('detalhe-fornecedor').textContent = unidadeAtual.fornecedor || '-';
        document.getElementById('detalhe-data').textContent = formatarData(unidadeAtual.dataRecebimento) || '-';
        document.getElementById('detalhe-status').innerHTML = `<span class="badge ${unidadeAtual.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${unidadeAtual.status}</span>`;
        document.getElementById('detalhe-total-volumes').textContent = unidadeAtual.totalVolumes;
        document.getElementById('detalhe-total-un').textContent = unidadeAtual.totalUN.toFixed(2);
        
        const qrContainer = document.getElementById('unidade-qr-code');
        qrContainer.innerHTML = '';
        
        // ============================================
        // CONSTRUIR URL COM TODOS OS DADOS EM JSON
        // ============================================
        
        // Preparar objeto com todos os dados da unidade
        const dadosCompletos = {
            id: unidadeAtual.id,
            produtos: unidadeAtual.produtos.map(p => ({
                nome: p.nome,
                sku: p.sku,
                tipoEmbalagem: p.tipoEmbalagem,
                volumes: p.volumes.map(v => ({
                    tipo: v.tipo,
                    qtdVolumes: v.qtdVolumes,
                    unPorEmbalagem: v.unPorEmbalagem,
                    totalUN: v.totalUN,
                    lote: v.lote,
                    validade: v.validade,
                    localizacao: v.localizacao
                }))
            })),
            totalVolumes: unidadeAtual.totalVolumes,
            totalUN: unidadeAtual.totalUN,
            numeroNF: unidadeAtual.numeroNF,
            fornecedor: unidadeAtual.fornecedor,
            dataRecebimento: unidadeAtual.dataRecebimento,
            status: unidadeAtual.status
        };
        
        // Converter para JSON e codificar para URL
        const dadosJSON = encodeURIComponent(JSON.stringify(dadosCompletos));
        const urlCompleta = `${baseUrl}qr-view.html?dados=${dadosJSON}`;
        
        setTimeout(() => {
            try {
                if (typeof QRCode !== 'undefined') {
                    new QRCode(qrContainer, {
                        text: urlCompleta,
                        width: 150,
                        height: 150,
                        colorDark: '#000000',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } else {
                    qrContainer.innerHTML = `
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlCompleta)}" 
                             alt="QR Code" 
                             style="width: 150px; height: 150px; border-radius: 8px; border: 2px solid #fbbf24;">
                    `;
                }
            } catch (e) {
                qrContainer.innerHTML = `
                    <div class="alert alert-warning p-2 text-center">
                        <i class="bi bi-exclamation-triangle"></i>
                        <p class="mb-1">Clique para ver o QR Code</p>
                        <button class="btn btn-sm btn-primary" onclick="verQRCodeCompleto()">
                            <i class="bi bi-qr-code"></i> Ver QR Code
                        </button>
                    </div>
                `;
            }
        }, 100);
        
        // Mostrar todos os produtos/volumes no modal
        const container = document.getElementById('detalhe-produtos-container');
        container.innerHTML = '';
        
        unidadeAtual.produtos.forEach((produto, pIndex) => {
            const produtoDiv = document.createElement('div');
            produtoDiv.className = 'card bg-dark mb-3';
            produtoDiv.innerHTML = `
                <div class="card-header text-warning">
                    <strong>${produto.nome}</strong> (SKU: ${produto.sku})
                </div>
                <div class="card-body">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Tipo</th>
                                <th>Lote</th>
                                <th>Validade</th>
                                <th>Qtd Volumes</th>
                                <th>UN/Vol</th>
                                <th>Total UN</th>
                                <th>Local</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${produto.volumes.map(v => `
                                <tr>
                                    <td><span class="badge ${v.tipo === 'padrao' ? 'bg-success' : 'bg-warning'}">${v.tipo === 'padrao' ? 'PADRÃO' : 'FORA'}</span></td>
                                    <td>${v.lote || '-'}</td>
                                    <td>${formatarData(v.validade) || '-'}</td>
                                    <td>${v.qtdVolumes}</td>
                                    <td>${v.unPorEmbalagem}</td>
                                    <td class="text-warning">${v.totalUN.toFixed(2)}</td>
                                    <td>${v.localizacao || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(produtoDiv);
        });
    } 
    // ============================================
    // CASO 2: UNIDADE SIMPLES (formato original)
    // ============================================
    else {
        const produto = produtos.find(p => p.sku === unidadeAtual.sku);
        
        document.getElementById('detalhe-id').textContent = unidadeAtual.id;
        document.getElementById('detalhe-nf').textContent = unidadeAtual.numeroNF || '-';
        document.getElementById('detalhe-fornecedor').textContent = unidadeAtual.fornecedor || '-';
        document.getElementById('detalhe-data').textContent = formatarData(unidadeAtual.dataRecebimento) || '-';
        document.getElementById('detalhe-status').innerHTML = `<span class="badge ${unidadeAtual.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${unidadeAtual.status}</span>`;
        document.getElementById('detalhe-total-volumes').textContent = unidadeAtual.volume || 1;
        document.getElementById('detalhe-total-un').textContent = (unidadeAtual.quantidade || 0).toFixed(2);
        
        const qrContainer = document.getElementById('unidade-qr-code');
        qrContainer.innerHTML = '';
        
        // ============================================
        // GERAR QR CODE PARA UNIDADE SIMPLES (formato original)
        // ============================================
        const urlCompleta = `${baseUrl}qr-view.html?id=${unidadeAtual.id}&sku=${unidadeAtual.sku}&lote=${unidadeAtual.lote || ''}&validade=${unidadeAtual.validade || ''}&produto=${encodeURIComponent(produto?.nome || '')}&volume=${unidadeAtual.volume || 1}&quantidade=${unidadeAtual.quantidade || 0}&unidade=${unidadeAtual.unidadeEmbalagem || 'UN'}&unidadeBase=${produto?.unidadeBase || 'UN'}&qtdPorEmbalagem=${produto?.qtdPorEmbalagem || 1}`;
        
        setTimeout(() => {
            try {
                if (typeof QRCode !== 'undefined') {
                    new QRCode(qrContainer, {
                        text: urlCompleta,
                        width: 150,
                        height: 150,
                        colorDark: '#000000',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } else {
                    qrContainer.innerHTML = `
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlCompleta)}" 
                             alt="QR Code" 
                             style="width: 150px; height: 150px; border-radius: 8px; border: 2px solid #fbbf24;">
                    `;
                }
            } catch (e) {
                qrContainer.innerHTML = `
                    <div class="alert alert-warning p-2 text-center">
                        <i class="bi bi-exclamation-triangle"></i>
                        <p class="mb-1">Clique para ver o QR Code</p>
                        <button class="btn btn-sm btn-primary" onclick="verQRCodeCompleto()">
                            <i class="bi bi-qr-code"></i> Ver QR Code
                        </button>
                    </div>
                `;
            }
        }, 100);
        
        const container = document.getElementById('detalhe-produtos-container');
        container.innerHTML = `
            <div class="card bg-dark">
                <div class="card-header text-warning">
                    <strong>${produto ? produto.nome : 'Produto não encontrado'}</strong> (SKU: ${unidadeAtual.sku})
                </div>
                <div class="card-body">
                    <p><strong>Lote:</strong> ${unidadeAtual.lote || '-'}</p>
                    <p><strong>Validade:</strong> ${formatarData(unidadeAtual.validade) || '-'}</p>
                    <p><strong>Volume:</strong> ${unidadeAtual.volume || 1} ${unidadeAtual.unidadeEmbalagem || ''}</p>
                    <p><strong>Quantidade:</strong> ${(unidadeAtual.quantidade || 0).toFixed(2)} ${produto?.unidadeBase || 'UN'}</p>
                    <p><strong>Localização:</strong> ${unidadeAtual.localizacao || '-'}</p>
                    <p><strong>Fora do padrão:</strong> ${unidadeAtual.foraPadrao ? 'Sim' : 'Não'}</p>
                    <p><strong>Observações:</strong> ${unidadeAtual.observacoes || '-'}</p>
                </div>
            </div>
        `;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalDetalhesUnidade'));
    modal.show();
}

// Ver QR Code completo (CORRIGIDO - usa o mesmo formato da verUnidade)
function verQRCodeCompleto() {
    if (!unidadeAtual) return;
    
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    
    let urlCompleta;
    
    if (unidadeAtual.tipo === 'unidade-multipla') {
        // ============================================
        // CASO MÚLTIPLO: usar o mesmo formato da verUnidade
        // ============================================
        const dadosCompletos = {
            id: unidadeAtual.id,
            produtos: unidadeAtual.produtos.map(p => ({
                nome: p.nome,
                sku: p.sku,
                tipoEmbalagem: p.tipoEmbalagem,
                volumes: p.volumes.map(v => ({
                    tipo: v.tipo,
                    qtdVolumes: v.qtdVolumes,
                    unPorEmbalagem: v.unPorEmbalagem,
                    totalUN: v.totalUN,
                    lote: v.lote,
                    validade: v.validade,
                    localizacao: v.localizacao
                }))
            })),
            totalVolumes: unidadeAtual.totalVolumes,
            totalUN: unidadeAtual.totalUN
        };
        
        const dadosJSON = encodeURIComponent(JSON.stringify(dadosCompletos));
        urlCompleta = `${baseUrl}qr-view.html?dados=${dadosJSON}`;
        
    } else {
        // ============================================
        // CASO SIMPLES: formato original (para não quebrar nada)
        // ============================================
        const produto = produtos.find(p => p.sku === unidadeAtual.sku);
        urlCompleta = `${baseUrl}qr-view.html?id=${unidadeAtual.id}&sku=${unidadeAtual.sku}&lote=${unidadeAtual.lote || ''}&validade=${unidadeAtual.validade || ''}&produto=${encodeURIComponent(produto?.nome || '')}&volume=${unidadeAtual.volume || 1}&quantidade=${unidadeAtual.quantidade || 0}&unidade=${unidadeAtual.unidadeEmbalagem || 'UN'}&unidadeBase=${produto?.unidadeBase || 'UN'}&qtdPorEmbalagem=${produto?.qtdPorEmbalagem || 1}`;
    }
    
    // Abre o qr-view.html com a URL correta
    window.open(urlCompleta, '_blank');
}

// Filtrar unidades
function filtrarUnidades() {
    const skuFiltro = document.getElementById('filtro-produto-unidades')?.value;
    const statusFiltro = document.getElementById('filtro-status-unidades')?.value;
    const destinoFiltro = document.getElementById('filtro-destino-unidades')?.value;
    const embalagemFiltro = document.getElementById('filtro-embalagem-unidades')?.value;
    
    let unidadesFiltradas = unidades.filter(u => u.quantidade > 0 || u.produtos);
    
    if (skuFiltro) {
        unidadesFiltradas = unidadesFiltradas.filter(u => {
            if (u.tipo === 'unidade-multipla') {
                return u.produtos.some(p => p.sku === skuFiltro);
            } else {
                return u.sku === skuFiltro;
            }
        });
    }
    
    if (statusFiltro) {
        if (statusFiltro === 'Vencido') {
            const hoje = new Date();
            unidadesFiltradas = unidadesFiltradas.filter(u => {
                if (u.tipo === 'unidade-multipla') {
                    let vencido = false;
                    u.produtos.forEach(p => {
                        p.volumes.forEach(v => {
                            if (v.validade) {
                                const validade = new Date(v.validade);
                                if (validade < hoje) vencido = true;
                            }
                        });
                    });
                    return vencido;
                } else {
                    if (!u.validade) return false;
                    const validade = new Date(u.validade);
                    return validade < hoje;
                }
            });
        } else {
            unidadesFiltradas = unidadesFiltradas.filter(u => u.status === statusFiltro);
        }
    }
    
    if (destinoFiltro) {
        unidadesFiltradas = unidadesFiltradas.filter(u => u.destino === destinoFiltro);
    }
    
    if (embalagemFiltro) {
        unidadesFiltradas = unidadesFiltradas.filter(u => {
            if (u.tipo === 'unidade-multipla') {
                return u.produtos.some(p => p.tipoEmbalagem === embalagemFiltro);
            } else {
                return u.unidadeEmbalagem === embalagemFiltro;
            }
        });
    }
    
    atualizarTabelaUnidades(unidadesFiltradas);
}

// Configurar QR Code scanner
function setupQRCode() {
    const qrReaderElement = document.getElementById('qr-reader');
    if (!qrReaderElement) return;
    
    if (typeof Html5Qrcode === 'undefined') {
        qrReaderElement.innerHTML = '<div class="alert alert-danger">Erro ao carregar leitor QR Code.</div>';
        return;
    }
    
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            const html5QrCode = new Html5Qrcode("qr-reader");
            
            const qrCodeSuccessCallback = (decodedText) => {
                const unidade = unidades.find(u => u.id === decodedText);
                if (unidade) {
                    verUnidade(unidade.id);
                    document.getElementById('qr-resultado').innerHTML = '<div class="alert alert-success">Unidade encontrada!</div>';
                } else {
                    document.getElementById('qr-resultado').innerHTML = `<div class="alert alert-danger">Unidade não encontrada: ${decodedText}</div>`;
                }
            };
            
            html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, qrCodeSuccessCallback);
        } else {
            qrReaderElement.innerHTML = '<div class="alert alert-warning">Nenhuma câmera encontrada.</div>';
        }
    }).catch(err => {
        qrReaderElement.innerHTML = '<div class="alert alert-warning">Erro ao acessar câmera.</div>';
    });
}

// ============================================
// FUNÇÃO ATUALIZAR TABELA MOVIMENTAÇÕES
// ============================================
function atualizarTabelaMovimentacoes(movFiltradas = null) {
    const tbody = document.getElementById('tabela-movimentacoes');
    if (!tbody) return;
    
    const dados = movFiltradas || movimentacoes;
    
    tbody.innerHTML = '';
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhuma movimentação registrada</td></tr>';
        return;
    }
    
    dados.slice(-50).reverse().forEach(mov => {
        const produto = produtos.find(p => p.sku === mov.sku);
        const tr = document.createElement('tr');
        
        // Formatar volume com unidade
        const volumeDisplay = mov.volume ? `${mov.volume} ${mov.unidadeEmbalagem || ''}` : '-';
        
        tr.innerHTML = `
            <td>${formatarData(mov.data)}</td>
            <td><span class="badge ${mov.tipo === 'Entrada' ? 'bg-success' : mov.tipo === 'Saída' ? 'bg-warning' : 'bg-info'}">${mov.tipo}</span></td>
            <td><small>${mov.idUnidade}</small></td>
            <td>${produto ? produto.nome : mov.sku}</td>
            <td>${volumeDisplay}</td>
            <td>${mov.unidadeEmbalagem || ''}</td>
            <td>${mov.quantidade}</td>
            <td>${mov.destino || '-'}</td>
            <td>${mov.responsavel}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Filtrar movimentações
function filtrarMovimentacoes() {
    const dataInicio = document.getElementById('filtro-data-inicio').value;
    const dataFim = document.getElementById('filtro-data-fim').value;
    const tipo = document.getElementById('filtro-tipo-movimentacao').value;
    const destino = document.getElementById('filtro-destino-movimentacao').value;
    
    let filtradas = [...movimentacoes];
    
    if (dataInicio) filtradas = filtradas.filter(m => m.data >= dataInicio);
    if (dataFim) filtradas = filtradas.filter(m => m.data <= dataFim);
    if (tipo) filtradas = filtradas.filter(m => m.tipo === tipo);
    if (destino) filtradas = filtradas.filter(m => m.destino === destino);
    
    atualizarTabelaMovimentacoes(filtradas);
}

// Atualizar últimas movimentações
function atualizarUltimasMovimentacoes() {
    const container = document.getElementById('ultimas-movimentacoes');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (movimentacoes.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhuma movimentação recente</p>';
        return;
    }
    
    movimentacoes.slice(-10).reverse().forEach(mov => {
        const produto = produtos.find(p => p.sku === mov.sku);
        const div = document.createElement('div');
        div.className = `alert ${mov.tipo === 'Entrada' ? 'alert-success' : mov.tipo === 'Saída' ? 'alert-warning' : 'alert-info'} mb-2`;
        div.innerHTML = `
            <div class="d-flex justify-content-between">
                <span><strong>${formatarData(mov.data)}</strong> - ${mov.tipo}</span>
                <span>${mov.volume} ${mov.unidadeEmbalagem}</span>
            </div>
            <small>${produto ? produto.nome : mov.sku} - ${mov.idUnidade}</small>
            ${mov.destino ? `<br><small>Destino: ${mov.destino}</small>` : ''}
        `;
        container.appendChild(div);
    });
}

// Atualizar gráficos do painel
function atualizarGraficosPainel() {
    const ctxCategorias = document.getElementById('grafico-categorias');
    if (ctxCategorias) {
        if (graficoCategorias) graficoCategorias.destroy();
        
        const categoriasData = categorias.map(cat => {
            const produtosCat = produtos.filter(p => p.categoria === cat.nome);
            return produtosCat.length;
        });
        
        graficoCategorias = new Chart(ctxCategorias, {
            type: 'doughnut',
            data: {
                labels: categorias.map(c => c.nome),
                datasets: [{
                    data: categoriasData,
                    backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444', '#10b981']
                }]
            }
        });
    }
}

// Gerar relatórios
function gerarRelatorios() {
    const unidadesAtivas = unidades.filter(u => u.quantidade > 0 || u.produtos);
    
    const ctxCategorias = document.getElementById('grafico-relatorio-categorias');
    if (ctxCategorias) {
        const categoriasData = categorias.map(cat => {
            const produtosCat = produtos.filter(p => p.categoria === cat.nome);
            return produtosCat.length;
        });
        
        new Chart(ctxCategorias, {
            type: 'bar',
            data: {
                labels: categorias.map(c => c.nome),
                datasets: [{
                    label: 'Produtos por Categoria',
                    data: categoriasData,
                    backgroundColor: '#3b82f6'
                }]
            }
        });
    }
    
    const ctxStatus = document.getElementById('grafico-status');
    if (ctxStatus) {
        let disponiveis = 0;
        let bloqueados = 0;
        let transferidos = 0;
        
        unidadesAtivas.forEach(u => {
            if (u.tipo === 'unidade-multipla') {
                if (u.status === 'Disponível') disponiveis++;
                else if (u.status === 'Bloqueado') bloqueados++;
                if (u.destino) transferidos++;
            } else {
                if (u.status === 'Disponível') disponiveis++;
                else if (u.status === 'Bloqueado') bloqueados++;
                if (u.destino) transferidos++;
            }
        });
        
        new Chart(ctxStatus, {
            type: 'pie',
            data: {
                labels: ['Disponíveis', 'Bloqueados', 'Transferidos'],
                datasets: [{
                    data: [disponiveis, bloqueados, transferidos],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b']
                }]
            }
        });
    }
    
    const ctxDestinos = document.getElementById('grafico-destinos');
    if (ctxDestinos) {
        const destinosData = destinos.map(d => {
            return unidadesAtivas.filter(u => u.destino === d).length;
        });
        
        new Chart(ctxDestinos, {
            type: 'bar',
            data: {
                labels: destinos,
                datasets: [{
                    label: 'Unidades por Destino',
                    data: destinosData,
                    backgroundColor: '#f59e0b'
                }]
            }
        });
    }
    
    const containerEstoque = document.getElementById('lista-estoque-baixo');
    if (containerEstoque) {
        const estoqueBaixo = produtos.filter(p => {
            let total = 0;
            unidadesAtivas.forEach(u => {
                if (u.tipo === 'unidade-multipla') {
                    u.produtos.forEach(prod => {
                        if (prod.sku === p.sku) {
                            prod.volumes.forEach(v => total += v.totalUN);
                        }
                    });
                } else if (u.sku === p.sku) {
                    total += u.quantidade;
                }
            });
            return total < 10;
        });
        
        if (estoqueBaixo.length === 0) {
            containerEstoque.innerHTML = '<p class="text-success">✅ Todos os produtos têm estoque adequado</p>';
        } else {
            containerEstoque.innerHTML = '<ul class="list-group">';
            estoqueBaixo.forEach(p => {
                let total = 0;
                unidadesAtivas.forEach(u => {
                    if (u.tipo === 'unidade-multipla') {
                        u.produtos.forEach(prod => {
                            if (prod.sku === p.sku) {
                                prod.volumes.forEach(v => total += v.totalUN);
                            }
                        });
                    } else if (u.sku === p.sku) {
                        total += u.quantidade;
                    }
                });
                containerEstoque.innerHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        ${p.nome} (${p.sku})
                        <span class="badge bg-danger rounded-pill">${total} UN</span>
                    </li>
                `;
            });
            containerEstoque.innerHTML += '</ul>';
        }
    }
    
    const containerValidades = document.getElementById('lista-validades');
    if (containerValidades) {
        const hoje = new Date();
        const validades = [];
        
        unidadesAtivas.forEach(u => {
            if (u.tipo === 'unidade-multipla') {
                u.produtos.forEach(p => {
                    p.volumes.forEach(v => {
                        if (v.validade) {
                            const dias = Math.ceil((new Date(v.validade) - hoje) / (1000 * 60 * 60 * 24));
                            if (dias <= 30) {
                                validades.push({
                                    ...u,
                                    produtoNome: p.nome,
                                    volume: v.qtdVolumes,
                                    unidadeEmbalagem: p.tipoEmbalagem,
                                    dias: dias
                                });
                            }
                        }
                    });
                });
            } else {
                if (u.validade) {
                    const dias = Math.ceil((new Date(u.validade) - hoje) / (1000 * 60 * 60 * 24));
                    if (dias <= 30) {
                        const produto = produtos.find(p => p.sku === u.sku);
                        validades.push({
                            ...u,
                            produtoNome: produto?.nome || u.sku,
                            dias: dias
                        });
                    }
                }
            }
        });
        
        validades.sort((a, b) => a.dias - b.dias);
        
        if (validades.length === 0) {
            containerValidades.innerHTML = '<p class="text-success">✅ Nenhum produto próximo ao vencimento</p>';
        } else {
            containerValidades.innerHTML = '<ul class="list-group">';
            validades.slice(0, 10).forEach(u => {
                containerValidades.innerHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center ${u.dias <= 7 ? 'list-group-item-danger' : u.dias <= 15 ? 'list-group-item-warning' : ''}">
                        ${u.produtoNome} - ${u.unidadeEmbalagem} ${u.volume}
                        <span class="badge ${u.dias <= 7 ? 'bg-danger' : 'bg-warning'} rounded-pill">${u.dias} dias</span>
                    </li>
                `;
            });
            containerValidades.innerHTML += '</ul>';
        }
    }
}

// Funções auxiliares
function getCategoriaClass(categoria) {
    const classes = {
        'Insumos': 'border-primary',
        'Embalagem Papelão': 'border-warning',
        'Embalagem Filme': 'border-info',
        'Embalagem Sacaria': 'border-success'
    };
    return classes[categoria] || 'border-secondary';
}

function getCategoriaBadgeClass(categoria) {
    const classes = {
        'Insumos': 'bg-primary',
        'Embalagem Papelão': 'bg-warning text-dark',
        'Embalagem Filme': 'bg-info',
        'Embalagem Sacaria': 'bg-success'
    };
    return classes[categoria] || 'bg-secondary';
}

// Formatar data
function formatarData(data) {
    if (!data) return '';
    
    if (typeof data === 'string' && data.includes('-')) {
        const partes = data.split('-');
        if (partes.length === 3) {
            const ano = parseInt(partes[0]);
            const mes = parseInt(partes[1]);
            const dia = parseInt(partes[2]);
            return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
        }
    }
    
    try {
        const d = new Date(data);
        if (isNaN(d.getTime())) return data;
        
        const dia = d.getDate().toString().padStart(2, '0');
        const mes = (d.getMonth() + 1).toString().padStart(2, '0');
        const ano = d.getFullYear();
        
        return `${dia}/${mes}/${ano}`;
    } catch (e) {
        return data;
    }
}

// ============================================
// FUNÇÕES DE BUSCA DE PRODUTOS NO MODAL (ORIGINAIS)
// ============================================

// Preencher a lista de produtos
function preencherListaProdutos() {
    const container = document.getElementById('lista-produtos');
    if (!container) return;
    
    container.innerHTML = '';
    
    produtos.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(p => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action bg-dark text-white border-secondary';
        item.setAttribute('data-sku', p.sku);
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>${p.nome}</span>
                <small class="text-muted">${p.sku} - ${p.tipoEmbalagem}</small>
            </div>
            <small class="text-info">${p.categoria}</small>
        `;
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            selecionarProduto(p.sku, p.nome, p.tipoEmbalagem, p.qtdPorEmbalagem, p.unidadeBase);
        });
        
        container.appendChild(item);
    });
}

// Selecionar um produto
function selecionarProduto(sku, nome, tipoEmbalagem, qtdPorEmbalagem, unidadeBase) {
    document.getElementById('unidade-sku').value = sku;
    document.getElementById('busca-produto').value = nome;
    document.getElementById('lista-produtos-container').style.display = 'none';
    
    document.getElementById('volume-label').textContent = `Volume (${tipoEmbalagem})`;
    document.getElementById('volume-descricao').textContent = `Número de ${tipoEmbalagem}`;
    document.getElementById('quantidade-unidade').textContent = `(${unidadeBase})`;
    document.getElementById('quantidade-descricao').textContent = `Total em ${unidadeBase}`;
    
    calcularQuantidadeAutomatica();
}

// Filtrar produtos conforme digitação
function filtrarProdutosLista() {
    const termo = document.getElementById('busca-produto').value.toLowerCase();
    const container = document.getElementById('lista-produtos');
    const items = container.getElementsByClassName('list-group-item');
    let hasVisible = false;
    
    Array.from(items).forEach(item => {
        const texto = item.textContent.toLowerCase();
        if (texto.includes(termo)) {
            item.style.display = 'block';
            hasVisible = true;
        } else {
            item.style.display = 'none';
        }
    });
    
    document.getElementById('lista-produtos-container').style.display = hasVisible ? 'block' : 'none';
}

// Event listener para o campo de busca
document.getElementById('busca-produto')?.addEventListener('keyup', filtrarProdutosLista);
document.getElementById('busca-produto')?.addEventListener('focus', () => {
    if (document.getElementById('busca-produto').value) {
        filtrarProdutosLista();
    }
});

// ============================================
// FUNÇÕES DE BUSCA DE PRODUTOS NO RECEBIMENTO (ORIGINAIS)
// ============================================

// Preencher a lista de produtos no recebimento
function preencherListaProdutosRecebimento() {
    const container = document.getElementById('lista-recebimento-produtos');
    if (!container) return;
    
    container.innerHTML = '';
    
    produtos.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(p => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action bg-dark text-white border-secondary';
        item.setAttribute('data-sku', p.sku);
        item.setAttribute('data-tipo', p.tipoEmbalagem);
        item.setAttribute('data-qtd', p.qtdPorEmbalagem);
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>${p.nome}</span>
                <small class="text-muted">${p.sku}</small>
            </div>
            <small class="text-info">${p.categoria} - ${p.tipoEmbalagem}</small>
        `;
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            selecionarProdutoRecebimento(p.sku, p.nome, p.tipoEmbalagem, p.qtdPorEmbalagem);
        });
        
        container.appendChild(item);
    });
}

// Selecionar um produto no recebimento
function selecionarProdutoRecebimento(sku, nome, tipoEmbalagem, qtdPorEmbalagem) {
    document.getElementById('recebimento-sku').value = sku;
    document.getElementById('busca-recebimento-produto').value = nome;
    document.getElementById('lista-recebimento-container').style.display = 'none';
    
    document.getElementById('recebimento-produto').value = nome;
    document.getElementById('recebimento-unidade').value = tipoEmbalagem;
    document.getElementById('recebimento-qtd-embalagem').value = qtdPorEmbalagem;
    
    calcularQuantidadeRecebimento();
}

// Filtrar produtos no recebimento
function filtrarProdutosRecebimento() {
    const termo = document.getElementById('busca-recebimento-produto').value.toLowerCase();
    const container = document.getElementById('lista-recebimento-produtos');
    if (!container) return;
    
    const items = container.getElementsByClassName('list-group-item');
    let hasVisible = false;
    
    Array.from(items).forEach(item => {
        const texto = item.textContent.toLowerCase();
        if (texto.includes(termo)) {
            item.style.display = 'block';
            hasVisible = true;
        } else {
            item.style.display = 'none';
        }
    });
    
    document.getElementById('lista-recebimento-container').style.display = hasVisible ? 'block' : 'none';
}

// Event listeners para o campo de busca
document.getElementById('busca-recebimento-produto')?.addEventListener('keyup', filtrarProdutosRecebimento);
document.getElementById('busca-recebimento-produto')?.addEventListener('focus', () => {
    if (document.getElementById('busca-recebimento-produto').value) {
        filtrarProdutosRecebimento();
    }
});

// ============================================
// FUNÇÕES DE RECEBIMENTO COM MÚLTIPLOS PRODUTOS (ORIGINAIS)
// ============================================

let contadorItens = 0;
let produtosPorItem = {};

// Adicionar novo item ao recebimento
function adicionarItemRecebimento() {
    contadorItens++;
    const container = document.getElementById('itens-recebimento-container');
    const novoItem = document.createElement('div');
    novoItem.className = 'item-recebimento mb-3 p-3 border rounded';
    novoItem.id = `item-recebimento-${contadorItens}`;
    
    novoItem.innerHTML = `
        <div class="d-flex justify-content-between mb-2">
            <h6 class="text-info">Produto ${contadorItens + 1}</h6>
            <button type="button" class="btn btn-sm btn-danger" onclick="removerItemRecebimento(${contadorItens})">
                <i class="bi bi-trash"></i>
            </button>
        </div>
        <div class="row">
            <div class="col-md-4 mb-2">
                <label class="form-label">Buscar Produto</label>
                <input type="text" class="form-control busca-produto-recebimento" 
                       placeholder="Digite para buscar..." data-index="${contadorItens}">
                <input type="hidden" class="item-sku" id="item-sku-${contadorItens}" required>
            </div>
            <div class="col-md-2 mb-2">
                <label class="form-label">Lote</label>
                <input type="text" class="form-control item-lote" id="item-lote-${contadorItens}" required>
            </div>
            <div class="col-md-2 mb-2">
                <label class="form-label">Validade</label>
                <input type="date" class="form-control item-validade" id="item-validade-${contadorItens}" required>
            </div>
            <div class="col-md-2 mb-2">
                <label class="form-label">Volume</label>
                <input type="number" class="form-control item-volume" id="item-volume-${contadorItens}" min="1" value="1" step="any" required>
                <small class="text-muted">Qtd de embalagens</small>
            </div>
            <div class="col-md-2 mb-2">
                <label class="form-label">Quantidade</label>
                <input type="number" class="form-control item-quantidade" id="item-quantidade-${contadorItens}" step="any" required>
                <small class="text-muted item-unidade" id="item-unidade-${contadorItens}">UN</small>
            </div>
        </div>
        <div class="row">
            <div class="col-md-4 mb-2">
                <div class="lista-produtos-recebimento" id="lista-produtos-${contadorItens}" 
                     style="max-height: 150px; overflow-y: auto; border: 1px solid #2d3748; border-radius: 8px; background-color: #1e293b; display: none;">
                    <!-- Lista de produtos será inserida aqui -->
                </div>
            </div>
            <div class="col-md-4 mb-2">
                <label class="form-label">Unidade de Medida</label>
                <input type="text" class="form-control item-unidade-medida" id="item-unidade-medida-${contadorItens}" readonly>
            </div>
            <div class="col-md-4 mb-2">
                <label class="form-label">Localização</label>
                <input type="text" class="form-control item-localizacao" id="item-localizacao-${contadorItens}">
            </div>
        </div>
    `;
    
    container.appendChild(novoItem);
    
    configurarBuscaProduto(contadorItens);
    configurarCalculoQuantidade(contadorItens);
}

// Remover item do recebimento
function removerItemRecebimento(index) {
    const item = document.getElementById(`item-recebimento-${index}`);
    if (item) {
        item.remove();
        delete produtosPorItem[index];
    }
}

// Configurar busca de produto para um item específico
function configurarBuscaProduto(index) {
    const inputBusca = document.querySelector(`.busca-produto-recebimento[data-index="${index}"]`);
    const listaContainer = document.getElementById(`lista-produtos-${index}`);
    
    if (!inputBusca || !listaContainer) return;
    
    inputBusca.addEventListener('keyup', function() {
        const termo = this.value.toLowerCase();
        const lista = document.getElementById(`lista-produtos-${index}`);
        
        if (lista.children.length === 0) {
            produtos.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(p => {
                const item = document.createElement('a');
                item.href = '#';
                item.className = 'list-group-item list-group-item-action bg-dark text-white border-secondary';
                item.setAttribute('data-sku', p.sku);
                item.setAttribute('data-tipo', p.tipoEmbalagem);
                item.setAttribute('data-qtd', p.qtdPorEmbalagem);
                item.setAttribute('data-unidade', p.unidadeBase);
                item.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <span>${p.nome}</span>
                        <small class="text-muted">${p.sku}</small>
                    </div>
                    <small class="text-info">${p.categoria} - ${p.tipoEmbalagem}</small>
                `;
                
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    selecionarProdutoItem(index, p.sku, p.nome, p.tipoEmbalagem, p.qtdPorEmbalagem, p.unidadeBase);
                });
                
                lista.appendChild(item);
            });
        }
        
        const items = lista.getElementsByClassName('list-group-item');
        let hasVisible = false;
        
        Array.from(items).forEach(item => {
            const texto = item.textContent.toLowerCase();
            if (texto.includes(termo)) {
                item.style.display = 'block';
                hasVisible = true;
            } else {
                item.style.display = 'none';
            }
        });
        
        listaContainer.style.display = hasVisible ? 'block' : 'none';
    });
    
    inputBusca.addEventListener('focus', function() {
        if (this.value) {
            const lista = document.getElementById(`lista-produtos-${index}`);
            if (lista.children.length === 0) {
                const event = new Event('keyup');
                inputBusca.dispatchEvent(event);
            } else {
                listaContainer.style.display = 'block';
            }
        }
    });
}

// Selecionar produto em um item específico
function selecionarProdutoItem(index, sku, nome, tipoEmbalagem, qtdPorEmbalagem, unidadeBase) {
    document.getElementById(`item-sku-${index}`).value = sku;
    document.querySelector(`.busca-produto-recebimento[data-index="${index}"]`).value = nome;
    document.getElementById(`lista-produtos-${index}`).style.display = 'none';
    
    document.getElementById(`item-unidade-medida-${index}`).value = tipoEmbalagem;
    
    produtosPorItem[index] = {
        sku: sku,
        nome: nome,
        tipoEmbalagem: tipoEmbalagem,
        qtdPorEmbalagem: qtdPorEmbalagem,
        unidadeBase: unidadeBase
    };
    
    document.getElementById(`item-unidade-${index}`).textContent = unidadeBase;
    
    calcularQuantidadeItem(index);
}

// Configurar cálculo de quantidade
function configurarCalculoQuantidade(index) {
    const volumeInput = document.getElementById(`item-volume-${index}`);
    const quantidadeInput = document.getElementById(`item-quantidade-${index}`);
    
    if (volumeInput) {
        volumeInput.addEventListener('input', function() {
            calcularQuantidadeItem(index);
        });
    }
}

// Calcular quantidade para um item
function calcularQuantidadeItem(index) {
    const produto = produtosPorItem[index];
    if (!produto) return;
    
    const volume = parseFloat(document.getElementById(`item-volume-${index}`)?.value) || 1;
    const quantidade = volume * (produto.qtdPorEmbalagem || 1);
    
    const quantidadeInput = document.getElementById(`item-quantidade-${index}`);
    if (quantidadeInput) {
        quantidadeInput.value = quantidade.toFixed(2);
    }
}

// Inicializar o primeiro item
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar apenas se os elementos principais existirem
    carregarDados();
    setupEventListeners();
    preencherFiltros();
    
    // Inicializar volumes APENAS se o elemento existir
    const volumeRow0 = document.getElementById('volume-row-0');
    if (volumeRow0) {
        volumesData[0] = {
            tipo: 'padrao',
            qtd: 10,
            unPorEmbalagem: 250,
            lote: '',
            validade: '',
            localizacao: ''
        };
    }
});
























