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
let graficoValidades = null;
let unidadeAtual = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    carregarDados();
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    document.getElementById('menu-painel').addEventListener('click', () => mostrarView('painel'));
    document.getElementById('menu-produtos').addEventListener('click', () => mostrarView('produtos'));
    document.getElementById('menu-unidades').addEventListener('click', () => mostrarView('unidades'));
    document.getElementById('menu-scanner').addEventListener('click', () => mostrarView('scanner'));
    document.getElementById('menu-movimentacoes').addEventListener('click', () => mostrarView('movimentacoes'));
    document.getElementById('menu-relatorios').addEventListener('click', () => mostrarView('relatorios'));
    
    document.getElementById('salvar-produto').addEventListener('click', salvarProduto);
    document.getElementById('salvar-unidade').addEventListener('click', salvarUnidade);
    document.getElementById('salvar-movimentacao').addEventListener('click', salvarMovimentacao);
    
    document.getElementById('search-produto').addEventListener('keyup', filtrarProdutos);
    document.getElementById('filtro-produto-unidades').addEventListener('change', filtrarUnidades);
    document.getElementById('filtro-status-unidades').addEventListener('change', filtrarUnidades);
}

// Mostrar view
function mostrarView(view) {
    const views = ['painel', 'produtos', 'unidades', 'scanner', 'movimentacoes', 'relatorios'];
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
    if (view === 'unidades') preencherFiltrosUnidades();
    if (view === 'relatorios') gerarRelatorios();
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
                unidadeBase: row[3] || 'UN',
                imagem: row[4] || ''
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
                quantidade: parseFloat(row[4]) || 0,
                unidade: row[5] || 'UN',
                status: row[6] || 'Disponível',
                localizacao: row[7] || ''
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
                quantidade: parseFloat(row[4]) || 0,
                responsavel: row[5] || '',
                observacao: row[6] || ''
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
        { sku: '00030786', nome: 'SC LAM/VAL 016X032', descricao: 'BELLA BRANCA RESERVA 25KG', unidadeBase: 'KG', imagem: '' }
    ];
    
    unidades = [
        { id: 'UN-MKZF8ZNG-HUTE', sku: '00030786', lote: 'a1', validade: '2026-02-27', quantidade: 500, unidade: 'PLT', status: 'Disponível', localizacao: '-' }
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
    atualizarGraficoEstoque();
    atualizarAlertas();
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
    
    container.innerHTML = '';
    
    if (produtos.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted">Nenhum produto cadastrado</p></div>';
        return;
    }
    
    produtos.forEach(produto => {
        const unidadesProduto = unidades.filter(u => u.sku === produto.sku);
        const totalUnidades = unidadesProduto.length;
        const quantidadeTotal = unidadesProduto.reduce((sum, u) => sum + u.quantidade, 0);
        
        const card = document.createElement('div');
        card.className = 'col-md-4 mb-3';
        card.innerHTML = `
            <div class="card h-100">
                ${produto.imagem ? `<img src="${produto.imagem}" class="card-img-top" style="height: 150px; object-fit: cover;">` : ''}
                <div class="card-body">
                    <h5 class="card-title">${produto.nome}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">SKU: ${produto.sku}</h6>
                    <p class="card-text">${produto.descricao || ''}</p>
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
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhuma unidade encontrada</td></tr>';
    } else {
        unidadesProduto.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.lote}</td>
                <td>${formatarData(u.validade)}</td>
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
        unidadeBase: document.getElementById('produto-unidade-base').value,
        imagem: document.getElementById('produto-imagem').value
    };
    
    if (!produto.sku || !produto.nome) {
        alert('SKU e Nome são obrigatórios!');
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
        quantidade: parseFloat(document.getElementById('unidade-quantidade').value),
        unidade: document.getElementById('unidade-medida').value,
        status: document.getElementById('unidade-status').value,
        localizacao: document.getElementById('unidade-localizacao').value || '-'
    };
    
    if (!unidade.sku || !unidade.lote || !unidade.validade || !unidade.quantidade) {
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
            // Edição
            const index = unidades.findIndex(u => u.id === id);
            if (index !== -1) unidades[index] = unidade;
        } else {
            // Novo
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
    document.getElementById('detalhe-sku').textContent = unidadeAtual.sku;
    document.getElementById('detalhe-lote').textContent = unidadeAtual.lote;
    document.getElementById('detalhe-validade').textContent = formatarData(unidadeAtual.validade);
    document.getElementById('detalhe-quantidade').textContent = unidadeAtual.quantidade;
    document.getElementById('detalhe-unidade').textContent = unidadeAtual.unidade;
    document.getElementById('detalhe-status').innerHTML = `<span class="badge ${unidadeAtual.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${unidadeAtual.status}</span>`;
    document.getElementById('detalhe-localizacao').textContent = unidadeAtual.localizacao;
    
    // Gerar QR Code
    document.getElementById('unidade-qr-code').innerHTML = '';
    new QRCode(document.getElementById('unidade-qr-code'), {
        text: unidadeAtual.id,
        width: 200,
        height: 200
    });
    
    const modal = new bootstrap.Modal(document.getElementById('modalDetalhesUnidade'));
    modal.show();
}

// Editar unidade
function editarUnidade() {
    if (!unidadeAtual) return;
    
    bootstrap.Modal.getInstance(document.getElementById('modalDetalhesUnidade')).hide();
    
    preencherSelectProdutos();
    document.getElementById('unidade-id').value = unidadeAtual.id;
    document.getElementById('unidade-sku').value = unidadeAtual.sku;
    document.getElementById('unidade-lote').value = unidadeAtual.lote;
    document.getElementById('unidade-validade').value = unidadeAtual.validade;
    document.getElementById('unidade-quantidade').value = unidadeAtual.quantidade;
    document.getElementById('unidade-medida').value = unidadeAtual.unidade;
    document.getElementById('unidade-localizacao').value = unidadeAtual.localizacao;
    document.getElementById('unidade-status').value = unidadeAtual.status;
    
    const modal = new bootstrap.Modal(document.getElementById('modalUnidade'));
    modal.show();
}

// Baixar QR Code
function baixarQRCode() {
    const canvas = document.querySelector('#unidade-qr-code canvas');
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `qrcode-${unidadeAtual.id}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

// Abrir modal movimentação
function abrirModalMovimentacao(tipo) {
    if (!unidadeAtual) return;
    
    document.getElementById('movimentacao-id-unidade').value = unidadeAtual.id;
    document.getElementById('movimentacao-tipo').value = tipo === 'entrada' ? 'Entrada' : 'Saída';
    document.getElementById('movimentacao-quantidade').value = '';
    document.getElementById('movimentacao-responsavel').value = '';
    document.getElementById('movimentacao-observacao').value = '';
    
    bootstrap.Modal.getInstance(document.getElementById('modalDetalhesUnidade')).hide();
    
    const modal = new bootstrap.Modal(document.getElementById('modalMovimentacao'));
    modal.show();
}

// Salvar movimentação
async function salvarMovimentacao() {
    const idUnidade = document.getElementById('movimentacao-id-unidade').value;
    const unidade = unidades.find(u => u.id === idUnidade);
    if (!unidade) return;
    
    const tipo = document.getElementById('movimentacao-tipo').value;
    const quantidade = parseFloat(document.getElementById('movimentacao-quantidade').value);
    const responsavel = document.getElementById('movimentacao-responsavel').value;
    const observacao = document.getElementById('movimentacao-observacao').value;
    
    if (!quantidade || quantidade <= 0) {
        alert('Quantidade inválida!');
        return;
    }
    
    if (tipo === 'Saída' && unidade.quantidade < quantidade) {
        alert('Quantidade insuficiente em estoque!');
        return;
    }
    
    // Atualizar quantidade da unidade
    unidade.quantidade += tipo === 'Entrada' ? quantidade : -quantidade;
    
    const movimentacao = {
        tipo: 'movimentacao',
        data: new Date().toISOString().split('T')[0],
        tipoMov: tipo,
        idUnidade: unidade.id,
        sku: unidade.sku,
        quantidade: quantidade,
        responsavel: responsavel || 'Sistema',
        observacao: observacao
    };
    
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(movimentacao)
        });
        
        // Atualizar unidade
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo: 'unidade',
                ...unidade
            })
        });
        
        movimentacoes.push(movimentacao);
        
        bootstrap.Modal.getInstance(document.getElementById('modalMovimentacao')).hide();
        atualizarInterface();
        
        alert('Movimentação registrada com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar movimentação:', error);
        alert('Erro ao registrar movimentação.');
    }
}

// Bloquear unidade
async function bloquearUnidade() {
    if (!unidadeAtual) return;
    
    if (!confirm(`Deseja ${unidadeAtual.status === 'Disponível' ? 'bloquear' : 'desbloquear'} esta unidade?`)) return;
    
    unidadeAtual.status = unidadeAtual.status === 'Disponível' ? 'Bloqueado' : 'Disponível';
    
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo: 'unidade',
                ...unidadeAtual
            })
        });
        
        bootstrap.Modal.getInstance(document.getElementById('modalDetalhesUnidade')).hide();
        atualizarInterface();
        
        alert(`Unidade ${unidadeAtual.status === 'Disponível' ? 'desbloqueada' : 'bloqueada'} com sucesso!`);
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        alert('Erro ao alterar status.');
    }
}

// Preencher filtros de unidades
function preencherFiltrosUnidades() {
    const selectProduto = document.getElementById('filtro-produto-unidades');
    if (!selectProduto) return;
    
    selectProduto.innerHTML = '<option value="">Todos os produtos</option>';
    produtos.forEach(p => {
        selectProduto.innerHTML += `<option value="${p.sku}">${p.nome}</option>`;
    });
}

// Filtrar unidades
function filtrarUnidades() {
    const skuFiltro = document.getElementById('filtro-produto-unidades').value;
    const statusFiltro = document.getElementById('filtro-status-unidades').value;
    
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
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhuma unidade encontrada</td></tr>';
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
            <td>${u.lote}</td>
            <td class="${vencido ? 'text-danger fw-bold' : ''}">${formatarData(u.validade)}</td>
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

// Atualizar tabela de movimentações
function atualizarTabelaMovimentacoes(movFiltradas = null) {
    const tbody = document.getElementById('tabela-movimentacoes');
    if (!tbody) return;
    
    const dados = movFiltradas || movimentacoes;
    
    tbody.innerHTML = '';
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma movimentação registrada</td></tr>';
        return;
    }
    
    dados.slice(-50).reverse().forEach(mov => {
        const produto = produtos.find(p => p.sku === mov.sku);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatarData(mov.data)}</td>
            <td><span class="badge ${mov.tipo === 'Entrada' ? 'bg-success' : 'bg-warning'}">${mov.tipo}</span></td>
            <td><small>${mov.idUnidade}</small></td>
            <td>${produto ? produto.nome : mov.sku}</td>
            <td>${mov.quantidade}</td>
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
        div.className = 'alert alert-light border mb-2';
        div.innerHTML = `
            <div class="d-flex justify-content-between">
                <span><strong>${formatarData(mov.data)}</strong> - ${mov.tipo}</span>
                <span class="badge ${mov.tipo === 'Entrada' ? 'bg-success' : 'bg-warning'}">${mov.quantidade}</span>
            </div>
            <small>${produto ? produto.nome : mov.sku} - ${mov.idUnidade}</small>
            ${mov.responsavel ? `<br><small>Responsável: ${mov.responsavel}</small>` : ''}
        `;
        container.appendChild(div);
    });
}

// Filtrar produtos
function filtrarProdutos() {
    const termo = document.getElementById('search-produto').value.toLowerCase();
    
    if (termo === '') {
        atualizarCardsProdutos();
        return;
    }
    
    const filtrados = produtos.filter(p => 
        p.nome.toLowerCase().includes(termo) || 
        p.sku.toLowerCase().includes(termo) ||
        (p.descricao && p.descricao.toLowerCase().includes(termo))
    );
    
    const container = document.getElementById('cards-produtos');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (filtrados.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted">Nenhum produto encontrado</p></div>';
        return;
    }
    
    filtrados.forEach(produto => {
        const unidadesProduto = unidades.filter(u => u.sku === produto.sku);
        const totalUnidades = unidadesProduto.length;
        const quantidadeTotal = unidadesProduto.reduce((sum, u) => sum + u.quantidade, 0);
        
        const card = document.createElement('div');
        card.className = 'col-md-4 mb-3';
        card.innerHTML = `
            <div class="card h-100">
                ${produto.imagem ? `<img src="${produto.imagem}" class="card-img-top" style="height: 150px; object-fit: cover;">` : ''}
                <div class="card-body">
                    <h5 class="card-title">${produto.nome}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">SKU: ${produto.sku}</h6>
                    <p class="card-text">${produto.descricao || ''}</p>
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
            document.getElementById('qr-resultado').innerHTML = `
                <div class="alert alert-success">
                    <h6>✅ Unidade encontrada!</h6>
                    <p><strong>ID:</strong> ${unidade.id}</p>
                    <p><strong>Produto:</strong> ${produto ? produto.nome : unidade.sku}</p>
                    <p><strong>Lote:</strong> ${unidade.lote}</p>
                    <p><strong>Validade:</strong> ${formatarData(unidade.validade)}</p>
                    <p><strong>Quantidade:</strong> ${unidade.quantidade} ${unidade.unidade}</p>
                    <p><strong>Status:</strong> <span class="badge ${unidade.status === 'Disponível' ? 'bg-success' : 'bg-danger'}">${unidade.status}</span></p>
                    <button class="btn btn-primary btn-sm mt-2" onclick="verUnidade('${unidade.id}')">
                        Ver detalhes
                    </button>
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

// Atualizar gráfico de estoque
function atualizarGraficoEstoque() {
    const ctx = document.getElementById('grafico-estoque');
    if (!ctx) return;
    
    if (graficoEstoque) graficoEstoque.destroy();
    
    const labels = produtos.slice(0, 8).map(p => p.nome);
    const data = produtos.slice(0, 8).map(p => {
        const unidadesProduto = unidades.filter(u => u.sku === p.sku);
        return unidadesProduto.reduce((sum, u) => sum + u.quantidade, 0);
    });
    
    graficoEstoque = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantidade em Estoque',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Gerar relatórios
function gerarRelatorios() {
    // Gráfico de status
    const ctxStatus = document.getElementById('grafico-status');
    if (ctxStatus) {
        if (graficoStatus) graficoStatus.destroy();
        
        const disponiveis = unidades.filter(u => u.status === 'Disponível').length;
        const bloqueados = unidades.filter(u => u.status === 'Bloqueado').length;
        
        graficoStatus = new Chart(ctxStatus, {
            type: 'pie',
            data: {
                labels: ['Disponíveis', 'Bloqueados'],
                datasets: [{
                    data: [disponiveis, bloqueados],
                    backgroundColor: ['#28a745', '#dc3545']
                }]
            }
        });
    }
    
    // Gráfico de validades
    const ctxValidades = document.getElementById('grafico-validades');
    if (ctxValidades) {
        if (graficoValidades) graficoValidades.destroy();
        
        const hoje = new Date();
        const vencidos = unidades.filter(u => {
            if (!u.validade) return false;
            return new Date(u.validade) < hoje;
        }).length;
        
        const aVencer30 = unidades.filter(u => {
            if (!u.validade) return false;
            const dias = Math.ceil((new Date(u.validade) - hoje) / (1000 * 60 * 60 * 24));
            return dias > 0 && dias <= 30;
        }).length;
        
        const ok = unidades.filter(u => {
            if (!u.validade) return false;
            const dias = Math.ceil((new Date(u.validade) - hoje) / (1000 * 60 * 60 * 24));
            return dias > 30;
        }).length;
        
        graficoValidades = new Chart(ctxValidades, {
            type: 'doughnut',
            data: {
                labels: ['Vencidos', 'Próximos (30 dias)', 'OK'],
                datasets: [{
                    data: [vencidos, aVencer30, ok],
                    backgroundColor: ['#dc3545', '#ffc107', '#28a745']
                }]
            }
        });
    }
    
    // Lista de estoque baixo
    const container = document.getElementById('lista-estoque-baixo');
    if (container) {
        const estoqueBaixo = produtos.filter(p => {
            const total = unidades
                .filter(u => u.sku === p.sku)
                .reduce((sum, u) => sum + u.quantidade, 0);
            return total < 10;
        });
        
        if (estoqueBaixo.length === 0) {
            container.innerHTML = '<p class="text-success">✅ Todos os produtos têm estoque adequado</p>';
        } else {
            container.innerHTML = '<ul class="list-group">';
            estoqueBaixo.forEach(p => {
                const total = unidades
                    .filter(u => u.sku === p.sku)
                    .reduce((sum, u) => sum + u.quantidade, 0);
                container.innerHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        ${p.nome} (${p.sku})
                        <span class="badge bg-danger rounded-pill">${total} ${p.unidadeBase}</span>
                    </li>
                `;
            });
            container.innerHTML += '</ul>';
        }
    }
}

// Atualizar alertas de validade
function atualizarAlertas() {
    const container = document.getElementById('alertas-validade');
    if (!container) return;
    
    container.innerHTML = '';
    
    const hoje = new Date();
    const unidadesOrdenadas = [...unidades]
        .filter(u => u.validade)
        .sort((a, b) => new Date(a.validade) - new Date(b.validade));
    
    if (unidadesOrdenadas.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhuma unidade com validade</p>';
        return;
    }
    
    unidadesOrdenadas.slice(0, 8).forEach(unidade => {
        const validade = new Date(unidade.validade);
        const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
        const produto = produtos.find(p => p.sku === unidade.sku);
        
        const div = document.createElement('div');
        div.className = dias <= 0 ? 'alerta-vencido' : 'alerta-vencimento';
        
        if (dias <= 0) {
            div.innerHTML = `<strong>VENCIDO:</strong> ${produto ? produto.nome : unidade.sku} - Lote ${unidade.lote}`;
        } else if (dias <= 7) {
            div.innerHTML = `<strong>URGENTE:</strong> ${produto ? produto.nome : unidade.sku} - Vence em ${dias} dias`;
        } else if (dias <= 15) {
            div.innerHTML = `<strong>ATENÇÃO:</strong> ${produto ? produto.nome : unidade.sku} - Vence em ${dias} dias`;
        } else if (dias <= 30) {
            div.innerHTML = `<strong>ALERTA:</strong> ${produto ? produto.nome : unidade.sku} - Vence em ${dias} dias`;
        }
        
        container.appendChild(div);
    });
}

// Função auxiliar para formatar data
function formatarData(data) {
    if (!data) return '';
    const d = new Date(data);
    if (isNaN(d.getTime())) return data;
    return d.toLocaleDateString('pt-BR');
}
