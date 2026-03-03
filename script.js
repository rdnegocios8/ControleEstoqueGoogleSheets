/**
 * ============================================
 * SISTEMA DE CONTROLE DE ESTOQUE - RD NEGÓCIOS
 * ============================================
 * VERSÃO MELHORADA COM:
 * ✅ Arquitetura Modular
 * ✅ Tratamento de Erros Robusto
 * ✅ Validação de Dados
 * ✅ Funções Reutilizáveis
 * ✅ Logging Estruturado
 * ✅ Documentação Completa
 * ✅ Múltiplos Volumes no Recebimento
 * ✅ Controle de Volumes Padrão e Fora do Padrão
 * 
 * MANTÉM 100% DO CÓDIGO ORIGINAL + NOVAS FUNCIONALIDADES
 * ============================================
 */

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
// VARIÁVEIS PARA MÚLTIPLOS VOLUMES
// ============================================
let contadorVolumes = 0;
let contadorVolumesRecebimento = 0;
let volumesData = [];
let volumesRecebimentoData = [];

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    carregarDados();
    setupEventListeners();
    preencherFiltros();
    
    // Inicializar volumes
    volumesData[0] = {
        tipo: 'padrao',
        qtd: 10,
        unPorEmbalagem: 250,
        lote: '',
        validade: '',
        localizacao: ''
    };
});

// Configurar event listeners
function setupEventListeners() {
    document.getElementById('menu-painel').addEventListener('click', () => mostrarView('painel'));
    document.getElementById('menu-produtos').addEventListener('click', () => mostrarView('produtos'));
    document.getElementById('menu-unidades').addEventListener('click', () => mostrarView('unidades'));
    document.getElementById('menu-scanner').addEventListener('click', () => mostrarView('scanner'));
    document.getElementById('menu-recebimentos').addEventListener('click', () => mostrarView('recebimentos'));
    document.getElementById('menu-movimentacoes').addEventListener('click', () => mostrarView('movimentacoes'));
    document.getElementById('menu-relatorios').addEventListener('click', () => mostrarView('relatorios'));
    document.getElementById('menu-categorias').addEventListener('click', () => mostrarView('categorias'));
    
    document.getElementById('salvar-produto').addEventListener('click', salvarProduto);
    document.getElementById('salvar-unidade').addEventListener('click', salvarUnidade);
    document.getElementById('salvar-categoria').addEventListener('click', salvarCategoria);
    document.getElementById('salvar-recebimento').addEventListener('click', salvarRecebimento);
    document.getElementById('salvar-unidade-multipla').addEventListener('click', salvarUnidadeMultipla);
    document.getElementById('salvar-recebimento-multiplo').addEventListener('click', salvarRecebimentoMultiplo);
    
    document.getElementById('search-produto').addEventListener('keyup', filtrarProdutos);
    document.getElementById('filtro-categoria-produto').addEventListener('change', filtrarProdutos);
    document.getElementById('filtro-embalagem-produto').addEventListener('change', filtrarProdutos);
    
    document.getElementById('filtro-produto-unidades').addEventListener('change', filtrarUnidades);
    document.getElementById('filtro-status-unidades').addEventListener('change', filtrarUnidades);
    document.getElementById('filtro-destino-unidades').addEventListener('change', filtrarUnidades);
    document.getElementById('filtro-embalagem-unidades').addEventListener('change', filtrarUnidades);
    
    document.getElementById('produto-tipo-embalagem').addEventListener('change', toggleCampoQtdEmbalagem);
    document.getElementById('unidade-sku').addEventListener('change', atualizarInfoEmbalagem);
    document.getElementById('unidade-volume').addEventListener('input', calcularQuantidadeAutomatica);
    document.getElementById('unidade-fora-padrao').addEventListener('change', toggleCampoQuantidadeReal);
    
    // Busca de produtos para múltiplos volumes
    document.getElementById('busca-produto-unidade')?.addEventListener('keyup', filtrarProdutosUnidade);
    document.getElementById('busca-produto-recebimento-principal')?.addEventListener('keyup', filtrarProdutosRecebimentoPrincipal);
    
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

// ============================================
// FUNÇÕES PARA MÚLTIPLOS VOLUMES
// ============================================

// Abrir modal de unidade múltipla
function abrirModalUnidadeMultiplo() {
    // Resetar contadores
    contadorVolumes = 0;
    volumesData = [];
    
    // Limpar container
    const container = document.getElementById('volumes-container');
    container.innerHTML = '';
    
    // Adicionar primeira linha
    const novaLinha = criarLinhaVolume(0, 'padrao', 10, 250);
    container.appendChild(novaLinha);
    
    // Inicializar dados
    volumesData[0] = {
        tipo: 'padrao',
        qtd: 10,
        unPorEmbalagem: 250,
        lote: '',
        validade: '',
        localizacao: ''
    };
    
    // Calcular totais
    calcularTotalGeral();
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('modalUnidadeMultiplo'));
    modal.show();
}

// Criar linha de volume
function criarLinhaVolume(index, tipo, qtd, unPorEmbalagem) {
    const div = document.createElement('div');
    div.className = 'volume-row mb-3 p-3 border rounded';
    div.id = `volume-row-${index}`;
    
    const badgeClass = tipo === 'padrao' ? 'bg-success' : 'bg-warning';
    const badgeText = tipo === 'padrao' ? 'PADRÃO' : 'FORA DO PADRÃO';
    const unPorEmbReadonly = tipo === 'padrao' ? 'readonly' : '';
    const deleteBtnDisplay = index === 0 ? 'style="display: none;"' : '';
    
    div.innerHTML = `
        <div class="d-flex justify-content-between mb-2">
            <h6 class="text-info">
                <i class="bi bi-box"></i> Volume #${index + 1}
                <span class="badge ${badgeClass} ms-2" id="badge-tipo-${index}">${badgeText}</span>
            </h6>
            <button type="button" class="btn btn-sm btn-danger" onclick="removerLinhaVolume(${index})" ${deleteBtnDisplay}>
                <i class="bi bi-trash"></i>
            </button>
        </div>
        <div class="row">
            <div class="col-md-3">
                <label class="form-label">Tipo</label>
                <select class="form-select tipo-volume" onchange="alterarTipoVolume(${index})">
                    <option value="padrao" ${tipo === 'padrao' ? 'selected' : ''}>Padrão</option>
                    <option value="fora-padrao" ${tipo === 'fora-padrao' ? 'selected' : ''}>Fora do Padrão</option>
                </select>
            </div>
            <div class="col-md-2">
                <label class="form-label">Volume (Embalagem)</label>
                <input type="text" class="form-control volume-embalagem" id="volume-embalagem-${index}" value="MALA" readonly>
            </div>
            <div class="col-md-2">
                <label class="form-label">Quantidade</label>
                <input type="number" class="form-control volume-qtd" id="volume-qtd-${index}" value="${qtd}" min="1" step="1" oninput="calcularTotalLinha(${index})">
            </div>
            <div class="col-md-2">
                <label class="form-label">UN por Embalagem</label>
                <input type="number" class="form-control volume-un-por-emb" id="volume-un-por-emb-${index}" value="${unPorEmbalagem}" min="1" step="0.01" oninput="calcularTotalLinha(${index})" ${unPorEmbReadonly}>
            </div>
            <div class="col-md-3">
                <label class="form-label">Total UN (automático)</label>
                <input type="number" class="form-control volume-total" id="volume-total-${index}" readonly style="background-color: #1e293b; color: #fbbf24; font-weight: 700;">
            </div>
        </div>
        <div class="row mt-2">
            <div class="col-md-4">
                <label class="form-label">Lote</label>
                <input type="text" class="form-control volume-lote" id="volume-lote-${index}" oninput="atualizarDadosVolume(${index})">
            </div>
            <div class="col-md-4">
                <label class="form-label">Validade</label>
                <input type="date" class="form-control volume-validade" id="volume-validade-${index}" oninput="atualizarDadosVolume(${index})">
            </div>
            <div class="col-md-4">
                <label class="form-label">Localização</label>
                <input type="text" class="form-control volume-localizacao" id="volume-localizacao-${index}" oninput="atualizarDadosVolume(${index})">
            </div>
        </div>
    `;
    
    return div;
}

// Adicionar nova linha de volume
function adicionarLinhaVolume() {
    contadorVolumes++;
    
    // Pegar valores padrão do produto
    const qtdPadrao = parseInt(document.getElementById('unidade-multipla-qtd-padrao').value) || 250;
    
    const novaLinha = criarLinhaVolume(contadorVolumes, 'fora-padrao', 1, 168);
    document.getElementById('volumes-container').appendChild(novaLinha);
    
    // Inicializar dados
    volumesData[contadorVolumes] = {
        tipo: 'fora-padrao',
        qtd: 1,
        unPorEmbalagem: 168,
        lote: '',
        validade: '',
        localizacao: ''
    };
    
    calcularTotalLinha(contadorVolumes);
    calcularTotalGeral();
}

// Remover linha de volume
function removerLinhaVolume(index) {
    const linha = document.getElementById(`volume-row-${index}`);
    if (linha) {
        linha.remove();
        delete volumesData[index];
        calcularTotalGeral();
    }
}

// Alterar tipo de volume (padrão/fora do padrão)
function alterarTipoVolume(index) {
    const select = document.querySelector(`#volume-row-${index} .tipo-volume`);
    const badge = document.getElementById(`badge-tipo-${index}`);
    const unPorEmbInput = document.getElementById(`volume-un-por-emb-${index}`);
    const qtdPadrao = parseInt(document.getElementById('unidade-multipla-qtd-padrao').value) || 250;
    
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
    if (!volumesData[index]) volumesData[index] = {};
    volumesData[index].tipo = select.value;
    if (select.value === 'padrao') {
        volumesData[index].unPorEmbalagem = qtdPadrao;
    }
    
    calcularTotalLinha(index);
}

// Calcular total de uma linha
function calcularTotalLinha(index) {
    const qtd = parseFloat(document.getElementById(`volume-qtd-${index}`).value) || 0;
    const unPorEmb = parseFloat(document.getElementById(`volume-un-por-emb-${index}`).value) || 0;
    const total = qtd * unPorEmb;
    
    document.getElementById(`volume-total-${index}`).value = total.toFixed(2);
    
    // Atualizar dados
    if (!volumesData[index]) volumesData[index] = {};
    volumesData[index].qtd = qtd;
    volumesData[index].unPorEmbalagem = unPorEmb;
    
    calcularTotalGeral();
}

// Atualizar dados do volume (lote, validade, localização)
function atualizarDadosVolume(index) {
    if (!volumesData[index]) volumesData[index] = {};
    
    volumesData[index].lote = document.getElementById(`volume-lote-${index}`)?.value || '';
    volumesData[index].validade = document.getElementById(`volume-validade-${index}`)?.value || '';
    volumesData[index].localizacao = document.getElementById(`volume-localizacao-${index}`)?.value || '';
}

// Calcular total geral de todas as linhas
function calcularTotalGeral() {
    let totalVolumes = 0;
    let totalGeralUN = 0;
    
    for (let i = 0; i <= contadorVolumes; i++) {
        const linha = document.getElementById(`volume-row-${i}`);
        if (linha) {
            const qtd = parseFloat(document.getElementById(`volume-qtd-${i}`).value) || 0;
            totalVolumes += qtd;
            
            const totalUN = parseFloat(document.getElementById(`volume-total-${i}`).value) || 0;
            totalGeralUN += totalUN;
        }
    }
    
    const totalVolumesEl = document.getElementById('total-volumes');
    const totalGeralEl = document.getElementById('total-geral-un');
    
    if (totalVolumesEl) totalVolumesEl.textContent = totalVolumes;
    if (totalGeralEl) totalGeralEl.textContent = totalGeralUN.toFixed(2);
}

// Filtrar produtos na busca da unidade múltipla
function filtrarProdutosUnidade() {
    const termo = document.getElementById('busca-produto-unidade').value.toLowerCase();
    const container = document.getElementById('lista-produtos-unidade');
    
    if (!container) return;
    
    // Se a lista estiver vazia, preencher
    if (container.children.length === 0) {
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
                <small class="text-info">${p.categoria} - ${p.tipoEmbalagem} (${p.qtdPorEmbalagem} UN)</small>
            `;
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                selecionarProdutoUnidade(p.sku, p.nome, p.tipoEmbalagem, p.qtdPorEmbalagem);
            });
            
            container.appendChild(item);
        });
    }
    
    // Filtrar
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
    
    container.style.display = hasVisible ? 'block' : 'none';
}

// Selecionar produto na unidade múltipla
function selecionarProdutoUnidade(sku, nome, tipoEmbalagem, qtdPorEmbalagem) {
    document.getElementById('busca-produto-unidade').value = nome;
    document.getElementById('unidade-multipla-sku').value = sku;
    document.getElementById('unidade-multipla-tipo-embalagem').value = tipoEmbalagem;
    document.getElementById('unidade-multipla-qtd-padrao').value = qtdPorEmbalagem;
    document.getElementById('lista-produtos-unidade').style.display = 'none';
    
    // Atualizar todas as linhas existentes com o novo tipo de embalagem
    for (let i = 0; i <= contadorVolumes; i++) {
        const embalagemInput = document.getElementById(`volume-embalagem-${i}`);
        if (embalagemInput) {
            embalagemInput.value = tipoEmbalagem;
        }
    }
    
    // Atualizar a primeira linha com o valor padrão
    const unPorEmb0 = document.getElementById(`volume-un-por-emb-0`);
    if (unPorEmb0) {
        unPorEmb0.value = qtdPorEmbalagem;
        calcularTotalLinha(0);
    }
}

// ============================================
// FUNÇÕES PARA RECEBIMENTO MÚLTIPLO
// ============================================

// Abrir modal de recebimento múltiplo
function abrirModalRecebimentoMultiplo() {
    // Resetar contadores
    contadorVolumesRecebimento = -1;
    volumesRecebimentoData = [];
    
    // Limpar container
    const container = document.getElementById('volumes-recebimento-container');
    container.innerHTML = '';
    
    // Adicionar primeira linha
    adicionarLinhaVolumeRecebimento();
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('modalRecebimentoMultiplo'));
    modal.show();
}

// Adicionar linha de volume no recebimento
function adicionarLinhaVolumeRecebimento() {
    contadorVolumesRecebimento++;
    const container = document.getElementById('volumes-recebimento-container');
    
    const div = document.createElement('div');
    div.className = 'volume-row mb-3 p-3 border rounded';
    div.id = `volume-recebimento-row-${contadorVolumesRecebimento}`;
    
    const tipo = contadorVolumesRecebimento === 0 ? 'padrao' : 'fora-padrao';
    const badgeClass = tipo === 'padrao' ? 'bg-success' : 'bg-warning';
    const badgeText = tipo === 'padrao' ? 'PADRÃO' : 'FORA DO PADRÃO';
    const qtdPadrao = parseInt(document.getElementById('recebimento-multiplo-qtd-padrao').value) || 250;
    const qtdInicial = tipo === 'padrao' ? 10 : 1;
    const unPorEmbInicial = tipo === 'padrao' ? qtdPadrao : 168;
    
    div.innerHTML = `
        <div class="d-flex justify-content-between mb-2">
            <h6 class="text-info">
                <i class="bi bi-box"></i> Volume #${contadorVolumesRecebimento + 1}
                <span class="badge ${badgeClass} ms-2" id="badge-recebimento-tipo-${contadorVolumesRecebimento}">${badgeText}</span>
            </h6>
            <button type="button" class="btn btn-sm btn-danger" onclick="removerLinhaVolumeRecebimento(${contadorVolumesRecebimento})">
                <i class="bi bi-trash"></i>
            </button>
        </div>
        <div class="row">
            <div class="col-md-3">
                <label class="form-label">Tipo</label>
                <select class="form-select tipo-volume-recebimento" onchange="alterarTipoVolumeRecebimento(${contadorVolumesRecebimento})">
                    <option value="padrao" ${tipo === 'padrao' ? 'selected' : ''}>Padrão</option>
                    <option value="fora-padrao" ${tipo === 'fora-padrao' ? 'selected' : ''}>Fora do Padrão</option>
                </select>
            </div>
            <div class="col-md-2">
                <label class="form-label">Volume (Embalagem)</label>
                <input type="text" class="form-control volume-recebimento-embalagem" id="volume-recebimento-embalagem-${contadorVolumesRecebimento}" value="MALA" readonly>
            </div>
            <div class="col-md-2">
                <label class="form-label">Quantidade</label>
                <input type="number" class="form-control volume-recebimento-qtd" id="volume-recebimento-qtd-${contadorVolumesRecebimento}" value="${qtdInicial}" min="1" step="1" oninput="calcularTotalLinhaRecebimento(${contadorVolumesRecebimento})">
            </div>
            <div class="col-md-2">
                <label class="form-label">UN por Embalagem</label>
                <input type="number" class="form-control volume-recebimento-un-por-emb" id="volume-recebimento-un-por-emb-${contadorVolumesRecebimento}" value="${unPorEmbInicial}" min="1" step="0.01" oninput="calcularTotalLinhaRecebimento(${contadorVolumesRecebimento})" ${tipo === 'padrao' ? 'readonly' : ''}>
            </div>
            <div class="col-md-3">
                <label class="form-label">Total UN (automático)</label>
                <input type="number" class="form-control volume-recebimento-total" id="volume-recebimento-total-${contadorVolumesRecebimento}" readonly style="background-color: #1e293b; color: #fbbf24; font-weight: 700;">
            </div>
        </div>
        <div class="row mt-2">
            <div class="col-md-4">
                <label class="form-label">Lote</label>
                <input type="text" class="form-control volume-recebimento-lote" id="volume-recebimento-lote-${contadorVolumesRecebimento}" oninput="atualizarDadosVolumeRecebimento(${contadorVolumesRecebimento})">
            </div>
            <div class="col-md-4">
                <label class="form-label">Validade</label>
                <input type="date" class="form-control volume-recebimento-validade" id="volume-recebimento-validade-${contadorVolumesRecebimento}" oninput="atualizarDadosVolumeRecebimento(${contadorVolumesRecebimento})">
            </div>
            <div class="col-md-4">
                <label class="form-label">Localização</label>
                <input type="text" class="form-control volume-recebimento-localizacao" id="volume-recebimento-localizacao-${contadorVolumesRecebimento}" oninput="atualizarDadosVolumeRecebimento(${contadorVolumesRecebimento})">
            </div>
        </div>
    `;
    
    container.appendChild(div);
    
    // Inicializar dados
    volumesRecebimentoData[contadorVolumesRecebimento] = {
        tipo: tipo,
        qtd: qtdInicial,
        unPorEmbalagem: unPorEmbInicial,
        lote: '',
        validade: '',
        localizacao: ''
    };
    
    calcularTotalLinhaRecebimento(contadorVolumesRecebimento);
    calcularTotalGeralRecebimento();
}

// Remover linha de volume no recebimento
function removerLinhaVolumeRecebimento(index) {
    const linha = document.getElementById(`volume-recebimento-row-${index}`);
    if (linha) {
        linha.remove();
        delete volumesRecebimentoData[index];
        calcularTotalGeralRecebimento();
    }
}

// Alterar tipo de volume no recebimento
function alterarTipoVolumeRecebimento(index) {
    const select = document.querySelector(`#volume-recebimento-row-${index} .tipo-volume-recebimento`);
    const badge = document.getElementById(`badge-recebimento-tipo-${index}`);
    const unPorEmbInput = document.getElementById(`volume-recebimento-un-por-emb-${index}`);
    const qtdPadrao = parseInt(document.getElementById('recebimento-multiplo-qtd-padrao').value) || 250;
    
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
    if (!volumesRecebimentoData[index]) volumesRecebimentoData[index] = {};
    volumesRecebimentoData[index].tipo = select.value;
    if (select.value === 'padrao') {
        volumesRecebimentoData[index].unPorEmbalagem = qtdPadrao;
    }
    
    calcularTotalLinhaRecebimento(index);
}

// Calcular total de uma linha no recebimento
function calcularTotalLinhaRecebimento(index) {
    const qtd = parseFloat(document.getElementById(`volume-recebimento-qtd-${index}`).value) || 0;
    const unPorEmb = parseFloat(document.getElementById(`volume-recebimento-un-por-emb-${index}`).value) || 0;
    const total = qtd * unPorEmb;
    
    document.getElementById(`volume-recebimento-total-${index}`).value = total.toFixed(2);
    
    // Atualizar dados
    if (!volumesRecebimentoData[index]) volumesRecebimentoData[index] = {};
    volumesRecebimentoData[index].qtd = qtd;
    volumesRecebimentoData[index].unPorEmbalagem = unPorEmb;
    
    calcularTotalGeralRecebimento();
}

// Atualizar dados do volume no recebimento
function atualizarDadosVolumeRecebimento(index) {
    if (!volumesRecebimentoData[index]) volumesRecebimentoData[index] = {};
    
    volumesRecebimentoData[index].lote = document.getElementById(`volume-recebimento-lote-${index}`)?.value || '';
    volumesRecebimentoData[index].validade = document.getElementById(`volume-recebimento-validade-${index}`)?.value || '';
    volumesRecebimentoData[index].localizacao = document.getElementById(`volume-recebimento-localizacao-${index}`)?.value || '';
}

// Calcular total geral do recebimento
function calcularTotalGeralRecebimento() {
    let totalVolumes = 0;
    let totalGeralUN = 0;
    
    for (let i = 0; i <= contadorVolumesRecebimento; i++) {
        const linha = document.getElementById(`volume-recebimento-row-${i}`);
        if (linha) {
            const qtd = parseFloat(document.getElementById(`volume-recebimento-qtd-${i}`).value) || 0;
            totalVolumes += qtd;
            
            const totalUN = parseFloat(document.getElementById(`volume-recebimento-total-${i}`).value) || 0;
            totalGeralUN += totalUN;
        }
    }
    
    document.getElementById('total-volumes-recebimento').textContent = totalVolumes;
    document.getElementById('total-geral-un-recebimento').textContent = totalGeralUN.toFixed(2);
}

// Filtrar produtos na busca do recebimento principal
function filtrarProdutosRecebimentoPrincipal() {
    const termo = document.getElementById('busca-produto-recebimento-principal').value.toLowerCase();
    const container = document.getElementById('lista-produtos-recebimento-principal');
    
    if (!container) return;
    
    // Se a lista estiver vazia, preencher
    if (container.children.length === 0) {
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
                <small class="text-info">${p.categoria} - ${p.tipoEmbalagem} (${p.qtdPorEmbalagem} UN)</small>
            `;
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                selecionarProdutoRecebimentoPrincipal(p.sku, p.nome, p.tipoEmbalagem, p.qtdPorEmbalagem);
            });
            
            container.appendChild(item);
        });
    }
    
    // Filtrar
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
    
    container.style.display = hasVisible ? 'block' : 'none';
}

// Selecionar produto no recebimento principal
function selecionarProdutoRecebimentoPrincipal(sku, nome, tipoEmbalagem, qtdPorEmbalagem) {
    document.getElementById('busca-produto-recebimento-principal').value = nome;
    document.getElementById('recebimento-multiplo-sku').value = sku;
    document.getElementById('recebimento-multiplo-tipo-embalagem').value = tipoEmbalagem;
    document.getElementById('recebimento-multiplo-qtd-padrao').value = qtdPorEmbalagem;
    document.getElementById('lista-produtos-recebimento-principal').style.display = 'none';
    
    // Atualizar todas as linhas existentes com o novo tipo de embalagem
    for (let i = 0; i <= contadorVolumesRecebimento; i++) {
        const embalagemInput = document.getElementById(`volume-recebimento-embalagem-${i}`);
        if (embalagemInput) {
            embalagemInput.value = tipoEmbalagem;
        }
    }
    
    // Atualizar a primeira linha com o valor padrão se ela for do tipo padrão
    const unPorEmb0 = document.getElementById(`volume-recebimento-un-por-emb-0`);
    if (unPorEmb0 && volumesRecebimentoData[0]?.tipo === 'padrao') {
        unPorEmb0.value = qtdPorEmbalagem;
        calcularTotalLinhaRecebimento(0);
    }
}

// Salvar unidade múltipla
async function salvarUnidadeMultipla() {
    const sku = document.getElementById('unidade-multipla-sku').value;
    const status = document.getElementById('unidade-multipla-status').value;
    const observacoes = document.getElementById('unidade-multipla-observacoes').value;
    
    if (!sku) {
        alert('Selecione um produto!');
        return;
    }
    
    // Coletar todos os volumes
    const volumes = [];
    for (let i = 0; i <= contadorVolumes; i++) {
        const linha = document.getElementById(`volume-row-${i}`);
        if (linha && volumesData[i]) {
            const qtd = volumesData[i].qtd || 0;
            const unPorEmb = volumesData[i].unPorEmbalagem || 0;
            
            if (qtd > 0 && unPorEmb > 0) {
                volumes.push({
                    tipo: volumesData[i].tipo,
                    qtd: qtd,
                    unPorEmbalagem: unPorEmb,
                    totalUN: qtd * unPorEmb,
                    lote: volumesData[i].lote || '',
                    validade: volumesData[i].validade || '',
                    localizacao: volumesData[i].localizacao || ''
                });
            }
        }
    }
    
    if (volumes.length === 0) {
        alert('Adicione pelo menos um volume!');
        return;
    }
    
    try {
        // Salvar cada volume como uma unidade separada
        for (const volume of volumes) {
            const idUnidade = gerarIdUnico();
            const unidade = {
                tipo: 'unidade',
                id: idUnidade,
                sku: sku,
                lote: volume.lote,
                validade: volume.validade,
                volume: volume.qtd,
                quantidade: volume.totalUN,
                unidadeEmbalagem: document.getElementById('unidade-multipla-tipo-embalagem').value || 'MALA',
                status: status,
                localizacao: volume.localizacao || '-',
                destino: '',
                foraPadrao: volume.tipo === 'fora-padrao',
                qtdRealPorEmbalagem: volume.tipo === 'fora-padrao' ? volume.unPorEmbalagem : null,
                tipoEntrada: 'Manual'
            };
            
            await fetch(WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(unidade)
            });
            
            unidades.push(unidade);
        }
        
        // Fechar modal
        bootstrap.Modal.getInstance(document.getElementById('modalUnidadeMultiplo')).hide();
        
        // Atualizar interface
        atualizarInterface();
        
        alert(`${volumes.length} volume(s) criado(s) com sucesso!`);
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao salvar unidades.');
    }
}

// Salvar recebimento múltiplo
async function salvarRecebimentoMultiplo() {
    const dataRecebimento = document.getElementById('recebimento-multiplo-data').value;
    const numeroNF = document.getElementById('recebimento-multiplo-nf').value;
    const fornecedor = document.getElementById('recebimento-multiplo-fornecedor').value;
    const sku = document.getElementById('recebimento-multiplo-sku').value;
    const observacoes = document.getElementById('recebimento-multiplo-observacoes').value;
    
    if (!dataRecebimento || !numeroNF || !fornecedor || !sku) {
        alert('Data, NF, Fornecedor e Produto são obrigatórios!');
        return;
    }
    
    const produto = produtos.find(p => p.sku === sku);
    
    // Coletar todos os volumes
    const volumes = [];
    for (let i = 0; i <= contadorVolumesRecebimento; i++) {
        const linha = document.getElementById(`volume-recebimento-row-${i}`);
        if (linha && volumesRecebimentoData[i]) {
            const qtd = volumesRecebimentoData[i].qtd || 0;
            const unPorEmb = volumesRecebimentoData[i].unPorEmbalagem || 0;
            
            if (qtd > 0 && unPorEmb > 0) {
                volumes.push({
                    tipo: volumesRecebimentoData[i].tipo,
                    qtd: qtd,
                    unPorEmbalagem: unPorEmb,
                    totalUN: qtd * unPorEmb,
                    lote: volumesRecebimentoData[i].lote || '',
                    validade: volumesRecebimentoData[i].validade || '',
                    localizacao: volumesRecebimentoData[i].localizacao || ''
                });
            }
        }
    }
    
    if (volumes.length === 0) {
        alert('Adicione pelo menos um volume!');
        return;
    }
    
    try {
        // Salvar cada volume como um recebimento e uma unidade
        for (const volume of volumes) {
            // Salvar recebimento
            const recebimento = {
                tipo: 'recebimento',
                dataRecebimento: dataRecebimento,
                numeroNF: numeroNF,
                fornecedor: fornecedor,
                codigoSKU: sku,
                nomeProduto: produto?.nome || '',
                lote: volume.lote,
                validade: volume.validade,
                quantidade: volume.totalUN,
                volume: volume.qtd,
                unidadeMedida: document.getElementById('recebimento-multiplo-tipo-embalagem').value || 'MALA',
                qtdPorEmbalagem: volume.unPorEmbalagem,
                localizacao: volume.localizacao,
                responsavel: 'Sistema',
                observacoes: observacoes
            };
            
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
                lote: volume.lote,
                validade: volume.validade,
                volume: volume.qtd,
                quantidade: volume.totalUN,
                unidadeEmbalagem: document.getElementById('recebimento-multiplo-tipo-embalagem').value || 'MALA',
                status: 'Disponível',
                localizacao: volume.localizacao || '-',
                destino: '',
                foraPadrao: volume.tipo === 'fora-padrao',
                qtdRealPorEmbalagem: volume.tipo === 'fora-padrao' ? volume.unPorEmbalagem : null,
                tipoEntrada: 'Recebimento'
            };
            
            await fetch(WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(unidade)
            });
            
            unidades.push(unidade);
        }
        
        // Fechar modal
        bootstrap.Modal.getInstance(document.getElementById('modalRecebimentoMultiplo')).hide();
        
        // Recarregar dados
        await carregarDados();
        
        alert(`${volumes.length} volume(s) recebido(s) com sucesso!`);
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao registrar recebimento.');
    }
}

// ============================================
// FUNÇÕES ORIGINAIS (MANTIDAS)
// ============================================

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
        const response = await fetch(RECEBIMENTOS_URL);
        const data = await response.json();
        
        if (data.values && data.values.length > 1) {
            recebimentos = data.values.slice(1).map(row => {
                const converter = (valor) => {
                    if (!valor) return 0;
                    if (typeof valor === 'string') {
                        return parseFloat(valor.replace(',', '.')) || 0;
                    }
                    return parseFloat(valor) || 0;
                };
                
                return {
                    data: row[0],
                    nf: row[1],
                    fornecedor: row[2],
                    sku: row[3],
                    produto: row[4],
                    lote: row[5],
                    validade: row[6],
                    quantidade: converter(row[7]),
                    volume: converter(row[8]),
                    unidade: row[9],
                    qtdPorEmbalagem: converter(row[10]),
                    localizacao: row[11],
                    responsavel: row[12],
                    observacoes: row[13]
                };
            });
            
            atualizarTabelaRecebimentos();
        }
    } catch (error) {
        console.error('Erro ao carregar recebimentos:', error);
    }
}

// Atualizar tabela de recebimentos
function atualizarTabelaRecebimentos(recebimentosFiltrados = null) {
    const tbody = document.getElementById('tabela-recebimentos');
    if (!tbody) return;
    
    const dados = recebimentosFiltrados || recebimentos;
    
    tbody.innerHTML = '';
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center">Nenhum recebimento encontrado</td></tr>';
        return;
    }
    
    dados.slice(-50).reverse().forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatarData(r.data)}</td>
            <td>${r.nf || '-'}</td>
            <td>${r.fornecedor || '-'}</td>
            <td>${r.sku}</td>
            <td>${r.produto}</td>
            <td>${r.lote}</td>
            <td>${formatarData(r.validade)}</td>
            <td>${r.volume}</td>
            <td>${r.unidade}</td>
            <td>${r.quantidade}</td>
            <td>${r.localizacao || '-'}</td>
            <td>${r.responsavel}</td>
        `;
        tbody.appendChild(tr);
    });
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
        
        // CORREÇÃO: Formatar com 2 casas decimais
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
        // Carregar os dados do estoque geral da planilha
        carregarEstoqueGeral();
        // Atualizar outros dados do painel
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
                
                // CORREÇÃO: Adicionar zeros à esquerda se necessário (para 8 dígitos)
                if (sku && !isNaN(sku) && sku.length < 8) {
                    sku = sku.padStart(8, '0');
                }
                
                return {
                    sku: sku,
                    nome: row[1] || '',
                    descricao: row[2] || '',
                    categoria: row[3] || 'Insumos',
                    tipoEmbalagem: row[4] || 'UN',
                    qtdPorEmbalagem: parseInt(row[5]) || 1,  // Aqui parseInt está correto (é quantidade inteira)
                    unidadeBase: row[6] || 'UN',
                    imagem: row[7] || ''
                };
            }).filter(p => p.sku);
            
            console.log(`✅ ${produtos.length} produtos carregados`);
        }

        const unidadesRes = await fetch(UNIDADES_URL);
        const unidadesData = await unidadesRes.json();
        if (unidadesData.values && unidadesData.values.length > 1) {
            unidades = unidadesData.values.slice(1).map(row => {
                let sku = row[1] || '';
                
                if (sku && !isNaN(sku) && sku.length < 8) {
                    sku = sku.padStart(8, '0');
                }
                
                // CORREÇÃO: Converter string com vírgula para número
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
            
            console.log(`✅ ${unidades.length} unidades carregadas`);
        }

        const movRes = await fetch(MOVIMENTACOES_URL);
        const movData = await movRes.json();
        if (movData.values && movData.values.length > 1) {
            movimentacoes = movData.values.slice(1).map(row => {
                let sku = row[3] || '';
                
                // CORREÇÃO: Adicionar zeros à esquerda no SKU das movimentações
                if (sku && !isNaN(sku) && sku.length < 8) {
                    sku = sku.padStart(8, '0');
                }
                
                return {
                    data: row[0] || '',
                    tipo: row[1] || '',
                    idUnidade: row[2] || '',
                    sku: sku,
                    volume: parseInt(row[4]) || 0,        // Volume geralmente é inteiro
                    quantidade: parseFloat(row[5]) || 0,  // Quantidade pode ter decimais
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

// Dados de exemplo (corrigido com SKUs de 8 dígitos)
function carregarDadosExemplo() {
    produtos = [
        { sku: 'ERRO', nome: 'ERRO', descricao: 'ERRO', categoria: 'ERRO', tipoEmbalagem: 'ERRO', qtdPorEmbalagem: 50, unidadeBase: 'ERRO', imagem: '' },
        { sku: 'ERRO', nome: 'ERRO', descricao: 'ERRO', categoria: 'ERRO', tipoEmbalagem: 'ERRO', qtdPorEmbalagem: 100, unidadeBase: 'ERRO', imagem: '' }
    ];
    
    unidades = [
        { id: 'ERRO', sku: 'ERRO', lote: 'ERRO', validade: 'ERRO', volume: 10, quantidade: 500, unidadeEmbalagem: 'ERRO', status: 'ERRO', localizacao: 'ERRO', destino: '', foraPadrao: false, qtdRealPorEmbalagem: null },
        { id: 'ERRO', sku: 'ERRO', lote: 'ERRO', validade: 'ERRO', volume: 20, quantidade: 2000, unidadeEmbalagem: 'ERRO', status: 'ERRO', localizacao: 'ERRO', destino: '', foraPadrao: false, qtdRealPorEmbalagem: null }
    ];
    
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
// FUNÇÕES DE UNIDADES (ORIGINAIS)
// ============================================

// Atualizar painel
function atualizarPainel() {
    const unidadesAtivas = unidades.filter(u => u.quantidade > 0);
    
    // Verificar se os elementos existem antes de atualizar
    const totalProdutosEl = document.getElementById('total-produtos');
    const totalUnidadesEl = document.getElementById('total-unidades');
    const proximosVencerEl = document.getElementById('proximos-vencer');
    const estoqueBaixoEl = document.getElementById('estoque-baixo');
    
    if (totalProdutosEl) totalProdutosEl.textContent = produtos.length;
    if (totalUnidadesEl) totalUnidadesEl.textContent = unidadesAtivas.length;
    
    const hoje = new Date();
    const proximosVencer = unidadesAtivas.filter(u => {
        if (!u.validade) return false;
        const validade = new Date(u.validade);
        const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
        return dias <= 30 && dias > 0;
    }).length;
    
    if (proximosVencerEl) proximosVencerEl.textContent = proximosVencer;
    
    const estoqueBaixo = unidadesAtivas.filter(u => u.quantidade < 10).length;
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
        const unidadesProduto = unidades.filter(u => u.sku === produto.sku && u.quantidade > 0);
        const totalVolume = unidadesProduto.reduce((sum, u) => sum + u.volume, 0);
        const totalQuantidade = unidadesProduto.reduce((sum, u) => sum + u.quantidade, 0);
        
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
    const unidadesProduto = unidades.filter(u => u.sku === sku && u.quantidade > 0);
    
    document.getElementById('modalVerProduto-titulo').textContent = `${produto.nome} - SKU: ${sku} (${produto.tipoEmbalagem})`;
    
    const tbody = document.getElementById('tabela-unidades-produto');
    tbody.innerHTML = '';
    
    if (unidadesProduto.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhuma unidade ativa encontrada</td></tr>';
    } else {
        unidadesProduto.forEach(u => {
            const tr = document.createElement('tr');
            // CORREÇÃO: Formatar com 2 casas decimais
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
        // Resetar para valor padrão se não houver SKU
        document.getElementById('quantidade-unidade').textContent = '(UN)';
        document.getElementById('quantidade-descricao').textContent = 'Total de unidades';
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalUnidade'));
    modal.show();
}

// Salvar produto
async function salvarProduto() {
    let sku = document.getElementById('produto-sku').value;
    
    // Garantir que o SKU tenha 8 dígitos e seja texto
    if (sku) {
        // Remover espaços e garantir que seja string
        sku = String(sku).trim();
        // Adicionar zeros à esquerda se necessário
        if (sku.length < 8 && !isNaN(sku)) {
            sku = sku.padStart(8, '0');
        }
    }
    
    const tipoEmbalagem = document.getElementById('produto-tipo-embalagem').value;
    const qtdPorEmbalagem = tipoEmbalagem !== 'UN' ? 
        parseInt(document.getElementById('produto-qtd-por-embalagem').value) : 1;
    
    const produto = {
        tipo: 'produto',
        sku: sku,  // Agora é string com zeros
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
    
    // CORREÇÃO CRÍTICA: usar parseFloat em vez de parseInt
    let quantidade = parseFloat(document.getElementById('unidade-quantidade').value);
    
    // Se for NaN, definir como 0
    if (isNaN(quantidade)) quantidade = 0;
    
    if (foraPadrao) {
        const qtdReal = parseFloat(document.getElementById('unidade-quantidade-real').value);
        if (!isNaN(qtdReal)) {
            quantidade = volume * qtdReal;
        }
    }
    
    console.log('📤 Quantidade a ser enviada:', quantidade); // Debug
    
    const unidade = {
        tipo: 'unidade',
        id: id,
        sku: sku,
        lote: document.getElementById('unidade-lote').value,
        validade: document.getElementById('unidade-validade').value,
        volume: volume,
        quantidade: quantidade,  // Agora é número com decimais
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

// Ver unidade
function verUnidade(id) {
    unidadeAtual = unidades.find(u => u.id === id);
    if (!unidadeAtual) return;
    
    const produto = produtos.find(p => p.sku === unidadeAtual.sku);
    
    document.getElementById('detalhe-id').textContent = unidadeAtual.id;
    document.getElementById('detalhe-produto').textContent = produto ? produto.nome : 'Produto não encontrado';
    document.getElementById('detalhe-categoria').textContent = produto ? produto.categoria : '-';
    document.getElementById('detalhe-sku').textContent = unidadeAtual.sku;
    document.getElementById('detalhe-lote').textContent = unidadeAtual.lote;
    document.getElementById('detalhe-validade').textContent = formatarData(unidadeAtual.validade);
    document.getElementById('detalhe-embalagem').textContent = unidadeAtual.unidadeEmbalagem;
    document.getElementById('detalhe-volume').textContent = unidadeAtual.volume;
    document.getElementById('detalhe-quantidade').textContent = unidadeAtual.quantidade.toFixed(2) + ' ' + (produto?.unidadeBase || 'UN');
    document.getElementById('detalhe-fora-padrao').textContent = unidadeAtual.foraPadrao ? 'Sim' : 'Não';
    document.getElementById('detalhe-status').innerHTML = `<span class="badge ${unidadeAtual.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${unidadeAtual.status}</span>`;
    document.getElementById('detalhe-localizacao').textContent = unidadeAtual.localizacao;
    document.getElementById('detalhe-destino').textContent = unidadeAtual.destino || '-';
    
    // GERAR QR CODE - VERSÃO CORRIGIDA
    const qrContainer = document.getElementById('unidade-qr-code');
    qrContainer.innerHTML = ''; // Limpar
    
    // Pequeno delay para garantir que o container está pronto
    setTimeout(() => {
        try {
            // Verificar se a biblioteca está disponível
            if (typeof QRCode !== 'undefined') {
                // Limpar o container novamente
                qrContainer.innerHTML = '';
                
                // Criar novo QR Code
                new QRCode(qrContainer, {
                    text: unidadeAtual.id,
                    width: 150,
                    height: 150,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
                console.log('✅ QR Code gerado com sucesso!');
            } else {
                console.error('❌ Biblioteca QRCode não encontrada');
                // Fallback para API externa
                qrContainer.innerHTML = `
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(unidadeAtual.id)}" 
                         alt="QR Code" 
                         style="width: 150px; height: 150px; border-radius: 8px; border: 2px solid #fbbf24;">
                `;
            }
        } catch (e) {
            console.error('❌ Erro ao gerar QR Code:', e);
            // Fallback de emergência
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
    }, 100); // Pequeno delay para garantir
    
    const modal = new bootstrap.Modal(document.getElementById('modalDetalhesUnidade'));
    modal.show();
}

// Ver QR Code completo (usando API externa)
function verQRCodeCompleto() {
    if (!unidadeAtual) return;
    
    const produto = produtos.find(p => p.sku === unidadeAtual.sku);
    
    // Usar a API do QRServer como fallback
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(unidadeAtual.id)}`;
    window.open(url, '_blank');
}

// Filtrar unidades
function filtrarUnidades() {
    const skuFiltro = document.getElementById('filtro-produto-unidades')?.value;
    const statusFiltro = document.getElementById('filtro-status-unidades')?.value;
    const destinoFiltro = document.getElementById('filtro-destino-unidades')?.value;
    const embalagemFiltro = document.getElementById('filtro-embalagem-unidades')?.value;
    
    let unidadesFiltradas = unidades.filter(u => u.quantidade > 0);
    
    if (skuFiltro) {
        unidadesFiltradas = unidadesFiltradas.filter(u => u.sku === skuFiltro);
    }
    
    if (statusFiltro) {
        if (statusFiltro === 'Vencido') {
            const hoje = new Date();
            unidadesFiltradas = unidadesFiltradas.filter(u => {
                if (!u.validade) return false;
                const validade = new Date(u.validade);
                return validade < hoje;
            });
        } else {
            unidadesFiltradas = unidadesFiltradas.filter(u => u.status === statusFiltro);
        }
    }
    
    if (destinoFiltro) {
        unidadesFiltradas = unidadesFiltradas.filter(u => u.destino === destinoFiltro);
    }
    
    if (embalagemFiltro) {
        unidadesFiltradas = unidadesFiltradas.filter(u => u.unidadeEmbalagem === embalagemFiltro);
    }
    
    atualizarTabelaUnidades(unidadesFiltradas);
}

// Atualizar tabela de unidades
function atualizarTabelaUnidades(unidadesFiltradas = null) {
    const tbody = document.getElementById('tabela-unidades');
    if (!tbody) return;
    
    const dados = unidadesFiltradas || unidades.filter(u => u.quantidade > 0);
    const hoje = new Date();
    
    tbody.innerHTML = '';
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center">Nenhuma unidade ativa encontrada</td></tr>';
        return;
    }
    
    dados.forEach(u => {
        const produto = produtos.find(p => p.sku === u.sku);
        const validadeDate = new Date(u.validade);
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
            <!-- NOVA LINHA: Tipo de Entrada -->
            <td><span class="badge ${u.tipoEntrada === 'Recebimento' ? 'bg-info' : 'bg-secondary'}">${u.tipoEntrada || 'Manual'}</span></td>
            <td><span class="badge ${u.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${u.status}</span></td>
            <td>${u.destino || '-'}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="verUnidade('${u.id}')">
                    <i class="bi bi-eye"></i>
                </button>
                ${u.status === 'Disponível' && u.quantidade > 0 ? `
                    <button class="btn btn-sm btn-warning" onclick="abrirModalTransferencia('${u.id}')">
                        <i class="bi bi-arrow-right"></i>
                    </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Abrir modal de transferência
function abrirModalTransferencia(id) {
    const unidade = unidades.find(u => u.id === id);
    if (!unidade) return;
    
    const produto = produtos.find(p => p.sku === unidade.sku);
    
    const url = `baixa-view.html?id=${unidade.id}&sku=${unidade.sku}&lote=${unidade.lote}&validade=${unidade.validade}&produto=${encodeURIComponent(produto?.nome || '')}&volume=${unidade.volume}&quantidade=${unidade.quantidade}&unidade=${unidade.unidadeEmbalagem}&qtdPorEmbalagem=${produto?.qtdPorEmbalagem || 1}`;
    
    window.open(url, '_blank', 'width=700,height=800');
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
                if (unidade && unidade.quantidade > 0) {
                    const produto = produtos.find(p => p.sku === unidade.sku);
                    
                    const url = `baixa-view.html?id=${unidade.id}&sku=${unidade.sku}&lote=${unidade.lote}&validade=${unidade.validade}&produto=${encodeURIComponent(produto?.nome || '')}&volume=${unidade.volume}&quantidade=${unidade.quantidade}&unidade=${unidade.unidadeEmbalagem}&qtdPorEmbalagem=${produto?.qtdPorEmbalagem || 1}`;
                    
                    window.open(url, '_blank', 'width=700,height=800');
                    
                    document.getElementById('qr-resultado').innerHTML = '<div class="alert alert-success">Redirecionando...</div>';
                } else {
                    document.getElementById('qr-resultado').innerHTML = `<div class="alert alert-danger">Unidade não encontrada ou sem estoque: ${decodedText}</div>`;
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

// Atualizar tabela de movimentações
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
        tr.innerHTML = `
            <td>${formatarData(mov.data)}</td>
            <td><span class="badge ${mov.tipo === 'Entrada' ? 'bg-success' : mov.tipo === 'Saída' ? 'bg-warning' : 'bg-info'}">${mov.tipo}</span></td>
            <td><small>${mov.idUnidade}</small></td>
            <td>${produto ? produto.nome : mov.sku}</td>
            <td>${mov.volume} ${mov.unidadeEmbalagem}</td>
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
    const unidadesAtivas = unidades.filter(u => u.quantidade > 0);
    
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
        const disponiveis = unidadesAtivas.filter(u => u.status === 'Disponível').length;
        const bloqueados = unidadesAtivas.filter(u => u.status === 'Bloqueado').length;
        const transferidos = unidadesAtivas.filter(u => u.destino).length;
        
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
            const total = unidadesAtivas
                .filter(u => u.sku === p.sku)
                .reduce((sum, u) => sum + u.quantidade, 0);
            return total < 10;
        });
        
        if (estoqueBaixo.length === 0) {
            containerEstoque.innerHTML = '<p class="text-success">✅ Todos os produtos têm estoque adequado</p>';
        } else {
            containerEstoque.innerHTML = '<ul class="list-group">';
            estoqueBaixo.forEach(p => {
                const total = unidadesAtivas
                    .filter(u => u.sku === p.sku)
                    .reduce((sum, u) => sum + u.quantidade, 0);
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
        const validades = unidadesAtivas
            .filter(u => u.validade)
            .map(u => {
                const dias = Math.ceil((new Date(u.validade) - hoje) / (1000 * 60 * 60 * 24));
                return { ...u, dias };
            })
            .filter(u => u.dias <= 30)
            .sort((a, b) => a.dias - b.dias);
        
        if (validades.length === 0) {
            containerValidades.innerHTML = '<p class="text-success">✅ Nenhum produto próximo ao vencimento</p>';
        } else {
            containerValidades.innerHTML = '<ul class="list-group">';
            validades.slice(0, 10).forEach(u => {
                const produto = produtos.find(p => p.sku === u.sku);
                containerValidades.innerHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center ${u.dias <= 7 ? 'list-group-item-danger' : u.dias <= 15 ? 'list-group-item-warning' : ''}">
                        ${produto ? produto.nome : u.sku} - ${u.unidadeEmbalagem} ${u.volume}
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

// Formatar data sem problemas de fuso horário
function formatarData(data) {
    if (!data) return '';
    
    // Se for string no formato YYYY-MM-DD (padrão do Google Sheets)
    if (typeof data === 'string' && data.includes('-')) {
        const partes = data.split('-');
        if (partes.length === 3) {
            // Criar data considerando o fuso local
            const ano = parseInt(partes[0]);
            const mes = parseInt(partes[1]);
            const dia = parseInt(partes[2]);
            
            // Formatar manualmente para evitar problemas de fuso
            return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
        }
    }
    
    // Fallback para outros formatos
    try {
        const d = new Date(data);
        if (isNaN(d.getTime())) return data;
        
        // Extrair partes manualmente para evitar fuso
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
    
    // Atualizar informações da embalagem
    document.getElementById('volume-label').textContent = `Volume (${tipoEmbalagem})`;
    document.getElementById('volume-descricao').textContent = `Número de ${tipoEmbalagem}`;
    document.getElementById('quantidade-unidade').textContent = `(${unidadeBase})`;
    document.getElementById('quantidade-descricao').textContent = `Total em ${unidadeBase}`;
    
    // Recalcular quantidade
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
let produtosPorItem = {}; // Armazenar produtos por índice

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
    
    // Adicionar event listeners para o novo item
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
        
        // Preencher lista se estiver vazia
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
        
        // Filtrar
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
                // Forçar preenchimento
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
    
    // Armazenar dados do produto
    produtosPorItem[index] = {
        sku: sku,
        nome: nome,
        tipoEmbalagem: tipoEmbalagem,
        qtdPorEmbalagem: qtdPorEmbalagem,
        unidadeBase: unidadeBase
    };
    
    // Atualizar unidade
    document.getElementById(`item-unidade-${index}`).textContent = unidadeBase;
    
    // Calcular quantidade
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
    // Configurar busca para o primeiro item
    configurarBuscaProduto(0);
    configurarCalculoQuantidade(0);
});
