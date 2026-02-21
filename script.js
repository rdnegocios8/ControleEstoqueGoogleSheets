// Configurações do Google Sheets
const SHEET_ID = '1We0xDOamU_iIGNcm_YxZ8jbBGNWK1PIyljgDb9xWf84';
const API_KEY = 'AIzaSyCShYO-EV8ZcjuOFuYedULIrfcwOgbcwsU';
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbysRomAyxbYAgrqdqqURTTAbwnGFiv9VXD_x11nzwdYbwmKMySmReWH9MBNcR3aeX9S/exec';

// URLs da API
const PRODUTOS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Produtos?key=${API_KEY}`;
const UNIDADES_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Unidades?key=${API_KEY}`;
const MOVIMENTACOES_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Movimentações?key=${API_KEY}`;
const RECEBIMENTOS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Recebimentos?key=${API_KEY}`;

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

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    carregarDados();
    setupEventListeners();
    preencherFiltros();
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
    
    document.getElementById('recebimento-sku').addEventListener('change', atualizarInfoRecebimento);
    document.getElementById('recebimento-volume').addEventListener('input', calcularQuantidadeRecebimento);
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

// Atualizar informações da embalagem ao selecionar produto
function atualizarInfoEmbalagem() {
    const select = document.getElementById('unidade-sku');
    const selectedOption = select.options[select.selectedIndex];
    const tipoEmbalagem = selectedOption.dataset.tipo || 'UN';
    const qtdPorEmbalagem = parseInt(selectedOption.dataset.qtd) || 1;
    
    document.getElementById('volume-label').textContent = `Volume (${tipoEmbalagem})`;
    document.getElementById('quantidade-unidade').textContent = '(UN)';
    document.getElementById('volume-descricao').textContent = `Número de ${tipoEmbalagem}`;
    
    calcularQuantidadeAutomatica();
}

// ============================================
// FUNÇÕES DE RECEBIMENTO
// ============================================

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

// Salvar recebimento
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
            qtdRealPorEmbalagem: null
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
            recebimentos = data.values.slice(1).map(row => ({
                data: row[0],
                nf: row[1],
                fornecedor: row[2],
                sku: row[3],
                produto: row[4],
                lote: row[5],
                validade: row[6],
                quantidade: row[7],
                volume: row[8],
                unidade: row[9],
                qtdPorEmbalagem: row[10],
                localizacao: row[11],
                responsavel: row[12],
                observacoes: row[13]
            }));
            
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

// Filtrar recebimentos
function filtrarRecebimentos() {
    const dataInicio = document.getElementById('filtro-recebimento-data-inicio').value;
    const dataFim = document.getElementById('filtro-recebimento-data-fim').value;
    const fornecedor = document.getElementById('filtro-recebimento-fornecedor').value.toLowerCase();
    
    let filtrados = [...recebimentos];
    
    if (dataInicio) {
        filtrados = filtrados.filter(r => r.data >= dataInicio);
    }
    
    if (dataFim) {
        filtrados = filtrados.filter(r => r.data <= dataFim);
    }
    
    if (fornecedor) {
        filtrados = filtrados.filter(r => r.fornecedor && r.fornecedor.toLowerCase().includes(fornecedor));
    }
    
    atualizarTabelaRecebimentos(filtrados);
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
        carregarRecebimentos();
    }
    if (view === 'relatorios') gerarRelatorios();
    if (view === 'categorias') atualizarTabelaCategorias();
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
            produtos = produtosData.values.slice(1).map(row => ({
                sku: row[0] || '',
                nome: row[1] || '',
                descricao: row[2] || '',
                categoria: row[3] || 'Insumos',
                tipoEmbalagem: row[4] || 'UN',
                qtdPorEmbalagem: parseInt(row[5]) || 1,
                unidadeBase: row[6] || 'UN',
                imagem: row[7] || ''
            })).filter(p => p.sku);
        }

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
                unidadeEmbalagem: row[6] || 'UN',
                status: row[7] || 'Disponível',
                localizacao: row[8] || '-',
                destino: row[9] || '',
                foraPadrao: row[10] === 'Sim',
                qtdRealPorEmbalagem: row[11] ? parseInt(row[11]) : null
            })).filter(u => u.id);
        }

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
                unidadeEmbalagem: row[6] || '',
                destino: row[7] || '',
                responsavel: row[8] || '',
                observacao: row[9] || ''
            })).filter(m => m.data);
        }

        await carregarRecebimentos();
        atualizarInterface();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        carregarDadosExemplo();
    }
}

// Dados de exemplo
function carregarDadosExemplo() {
    produtos = [
        { sku: '300214', nome: 'Una especial 50Kg', descricao: 'Farinha de trigo', categoria: 'Insumos', tipoEmbalagem: 'MALA', qtdPorEmbalagem: 50, unidadeBase: 'KG', imagem: '' },
        { sku: '303050', nome: 'saco vitella', descricao: 'Embalagem para farinha', categoria: 'Embalagem Sacaria', tipoEmbalagem: 'PCT', qtdPorEmbalagem: 100, unidadeBase: 'UN', imagem: '' }
    ];
    
    unidades = [
        { id: 'UN-E53UOSQY-Z1D0', sku: '300214', lote: '5050', validade: '2026-05-05', volume: 10, quantidade: 500, unidadeEmbalagem: 'MALA', status: 'Disponível', localizacao: 'Prateleira A1', destino: '', foraPadrao: false, qtdRealPorEmbalagem: null },
        { id: 'UN-5NZBIQR7-KQMG', sku: '303050', lote: 'vite01', validade: '2026-04-05', volume: 20, quantidade: 2000, unidadeEmbalagem: 'PCT', status: 'Disponível', localizacao: 'Prateleira B2', destino: '', foraPadrao: false, qtdRealPorEmbalagem: null }
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
// FUNÇÕES CORRIGIDAS - FILTRO DE UNIDADES ATIVAS
// ============================================

// Atualizar painel - MOSTRAR APENAS UNIDADES COM QUANTIDADE > 0
function atualizarPainel() {
    const unidadesAtivas = unidades.filter(u => u.quantidade > 0);
    
    document.getElementById('total-produtos').textContent = produtos.length;
    document.getElementById('total-unidades').textContent = unidadesAtivas.length;
    
    const hoje = new Date();
    const proximosVencer = unidadesAtivas.filter(u => {
        if (!u.validade) return false;
        const validade = new Date(u.validade);
        const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
        return dias <= 30 && dias > 0;
    }).length;
    document.getElementById('proximos-vencer').textContent = proximosVencer;
    
    const estoqueBaixo = unidadesAtivas.filter(u => u.quantidade < 10).length;
    document.getElementById('estoque-baixo').textContent = estoqueBaixo;
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
        // Considerar apenas unidades ativas (quantidade > 0)
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
                            <small>Total: ${totalQuantidade} UN</small>
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

// Ver produto - MOSTRAR APENAS UNIDADES ATIVAS
function verProduto(sku) {
    const produto = produtos.find(p => p.sku === sku);
    // Mostrar apenas unidades ativas (quantidade > 0)
    const unidadesProduto = unidades.filter(u => u.sku === sku && u.quantidade > 0);
    
    document.getElementById('modalVerProduto-titulo').textContent = `${produto.nome} - SKU: ${sku} (${produto.tipoEmbalagem})`;
    
    const tbody = document.getElementById('tabela-unidades-produto');
    tbody.innerHTML = '';
    
    if (unidadesProduto.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhuma unidade ativa encontrada</td></tr>';
    } else {
        unidadesProduto.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><small>${u.id}</small></td>
                <td>${u.lote}</td>
                <td>${formatarData(u.validade)}</td>
                <td>${u.unidadeEmbalagem}</td>
                <td>${u.volume}</td>
                <td>${u.quantidade} UN</td>
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
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalUnidade'));
    modal.show();
}

// Salvar produto
async function salvarProduto() {
    const tipoEmbalagem = document.getElementById('produto-tipo-embalagem').value;
    const qtdPorEmbalagem = tipoEmbalagem !== 'UN' ? 
        parseInt(document.getElementById('produto-qtd-por-embalagem').value) : 1;
    
    const produto = {
        tipo: 'produto',
        sku: document.getElementById('produto-sku').value,
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

// Salvar unidade
async function salvarUnidade() {
    const id = document.getElementById('unidade-id').value || gerarIdUnico();
    const sku = document.getElementById('unidade-sku').value;
    const produto = produtos.find(p => p.sku === sku);
    
    const volume = parseInt(document.getElementById('unidade-volume').value);
    const foraPadrao = document.getElementById('unidade-fora-padrao').checked;
    let quantidade = parseInt(document.getElementById('unidade-quantidade').value);
    
    if (foraPadrao) {
        const qtdReal = parseInt(document.getElementById('unidade-quantidade-real').value);
        if (qtdReal) {
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
        qtdRealPorEmbalagem: foraPadrao ? parseInt(document.getElementById('unidade-quantidade-real').value) : null
    };
    
    if (!unidade.sku || !unidade.lote || !unidade.validade || !unidade.volume) {
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
                <button class="btn btn-sm btn-warning" onclick="editarCategoria(${cat.id})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="excluirCategoria(${cat.id})"><i class="bi bi-trash"></i></button>
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
    document.getElementById('detalhe-quantidade').textContent = unidadeAtual.quantidade;
    document.getElementById('detalhe-fora-padrao').textContent = unidadeAtual.foraPadrao ? 'Sim' : 'Não';
    document.getElementById('detalhe-status').innerHTML = `<span class="badge ${unidadeAtual.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${unidadeAtual.status}</span>`;
    document.getElementById('detalhe-localizacao').textContent = unidadeAtual.localizacao;
    document.getElementById('detalhe-destino').textContent = unidadeAtual.destino || '-';
    
    const qrContainer = document.getElementById('unidade-qr-code');
    qrContainer.innerHTML = '';
    
    try {
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrContainer, {
                text: unidadeAtual.id,
                width: 150,
                height: 150
            });
        }
    } catch (e) {
        console.error('Erro ao gerar QR Code:', e);
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalDetalhesUnidade'));
    modal.show();
}

// Ver QR Code completo
function verQRCodeCompleto() {
    if (!unidadeAtual) return;
    
    const produto = produtos.find(p => p.sku === unidadeAtual.sku);
    
    const url = `qr-view.html?id=${unidadeAtual.id}&sku=${unidadeAtual.sku}&lote=${unidadeAtual.lote}&validade=${unidadeAtual.validade}&produto=${encodeURIComponent(produto?.nome || '')}&volume=${unidadeAtual.volume}&quantidade=${unidadeAtual.quantidade}&unidade=${unidadeAtual.unidadeEmbalagem}`;
    
    window.open(url, '_blank', 'width=600,height=700');
}

// ============================================
// FUNÇÕES CORRIGIDAS - FILTRO DE UNIDADES
// ============================================

// Filtrar unidades - CONSIDERAR APENAS QUANTIDADE > 0
function filtrarUnidades() {
    const skuFiltro = document.getElementById('filtro-produto-unidades')?.value;
    const statusFiltro = document.getElementById('filtro-status-unidades')?.value;
    const destinoFiltro = document.getElementById('filtro-destino-unidades')?.value;
    const embalagemFiltro = document.getElementById('filtro-embalagem-unidades')?.value;
    
    // Começar com unidades que têm quantidade > 0
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

// Atualizar tabela de unidades - MOSTRAR APENAS UNIDADES COM QUANTIDADE > 0
function atualizarTabelaUnidades(unidadesFiltradas = null) {
    const tbody = document.getElementById('tabela-unidades');
    if (!tbody) return;
    
    // Se não veio filtro, mostrar apenas unidades ativas
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
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><small>${u.id}</small></td>
            <td>${produto ? produto.nome : u.sku}</td>
            <td><span class="badge ${getCategoriaBadgeClass(produto?.categoria)}">${produto?.categoria || '-'}</span></td>
            <td><span class="badge bg-info">${u.unidadeEmbalagem}</span></td>
            <td>${u.lote}</td>
            <td class="${vencido ? 'text-danger fw-bold' : ''}">${formatarData(u.validade)}</td>
            <td>${u.volume}</td>
            <td>${u.quantidade} UN</td>
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
            <td>${mov.quantidade} UN</td>
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

// Gerar relatórios - CONSIDERAR APENAS UNIDADES ATIVAS
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

function formatarData(data) {
    if (!data) return '';
    const d = new Date(data);
    if (isNaN(d.getTime())) return data;
    return d.toLocaleDateString('pt-BR');
}
