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

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    carregarDados();
    setupEventListeners();
    setupQRCode();
});

// Configurar event listeners
function setupEventListeners() {
    document.getElementById('menu-painel').addEventListener('click', () => mostrarView('painel'));
    document.getElementById('menu-produtos').addEventListener('click', () => mostrarView('produtos'));
    document.getElementById('menu-scanner').addEventListener('click', () => mostrarView('scanner'));
    document.getElementById('menu-movimentacoes').addEventListener('click', () => mostrarView('movimentacoes'));
    document.getElementById('menu-relatorios').addEventListener('click', () => mostrarView('relatorios'));
    
    document.getElementById('salvar-produto').addEventListener('click', salvarProduto);
    document.getElementById('salvar-unidade').addEventListener('click', salvarUnidade);
    document.getElementById('search-produto').addEventListener('keyup', filtrarProdutos);
}

// Mostrar view
function mostrarView(view) {
    const views = ['painel', 'produtos', 'scanner', 'movimentacoes', 'relatorios'];
    views.forEach(v => {
        document.getElementById(`${v}-view`).style.display = 'none';
    });
    document.getElementById(`${view}-view`).style.display = 'block';
    
    document.querySelectorAll('.list-group-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`menu-${view}`).classList.add('active');
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
                unidadeBase: row[3] || 'UN'
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
                quantidade: parseInt(row[4]) || 0,
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
                quantidade: parseInt(row[4]) || 0,
                responsavel: row[5] || ''
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
        { sku: '00030786', nome: 'SC LAM/VAL 016X032', descricao: 'BELLA BRANCA RESERVA 25KG', unidadeBase: 'KG' }
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
    atualizarTabelaMovimentacoes();
    atualizarUltimasMovimentacoes();
    atualizarGrafico();
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

// Ver produto (mostra unidades)
function verProduto(sku) {
    const produto = produtos.find(p => p.sku === sku);
    const unidadesProduto = unidades.filter(u => u.sku === sku);
    
    document.getElementById('modalVerProduto-titulo').textContent = `${produto.nome} - SKU: ${sku}`;
    
    const tbody = document.getElementById('tabela-unidades-produto');
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
    
    new bootstrap.Modal(document.getElementById('modalVerProduto')).show();
}

// Abrir modal para nova unidade
function abrirModalUnidade(sku) {
    document.getElementById('unidade-sku-produto').value = sku;
    document.getElementById('form-unidade').reset();
    new bootstrap.Modal(document.getElementById('modalUnidade')).show();
}

// Salvar produto
async function salvarProduto() {
    const produto = {
        sku: document.getElementById('produto-sku').value,
        nome: document.getElementById('produto-nome').value,
        descricao: document.getElementById('produto-descricao').value,
        unidadeBase: document.getElementById('produto-unidade-base').value
    };
    
    if (!produto.sku || !produto.nome) {
        alert('SKU e Nome são obrigatórios!');
        return;
    }
    
    try {
        await salvarProdutoNoSheets(produto);
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

// Salvar nova unidade
async function salvarUnidade() {
    const id = gerarIdUnico();
    const unidade = {
        id: id,
        sku: document.getElementById('unidade-sku-produto').value,
        lote: document.getElementById('unidade-lote').value,
        validade: document.getElementById('unidade-validade').value,
        quantidade: parseInt(document.getElementById('unidade-quantidade').value),
        unidade: document.getElementById('unidade-medida').value,
        status: 'Disponível',
        localizacao: document.getElementById('unidade-localizacao').value || '-'
    };
    
    if (!unidade.sku || !unidade.lote || !unidade.validade || !unidade.quantidade) {
        alert('Todos os campos são obrigatórios!');
        return;
    }
    
    try {
        await salvarUnidadeNoSheets(unidade);
        unidades.push(unidade);
        
        bootstrap.Modal.getInstance(document.getElementById('modalUnidade')).hide();
        atualizarInterface();
        
        alert(`Unidade criada com sucesso! ID: ${id}`);
    } catch (error) {
        console.error('Erro ao salvar unidade:', error);
        alert('Erro ao criar unidade.');
    }
}

// Gerar ID único para a unidade
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

// Ver unidade (detalhes + QR Code)
function verUnidade(id) {
    const unidade = unidades.find(u => u.id === id);
    if (!unidade) return;
    
    const produto = produtos.find(p => p.sku === unidade.sku);
    
    document.getElementById('detalhe-id').textContent = unidade.id;
    document.getElementById('detalhe-produto').textContent = produto ? produto.nome : unidade.sku;
    document.getElementById('detalhe-lote').textContent = unidade.lote;
    document.getElementById('detalhe-validade').textContent = formatarData(unidade.validade);
    document.getElementById('detalhe-quantidade').textContent = unidade.quantidade;
    document.getElementById('detalhe-unidade').textContent = unidade.unidade;
    document.getElementById('detalhe-status').textContent = unidade.status;
    document.getElementById('detalhe-localizacao').textContent = unidade.localizacao;
    
    // Gerar QR Code
    document.getElementById('unidade-qr-code').innerHTML = '';
    new QRCode(document.getElementById('unidade-qr-code'), {
        text: unidade.id,
        width: 200,
        height: 200
    });
    
    new bootstrap.Modal(document.getElementById('modalDetalhesUnidade')).show();
}

// Registrar entrada
async function registrarEntrada() {
    const id = document.getElementById('detalhe-id').textContent;
    const unidade = unidades.find(u => u.id === id);
    if (!unidade) return;
    
    const quantidade = prompt('Quantidade a adicionar:', '1');
    if (!quantidade) return;
    
    const qtd = parseInt(quantidade);
    if (isNaN(qtd) || qtd <= 0) {
        alert('Quantidade inválida!');
        return;
    }
    
    unidade.quantidade += qtd;
    
    const movimentacao = {
        data: new Date().toISOString().split('T')[0],
        tipo: 'Entrada',
        idUnidade: unidade.id,
        sku: unidade.sku,
        quantidade: qtd,
        responsavel: 'Sistema'
    };
    
    try {
        await atualizarUnidadeNoSheets(unidade);
        await salvarMovimentacaoNoSheets(movimentacao);
        movimentacoes.push(movimentacao);
        
        bootstrap.Modal.getInstance(document.getElementById('modalDetalhesUnidade')).hide();
        atualizarInterface();
        alert('Entrada registrada com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar entrada:', error);
        alert('Erro ao registrar entrada.');
    }
}

// Registrar saída
async function registrarSaida() {
    const id = document.getElementById('detalhe-id').textContent;
    const unidade = unidades.find(u => u.id === id);
    if (!unidade) return;
    
    const quantidade = prompt('Quantidade a retirar:', '1');
    if (!quantidade) return;
    
    const qtd = parseInt(quantidade);
    if (isNaN(qtd) || qtd <= 0) {
        alert('Quantidade inválida!');
        return;
    }
    
    if (unidade.quantidade < qtd) {
        alert('Quantidade insuficiente!');
        return;
    }
    
    unidade.quantidade -= qtd;
    
    const movimentacao = {
        data: new Date().toISOString().split('T')[0],
        tipo: 'Saída',
        idUnidade: unidade.id,
        sku: unidade.sku,
        quantidade: qtd,
        responsavel: 'Sistema'
    };
    
    try {
        await atualizarUnidadeNoSheets(unidade);
        await salvarMovimentacaoNoSheets(movimentacao);
        movimentacoes.push(movimentacao);
        
        bootstrap.Modal.getInstance(document.getElementById('modalDetalhesUnidade')).hide();
        atualizarInterface();
        alert('Saída registrada com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar saída:', error);
        alert('Erro ao registrar saída.');
    }
}

// Bloquear unidade
async function bloquearUnidade() {
    const id = document.getElementById('detalhe-id').textContent;
    const unidade = unidades.find(u => u.id === id);
    if (!unidade) return;
    
    if (!confirm('Tem certeza que deseja bloquear esta unidade?')) return;
    
    unidade.status = 'Bloqueado';
    
    try {
        await atualizarUnidadeNoSheets(unidade);
        
        bootstrap.Modal.getInstance(document.getElementById('modalDetalhesUnidade')).hide();
        atualizarInterface();
        alert('Unidade bloqueada com sucesso!');
    } catch (error) {
        console.error('Erro ao bloquear unidade:', error);
        alert('Erro ao bloquear unidade.');
    }
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

// Atualizar tabela de movimentações
function atualizarTabelaMovimentacoes() {
    const tbody = document.getElementById('tabela-movimentacoes');
    tbody.innerHTML = '';
    
    if (movimentacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma movimentação registrada</td></tr>';
        return;
    }
    
    movimentacoes.slice(-20).reverse().forEach(mov => {
        const produto = produtos.find(p => p.sku === mov.sku);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatarData(mov.data)}</td>
            <td><span class="badge ${mov.tipo === 'Entrada' ? 'bg-success' : 'bg-warning'}">${mov.tipo}</span></td>
            <td>${mov.idUnidade}</td>
            <td>${produto ? produto.nome : mov.sku}</td>
            <td>${mov.quantidade}</td>
            <td>${mov.responsavel}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Atualizar últimas movimentações no painel
function atualizarUltimasMovimentacoes() {
    const container = document.getElementById('ultimas-movimentacoes');
    container.innerHTML = '';
    
    if (movimentacoes.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhuma movimentação recente</p>';
        return;
    }
    
    movimentacoes.slice(-5).reverse().forEach(mov => {
        const produto = produtos.find(p => p.sku === mov.sku);
        const div = document.createElement('div');
        div.className = 'alert alert-light border mb-2';
        div.innerHTML = `
            <div class="d-flex justify-content-between">
                <span><strong>${formatarData(mov.data)}</strong> - ${mov.tipo}</span>
                <span class="badge ${mov.tipo === 'Entrada' ? 'bg-success' : 'bg-warning'}">${mov.quantidade}</span>
            </div>
            <small>${produto ? produto.nome : mov.sku} - ${mov.idUnidade}</small>
        `;
        container.appendChild(div);
    });
}

// Atualizar gráfico
function atualizarGrafico() {
    const ctx = document.getElementById('grafico-estoque').getContext('2d');
    
    if (graficoEstoque) {
        graficoEstoque.destroy();
    }
    
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
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Atualizar alertas de validade
function atualizarAlertas() {
    const container = document.getElementById('alertas-validade');
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

// Funções auxiliares
function formatarData(data) {
    if (!data) return '';
    const d = new Date(data);
    if (isNaN(d.getTime())) return data;
    return d.toLocaleDateString('pt-BR');
}

// ============================================
// FUNÇÕES DE INTEGRAÇÃO COM GOOGLE SHEETS
// ============================================

async function salvarProdutoNoSheets(produto) {
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...produto,
                tipo: 'produto'
            })
        });
        console.log('Produto enviado:', produto.sku);
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        throw error;
    }
}

async function salvarUnidadeNoSheets(unidade) {
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...unidade,
                tipo: 'unidade'
            })
        });
        console.log('Unidade enviada:', unidade.id);
    } catch (error) {
        console.error('Erro ao salvar unidade:', error);
        throw error;
    }
}

async function atualizarUnidadeNoSheets(unidade) {
    try {
        await fetch(WEB_APP_URL, {
            method: 'PUT',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...unidade,
                tipo: 'unidade'
            })
        });
        console.log('Unidade atualizada:', unidade.id);
    } catch (error) {
        console.error('Erro ao atualizar unidade:', error);
        throw error;
    }
}

async function salvarMovimentacaoNoSheets(movimentacao) {
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...movimentacao,
                tipo: 'movimentacao'
            })
        });
        console.log('Movimentação salva');
    } catch (error) {
        console.error('Erro ao salvar movimentação:', error);
        throw error;
    }
}
