// Configurações do Google Sheets
const SHEET_ID = '1We0xDOamU_iIGNcm_YxZ8jbBGNWK1PIyljgDb9xWf84';
const API_KEY = 'AIzaSyCShYO-EV8ZcjuOFuYedULIrfcwOgbcwsU';
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbysRomAyxbYAgrqdqqURTTAbwnGFiv9VXD_x11nzwdYbwmKMySmReWH9MBNcR3aeX9S/exec';

// URLs da API
const PRODUTOS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Produtos?key=${API_KEY}`;
const UNIDADES_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Unidades?key=${API_KEY}`;
const MOVIMENTACOES_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Movimentações?key=${API_KEY}`;

// Variáveis globais
let produtos = [];
let unidades = [];
let movimentacoes = [];
let graficoEstoque = null;
let graficoStatus = null;
let graficoDestinos = null;
let graficoCategorias = null;
let unidadeAtual = null;

// Categorias pré-definidas
const categorias = [
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

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    carregarDados();
    setupEventListeners();
    preencherFiltrosCategoria();
});

// Configurar event listeners
function setupEventListeners() {
    document.getElementById('menu-painel').addEventListener('click', () => mostrarView('painel'));
    document.getElementById('menu-produtos').addEventListener('click', () => mostrarView('produtos'));
    document.getElementById('menu-unidades').addEventListener('click', () => mostrarView('unidades'));
    document.getElementById('menu-scanner').addEventListener('click', () => mostrarView('scanner'));
    document.getElementById('menu-movimentacoes').addEventListener('click', () => mostrarView('movimentacoes'));
    document.getElementById('menu-relatorios').addEventListener('click', () => mostrarView('relatorios'));
    document.getElementById('menu-categorias').addEventListener('click', () => mostrarView('categorias'));
    
    document.getElementById('salvar-produto').addEventListener('click', salvarProduto);
    document.getElementById('salvar-unidade').addEventListener('click', salvarUnidade);
    document.getElementById('salvar-categoria').addEventListener('click', salvarCategoria);
    
    document.getElementById('search-produto').addEventListener('keyup', filtrarProdutos);
    document.getElementById('filtro-categoria-produto').addEventListener('change', filtrarProdutos);
    document.getElementById('filtro-produto-unidades').addEventListener('change', filtrarUnidades);
    document.getElementById('filtro-status-unidades').addEventListener('change', filtrarUnidades);
    document.getElementById('filtro-destino-unidades').addEventListener('change', filtrarUnidades);
}

// Mostrar view
function mostrarView(view) {
    const views = ['painel', 'produtos', 'unidades', 'scanner', 'movimentacoes', 'relatorios', 'categorias'];
    views.forEach(v => {
        const el = document.getElementById(`${v}-view`);
        if (el) el.style.display = 'none';
    });
    
    const viewEl = document.getElementById(`${view}-view`);
    if (viewEl) viewEl.style.display = 'block';
    
    document.querySelectorAll('.list-group-item').forEach(item => item.classList.remove('active'));
    const menu = document.getElementById(`menu-${view}`);
    if (menu) menu.classList.add('active');
    
    // Ações específicas por view
    if (view === 'scanner') setupQRCode();
    if (view === 'unidades') {
        preencherFiltrosUnidades();
        atualizarTabelaUnidades();
    }
    if (view === 'relatorios') gerarRelatorios();
    if (view === 'painel') atualizarGraficosPainel();
}

// Preencher filtros de categoria
function preencherFiltrosCategoria() {
    const select = document.getElementById('filtro-categoria-produto');
    if (!select) return;
    
    select.innerHTML = '<option value="">Todas as categorias</option>';
    categorias.forEach(c => {
        select.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
    });
}

// Carregar dados
async function carregarDados() {
    try {
        console.log('Carregando dados...');
        
        // Carregar produtos
        const produtosRes = await fetch(PRODUTOS_URL);
        const produtosData = await produtosRes.json();
        if (produtosData.values && produtosData.values.length > 1) {
            produtos = produtosData.values.slice(1).map(row => ({
                sku: row[0] || '',
                nome: row[1] || '',
                descricao: row[2] || '',
                categoria: row[3] || 'Insumos',
                unidadeBase: row[4] || 'UN',
                imagem: row[5] || ''
            })).filter(p => p.sku);
        }

        // Carregar unidades
        const unidadesRes = await fetch(UNIDADES_URL);
        const unidadesData = await unidadesRes.json();
        if (unidadesData.values && unidadesData.values.length > 1) {
            unidades = unidadesData.values.slice(1).map(row => ({
                id: row[0] || '',
                sku: row[1] || '',
                lote: row[2] || '',
                validade: row[3] || '',
                volume: parseInt(row[4]) || 1,
                quantidade: parseFloat(row[5]) || 0,
                unidade: row[6] || 'UN',
                status: row[7] || 'Disponível',
                localizacao: row[8] || '',
                destino: row[9] || ''
            })).filter(u => u.id);
        }

        // Carregar movimentações
        const movRes = await fetch(MOVIMENTACOES_URL);
        const movData = await movRes.json();
        if (movData.values && movData.values.length > 1) {
            movimentacoes = movData.values.slice(1).map(row => ({
                data: row[0] || '',
                tipo: row[1] || '',
                idUnidade: row[2] || '',
                sku: row[3] || '',
                volume: parseInt(row[4]) || 0,
                quantidade: parseFloat(row[5]) || 0,
                destino: row[6] || '',
                responsavel: row[7] || '',
                observacao: row[8] || ''
            })).filter(m => m.data);
        }

        atualizarInterface();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        carregarDadosExemplo();
    }
}

// Dados de exemplo
function carregarDadosExemplo() {
    produtos = [
        { sku: '00030786', nome: 'SC LAM/VAL 016X032', descricao: 'BELLA BRANCA RESERVA 25KG', categoria: 'Insumos', unidadeBase: 'KG', imagem: '' }
    ];
    
    unidades = [
        { id: 'UN-MKZF8ZNG-HUTE', sku: '00030786', lote: 'a1', validade: '2026-02-27', volume: 2, quantidade: 500, unidade: 'PLT', status: 'Disponível', localizacao: '-', destino: '' }
    ];
    
    movimentacoes = [];
    atualizarInterface();
}

// Atualizar interface
function atualizarInterface() {
    atualizarPainel();
    atualizarCardsProdutos();
    atualizarTabelaUnidades();
    atualizarTabelaMovimentacoes();
    atualizarUltimasMovimentacoes();
    preencherSelectProdutos();
    atualizarGraficosPainel();
}

// Atualizar painel
function atualizarPainel() {
    document.getElementById('total-produtos').textContent = produtos.length;
    document.getElementById('total-unidades').textContent = unidades.length;
    
    const hoje = new Date();
    const proximosVencer = unidades.filter(u => {
        if (!u.validade) return false;
        const validade = new Date(u.validade);
        const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
        return dias <= 30 && dias > 0;
    }).length;
    document.getElementById('proximos-vencer').textContent = proximosVencer;
    
    const estoqueBaixo = unidades.filter(u => u.quantidade < 10).length;
    document.getElementById('estoque-baixo').textContent = estoqueBaixo;
}

// Atualizar cards de produtos
function atualizarCardsProdutos() {
    const container = document.getElementById('cards-produtos');
    if (!container) return;
    
    const categoriaFiltro = document.getElementById('filtro-categoria-produto')?.value || '';
    const termoBusca = document.getElementById('search-produto')?.value.toLowerCase() || '';
    
    let produtosFiltrados = produtos;
    
    if (categoriaFiltro) {
        produtosFiltrados = produtosFiltrados.filter(p => p.categoria === categoriaFiltro);
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
        const unidadesProduto = unidades.filter(u => u.sku === produto.sku);
        const totalUnidades = unidadesProduto.length;
        const quantidadeTotal = unidadesProduto.reduce((sum, u) => sum + u.quantidade, 0);
        const categoria = categorias.find(c => c.nome === produto.categoria) || { tipo: 'Produto' };
        
        const card = document.createElement('div');
        card.className = 'col-md-4 mb-3';
        card.innerHTML = `
            <div class="card h-100 ${getCategoriaClass(produto.categoria)}">
                ${produto.imagem ? `<img src="${produto.imagem}" class="card-img-top" style="height: 150px; object-fit: cover;">` : ''}
                <div class="card-body">
                    <h5 class="card-title">${produto.nome}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">SKU: ${produto.sku}</h6>
                    <span class="badge ${getCategoriaBadgeClass(produto.categoria)}">${produto.categoria}</span>
                    <p class="card-text mt-2">${produto.descricao || ''}</p>
                    <div class="row mt-3">
                        <div class="col-6">
                            <small>Unidades: ${totalUnidades}</small>
                        </div>
                        <div class="col-6">
                            <small>Total: ${quantidadeTotal} ${produto.unidadeBase}</small>
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

// Get classe da categoria
function getCategoriaClass(categoria) {
    switch(categoria) {
        case 'Insumos': return 'border-primary';
        case 'Embalagem Papelão': return 'border-warning';
        case 'Embalagem Filme': return 'border-info';
        case 'Embalagem Sacaria': return 'border-success';
        default: return 'border-secondary';
    }
}

// Get badge da categoria
function getCategoriaBadgeClass(categoria) {
    switch(categoria) {
        case 'Insumos': return 'bg-primary';
        case 'Embalagem Papelão': return 'bg-warning text-dark';
        case 'Embalagem Filme': return 'bg-info';
        case 'Embalagem Sacaria': return 'bg-success';
        default: return 'bg-secondary';
    }
}

// Filtrar produtos
function filtrarProdutos() {
    atualizarCardsProdutos();
}

// Ver produto
function verProduto(sku) {
    const produto = produtos.find(p => p.sku === sku);
    const unidadesProduto = unidades.filter(u => u.sku === sku);
    
    const modalTitle = document.getElementById('modalVerProduto-titulo');
    if (modalTitle) modalTitle.textContent = `${produto.nome} - SKU: ${sku}`;
    
    const tbody = document.getElementById('tabela-unidades-produto');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (unidadesProduto.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhuma unidade encontrada</td></tr>';
    } else {
        unidadesProduto.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.lote}</td>
                <td>${formatarData(u.validade)}</td>
                <td>${u.volume}</td>
                <td>${u.quantidade}</td>
                <td>${u.unidade}</td>
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
    
    const modal = new bootstrap.Modal(document.getElementById('modalUnidade'));
    modal.show();
}

// Preencher select de produtos
function preencherSelectProdutos() {
    const select = document.getElementById('unidade-sku');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um produto</option>';
    produtos.forEach(p => {
        select.innerHTML += `<option value="${p.sku}">${p.nome} (${p.sku})</option>`;
    });
}

// Salvar produto
async function salvarProduto() {
    const produto = {
        tipo: 'produto',
        sku: document.getElementById('produto-sku').value,
        nome: document.getElementById('produto-nome').value,
        descricao: document.getElementById('produto-descricao').value,
        categoria: document.getElementById('produto-categoria').value,
        unidadeBase: document.getElementById('produto-unidade-base').value,
        imagem: document.getElementById('produto-imagem').value
    };
    
    if (!produto.sku || !produto.nome || !produto.categoria) {
        alert('SKU, Nome e Categoria são obrigatórios!');
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

// Salvar unidade
async function salvarUnidade() {
    const id = document.getElementById('unidade-id').value || gerarIdUnico();
    const unidade = {
        tipo: 'unidade',
        id: id,
        sku: document.getElementById('unidade-sku').value,
        lote: document.getElementById('unidade-lote').value,
        validade: document.getElementById('unidade-validade').value,
        volume: parseInt(document.getElementById('unidade-volume').value),
        quantidade: parseFloat(document.getElementById('unidade-quantidade').value),
        unidade: document.getElementById('unidade-medida').value,
        status: document.getElementById('unidade-status').value,
        localizacao: document.getElementById('unidade-localizacao').value || '-',
        destino: ''
    };
    
    if (!unidade.sku || !unidade.lote || !unidade.validade || !unidade.volume || !unidade.quantidade) {
        alert('Todos os campos são obrigatórios!');
        return;
    }
    
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
        nome: document.getElementById('categoria-nome').value,
        tipo: document.getElementById('categoria-tipo').value,
        descricao: document.getElementById('categoria-descricao').value
    };
    
    if (!categoria.nome || !categoria.tipo) {
        alert('Nome e tipo são obrigatórios!');
        return;
    }
    
    // Adicionar à lista local
    categorias.push({
        id: categorias.length + 1,
        ...categoria
    });
    
    bootstrap.Modal.getInstance(document.getElementById('modalCategoria')).hide();
    document.getElementById('form-categoria').reset();
    
    atualizarTabelaCategorias();
    preencherFiltrosCategoria();
    
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
    document.getElementById('detalhe-volume').textContent = unidadeAtual.volume;
    document.getElementById('detalhe-unidade-volume').textContent = unidadeAtual.unidade;
    document.getElementById('detalhe-quantidade').textContent = unidadeAtual.quantidade;
    document.getElementById('detalhe-unidade').textContent = unidadeAtual.unidade;
    document.getElementById('detalhe-status').innerHTML = `<span class="badge ${unidadeAtual.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${unidadeAtual.status}</span>`;
    document.getElementById('detalhe-localizacao').textContent = unidadeAtual.localizacao;
    document.getElementById('detalhe-destino').textContent = unidadeAtual.destino || '-';
    
    // Gerar QR Code pequeno
    document.getElementById('unidade-qr-code').innerHTML = '';
    new QRCode(document.getElementById('unidade-qr-code'), {
        text: unidadeAtual.id,
        width: 150,
        height: 150
    });
    
    const modal = new bootstrap.Modal(document.getElementById('modalDetalhesUnidade'));
    modal.show();
}

// Ver QR Code completo em nova aba
function verQRCodeCompleto() {
    if (!unidadeAtual) return;
    
    const produto = produtos.find(p => p.sku === unidadeAtual.sku);
    
    // Abrir nova aba com o QR Code
    const url = `qr-view.html?id=${unidadeAtual.id}&sku=${unidadeAtual.sku}&lote=${unidadeAtual.lote}&validade=${unidadeAtual.validade}&produto=${encodeURIComponent(produto?.nome || '')}&volume=${unidadeAtual.volume}&quantidade=${unidadeAtual.quantidade}&unidade=${unidadeAtual.unidade}`;
    
    window.open(url, '_blank', 'width=600,height=700');
}

// Preencher filtros de unidades
function preencherFiltrosUnidades() {
    const selectProduto = document.getElementById('filtro-produto-unidades');
    if (selectProduto) {
        selectProduto.innerHTML = '<option value="">Todos os produtos</option>';
        produtos.forEach(p => {
            selectProduto.innerHTML += `<option value="${p.sku}">${p.nome}</option>`;
        });
    }
    
    const selectDestino = document.getElementById('filtro-destino-unidades');
    if (selectDestino) {
        selectDestino.innerHTML = '<option value="">Todos os destinos</option>';
        destinos.forEach(d => {
            selectDestino.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }
}

// Filtrar unidades
function filtrarUnidades() {
    const skuFiltro = document.getElementById('filtro-produto-unidades')?.value;
    const statusFiltro = document.getElementById('filtro-status-unidades')?.value;
    const destinoFiltro = document.getElementById('filtro-destino-unidades')?.value;
    
    let unidadesFiltradas = [...unidades];
    
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
    
    atualizarTabelaUnidades(unidadesFiltradas);
}

// Atualizar tabela de unidades
function atualizarTabelaUnidades(unidadesFiltradas = null) {
    const tbody = document.getElementById('tabela-unidades');
    if (!tbody) return;
    
    const dados = unidadesFiltradas || unidades;
    const hoje = new Date();
    
    tbody.innerHTML = '';
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">Nenhuma unidade encontrada</td></tr>';
        return;
    }
    
    dados.forEach(u => {
        const produto = produtos.find(p => p.sku === u.sku);
        const validadeDate = new Date(u.validade);
        const vencido = validadeDate < hoje;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><small>${u.id}</small></td>
            <td>${produto ? produto.nome : u.sku}</td>
            <td><span class="badge ${getCategoriaBadgeClass(produto?.categoria)}">${produto?.categoria || '-'}</span></td>
            <td>${u.lote}</td>
            <td class="${vencido ? 'text-danger fw-bold' : ''}">${formatarData(u.validade)}</td>
            <td>${u.volume}</td>
            <td>${u.quantidade} ${u.unidade}</td>
            <td><span class="badge ${u.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${u.status}</span></td>
            <td>${u.destino || '-'}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="verUnidade('${u.id}')">
                    <i class="bi bi-eye"></i>
                </button>
                ${u.status === 'Disponível' ? `
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
    unidadeAtual = unidades.find(u => u.id === id);
    if (!unidadeAtual) return;
    
    // Redirecionar para página de baixa
    const produto = produtos.find(p => p.sku === unidadeAtual.sku);
    
    const url = `baixa-view.html?id=${unidadeAtual.id}&sku=${unidadeAtual.sku}&lote=${unidadeAtual.lote}&validade=${unidadeAtual.validade}&produto=${encodeURIComponent(produto?.nome || '')}&volume=${unidadeAtual.volume}&quantidade=${unidadeAtual.quantidade}&unidade=${unidadeAtual.unidade}`;
    
    window.open(url, '_blank', 'width=700,height=800');
}

// Configurar QR Code scanner
function setupQRCode() {
    if (typeof Html5Qrcode === 'undefined') {
        console.error('Biblioteca Html5Qrcode não carregada!');
        document.getElementById('qr-reader').innerHTML = `
            <div class="alert alert-danger">
                Erro ao carregar leitor QR Code.
            </div>
        `;
        return;
    }
    
    const html5QrCode = new Html5Qrcode("qr-reader");
    
    const qrCodeSuccessCallback = (decodedText) => {
        const unidade = unidades.find(u => u.id === decodedText);
        if (unidade) {
            const produto = produtos.find(p => p.sku === unidade.sku);
            
            // Abrir página de baixa automaticamente
            const url = `baixa-view.html?id=${unidade.id}&sku=${unidade.sku}&lote=${unidade.lote}&validade=${unidade.validade}&produto=${encodeURIComponent(produto?.nome || '')}&volume=${unidade.volume}&quantidade=${unidade.quantidade}&unidade=${unidade.unidade}`;
            
            window.open(url, '_blank', 'width=700,height=800');
            
            document.getElementById('qr-resultado').innerHTML = `
                <div class="alert alert-success">
                    <h6>✅ Redirecionando para página de baixa...</h6>
                    <p>Unidade: ${unidade.id}</p>
                </div>
            `;
        } else {
            document.getElementById('qr-resultado').innerHTML = `
                <div class="alert alert-danger">
                    ❌ Unidade não encontrada!<br>
                    Código: ${decodedText}
                </div>
            `;
        }
    };
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch(err => {
            console.error('Erro ao iniciar QR Code:', err);
            document.getElementById('qr-reader').innerHTML = `
                <div class="alert alert-warning">
                    Não foi possível acessar a câmera.
                </div>
            `;
        });
}

// Atualizar tabela de movimentações
function atualizarTabelaMovimentacoes(movFiltradas = null) {
    const tbody = document.getElementById('tabela-movimentacoes');
    if (!tbody) return;
    
    const dados = movFiltradas || movimentacoes;
    
    tbody.innerHTML = '';
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhuma movimentação registrada</td></tr>';
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
            <td>${mov.volume || '-'}</td>
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
    
    if (dataInicio) {
        filtradas = filtradas.filter(m => m.data >= dataInicio);
    }
    
    if (dataFim) {
        filtradas = filtradas.filter(m => m.data <= dataFim);
    }
    
    if (tipo) {
        filtradas = filtradas.filter(m => m.tipo === tipo);
    }
    
    if (destino) {
        filtradas = filtradas.filter(m => m.destino === destino);
    }
    
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
                <span>${mov.quantidade}</span>
            </div>
            <small>${produto ? produto.nome : mov.sku} - ${mov.idUnidade}</small>
            ${mov.destino ? `<br><small>Destino: ${mov.destino}</small>` : ''}
        `;
        container.appendChild(div);
    });
}

// Atualizar gráficos do painel
function atualizarGraficosPainel() {
    // Gráfico de categorias
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
                    backgroundColor: ['#007bff', '#fd7e14', '#dc3545', '#28a745', '#6f42c1']
                }]
            }
        });
    }
}

// Gerar relatórios
function gerarRelatorios() {
    // Gráfico de categorias (relatório)
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
                    backgroundColor: '#007bff'
                }]
            }
        });
    }
    
    // Gráfico de status
    const ctxStatus = document.getElementById('grafico-status');
    if (ctxStatus) {
        const disponiveis = unidades.filter(u => u.status === 'Disponível').length;
        const bloqueados = unidades.filter(u => u.status === 'Bloqueado').length;
        const transferidos = unidades.filter(u => u.destino).length;
        
        new Chart(ctxStatus, {
            type: 'pie',
            data: {
                labels: ['Disponíveis', 'Bloqueados', 'Transferidos'],
                datasets: [{
                    data: [disponiveis, bloqueados, transferidos],
                    backgroundColor: ['#28a745', '#dc3545', '#fd7e14']
                }]
            }
        });
    }
    
    // Gráfico de destinos
    const ctxDestinos = document.getElementById('grafico-destinos');
    if (ctxDestinos) {
        const destinosData = destinos.map(d => {
            return unidades.filter(u => u.destino === d).length;
        });
        
        new Chart(ctxDestinos, {
            type: 'bar',
            data: {
                labels: destinos,
                datasets: [{
                    label: 'Unidades por Destino',
                    data: destinosData,
                    backgroundColor: '#fd7e14'
                }]
            }
        });
    }
    
    // Lista de estoque baixo
    const containerEstoque = document.getElementById('lista-estoque-baixo');
    if (containerEstoque) {
        const estoqueBaixo = produtos.filter(p => {
            const total = unidades
                .filter(u => u.sku === p.sku)
                .reduce((sum, u) => sum + u.quantidade, 0);
            return total < 10;
        });
        
        if (estoqueBaixo.length === 0) {
            containerEstoque.innerHTML = '<p class="text-success">✅ Todos os produtos têm estoque adequado</p>';
        } else {
            containerEstoque.innerHTML = '<ul class="list-group">';
            estoqueBaixo.forEach(p => {
                const total = unidades
                    .filter(u => u.sku === p.sku)
                    .reduce((sum, u) => sum + u.quantidade, 0);
                containerEstoque.innerHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        ${p.nome} (${p.sku})
                        <span class="badge bg-danger rounded-pill">${total} ${p.unidadeBase}</span>
                    </li>
                `;
            });
            containerEstoque.innerHTML += '</ul>';
        }
    }
    
    // Lista de validades próximas
    const containerValidades = document.getElementById('lista-validades');
    if (containerValidades) {
        const hoje = new Date();
        const validades = unidades
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
                        ${produto ? produto.nome : u.sku} - Lote ${u.lote}
                        <span class="badge ${u.dias <= 7 ? 'bg-danger' : 'bg-warning'} rounded-pill">${u.dias} dias</span>
                    </li>
                `;
            });
            containerValidades.innerHTML += '</ul>';
        }
    }
}

// Função auxiliar para formatar data
function formatarData(data) {
    if (!data) return '';
    const d = new Date(data);
    if (isNaN(d.getTime())) return data;
    return d.toLocaleDateString('pt-BR');
}
