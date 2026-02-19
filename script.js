// Configurações do Google Sheets
const SHEET_ID = 'SEU_SHEET_ID_AQUI'; // Substitua pelo ID da sua planilha
const API_KEY = 'SUA_API_KEY_AQUI'; // Substitua pela sua API Key

// URLs da API do Google Sheets
const PRODUTOS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Produtos?key=${API_KEY}`;
const RECEBIMENTOS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Recebimentos?key=${API_KEY}`;

// Variáveis globais
let produtos = [];
let recebimentos = [];
let graficoProdutos = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    carregarDados();
    setupEventListeners();
    setupQRCode();
});

// Configurar event listeners
function setupEventListeners() {
    // Menu
    document.getElementById('menu-dashboard').addEventListener('click', () => mostrarView('dashboard'));
    document.getElementById('menu-produtos').addEventListener('click', () => mostrarView('produtos'));
    document.getElementById('menu-recebimento').addEventListener('click', () => mostrarView('recebimento'));
    document.getElementById('menu-qrcode').addEventListener('click', () => mostrarView('qrcode'));
    
    // Produtos
    document.getElementById('salvar-produto').addEventListener('click', salvarProduto);
    document.getElementById('atualizar-produto').addEventListener('click', atualizarProduto);
    document.getElementById('search-produto').addEventListener('keyup', filtrarProdutos);
    
    // Recebimento
    document.getElementById('form-recebimento').addEventListener('submit', registrarRecebimento);
}

// Mostrar view selecionada
function mostrarView(view) {
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('produtos-view').style.display = 'none';
    document.getElementById('recebimento-view').style.display = 'none';
    document.getElementById('qrcode-view').style.display = 'none';
    
    document.getElementById(`${view}-view`).style.display = 'block';
    
    // Atualizar menu ativo
    document.querySelectorAll('.list-group-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`menu-${view}`).classList.add('active');
}

// Carregar dados do Google Sheets
async function carregarDados() {
    try {
        // Carregar produtos
        const produtosResponse = await fetch(PRODUTOS_URL);
        const produtosData = await produtosResponse.json();
        if (produtosData.values) {
            produtos = produtosData.values.slice(1).map(row => ({
                codigo: row[0],
                descricao: row[1],
                unidade: row[2],
                quantidade: parseInt(row[3]) || 0,
                lote: row[4],
                validade: row[5]
            }));
        }
        
        // Carregar recebimentos
        const recebimentosResponse = await fetch(RECEBIMENTOS_URL);
        const recebimentosData = await recebimentosResponse.json();
        if (recebimentosData.values) {
            recebimentos = recebimentosData.values.slice(1).map(row => ({
                data: row[0],
                codigo: row[1],
                descricao: row[2],
                quantidade: parseInt(row[3]) || 0
            }));
        }
        
        atualizarInterface();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        // Dados de exemplo para teste
        carregarDadosExemplo();
    }
}

// Dados de exemplo para teste
function carregarDadosExemplo() {
    produtos = [
        { codigo: '001', descricao: 'Arroz', unidade: 'KG', quantidade: 50, lote: 'L001', validade: '2024-12-31' },
        { codigo: '002', descricao: 'Feijão', unidade: 'KG', quantidade: 30, lote: 'L002', validade: '2024-10-15' },
        { codigo: '003', descricao: 'Óleo', unidade: 'LT', quantidade: 20, lote: 'L003', validade: '2025-03-20' }
    ];
    
    recebimentos = [
        { data: '2024-01-15', codigo: '001', descricao: 'Arroz', quantidade: 100 },
        { data: '2024-01-20', codigo: '002', descricao: 'Feijão', quantidade: 50 }
    ];
    
    atualizarInterface();
}

// Atualizar interface com dados
function atualizarInterface() {
    atualizarDashboard();
    atualizarTabelaProdutos();
    atualizarTabelaRecebimentos();
    atualizarGrafico();
    atualizarAlertas();
}

// Atualizar dashboard
function atualizarDashboard() {
    document.getElementById('total-produtos').textContent = produtos.length;
    
    const totalItens = produtos.reduce((sum, p) => sum + p.quantidade, 0);
    document.getElementById('total-itens').textContent = totalItens;
    
    const hoje = new Date();
    const proximosVencer = produtos.filter(p => {
        const validade = new Date(p.validade);
        const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
        return dias <= 30 && dias > 0;
    }).length;
    document.getElementById('proximos-vencer').textContent = proximosVencer;
    
    const estoqueBaixo = produtos.filter(p => p.quantidade < 10).length;
    document.getElementById('estoque-baixo').textContent = estoqueBaixo;
}

// Atualizar tabela de produtos
function atualizarTabelaProdutos() {
    const tbody = document.getElementById('tabela-produtos');
    tbody.innerHTML = '';
    
    produtos.forEach(produto => {
        const tr = document.createElement('tr');
        const validadeClass = verificarValidade(produto.validade);
        
        tr.innerHTML = `
            <td>${produto.codigo}</td>
            <td>${produto.descricao}</td>
            <td>${produto.unidade}</td>
            <td class="${produto.quantidade < 10 ? 'estoque-baixo' : ''}">${produto.quantidade}</td>
            <td>${produto.lote}</td>
            <td class="${validadeClass}">${formatarData(produto.validade)}</td>
            <td>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${produto.codigo}" 
                     class="qr-code-img" 
                     onclick="gerarQRCode('${produto.codigo}')"
                     title="Clique para ampliar">
            </td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editarProduto('${produto.codigo}')">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="excluirProduto('${produto.codigo}')">
                    <i class="bi bi-trash"></i>
                </button>
                <button class="btn btn-sm btn-info" onclick="darBaixa('${produto.codigo}')">
                    <i class="bi bi-dash-circle"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Atualizar tabela de recebimentos
function atualizarTabelaRecebimentos() {
    const tbody = document.getElementById('tabela-recebimentos');
    tbody.innerHTML = '';
    
    recebimentos.slice(-10).reverse().forEach(rec => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatarData(rec.data)}</td>
            <td>${rec.codigo}</td>
            <td>${rec.descricao}</td>
            <td>${rec.quantidade}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Atualizar gráfico
function atualizarGrafico() {
    const ctx = document.getElementById('grafico-produtos').getContext('2d');
    
    if (graficoProdutos) {
        graficoProdutos.destroy();
    }
    
    const labels = produtos.slice(0, 5).map(p => p.descricao);
    const data = produtos.slice(0, 5).map(p => p.quantidade);
    
    graficoProdutos = new Chart(ctx, {
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
    const produtosOrdenados = [...produtos].sort((a, b) => new Date(a.validade) - new Date(b.validade));
    
    produtosOrdenados.slice(0, 5).forEach(produto => {
        const validade = new Date(produto.validade);
        const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
        
        const div = document.createElement('div');
        div.className = dias <= 0 ? 'alerta-vencido' : 'alerta-vencimento';
        
        if (dias <= 0) {
            div.innerHTML = `<strong>VENCIDO:</strong> ${produto.descricao} - Venceu em ${formatarData(produto.validade)}`;
        } else if (dias <= 7) {
            div.innerHTML = `<strong>URGENTE:</strong> ${produto.descricao} - Vence em ${dias} dias`;
        } else if (dias <= 15) {
            div.innerHTML = `<strong>ATENÇÃO:</strong> ${produto.descricao} - Vence em ${dias} dias`;
        } else if (dias <= 30) {
            div.innerHTML = `<strong>ALERTA:</strong> ${produto.descricao} - Vence em ${dias} dias`;
        }
        
        container.appendChild(div);
    });
}

// Filtrar produtos
function filtrarProdutos() {
    const termo = document.getElementById('search-produto').value.toLowerCase();
    
    if (termo === '') {
        atualizarTabelaProdutos();
        return;
    }
    
    const filtrados = produtos.filter(p => 
        p.descricao.toLowerCase().includes(termo) || 
        p.codigo.toLowerCase().includes(termo)
    );
    
    const tbody = document.getElementById('tabela-produtos');
    tbody.innerHTML = '';
    
    filtrados.forEach(produto => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${produto.codigo}</td>
            <td>${produto.descricao}</td>
            <td>${produto.unidade}</td>
            <td>${produto.quantidade}</td>
            <td>${produto.lote}</td>
            <td>${formatarData(produto.validade)}</td>
            <td>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${produto.codigo}" 
                     class="qr-code-img">
            </td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editarProduto('${produto.codigo}')">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="excluirProduto('${produto.codigo}')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Salvar novo produto
async function salvarProduto() {
    const produto = {
        codigo: document.getElementById('produto-codigo').value,
        descricao: document.getElementById('produto-descricao').value,
        unidade: document.getElementById('produto-unidade').value,
        quantidade: parseInt(document.getElementById('produto-quantidade').value),
        lote: document.getElementById('produto-lote').value,
        validade: document.getElementById('produto-validade').value
    };
    
    // Adicionar ao array local
    produtos.push(produto);
    
    // Aqui você deve implementar o salvamento no Google Sheets
    await salvarNoGoogleSheets(produto);
    
    // Fechar modal e atualizar interface
    bootstrap.Modal.getInstance(document.getElementById('modalProduto')).hide();
    document.getElementById('form-produto').reset();
    atualizarInterface();
}

// Editar produto
function editarProduto(codigo) {
    const produto = produtos.find(p => p.codigo === codigo);
    if (produto) {
        document.getElementById('editar-id').value = produto.codigo;
        document.getElementById('editar-codigo').value = produto.codigo;
        document.getElementById('editar-descricao').value = produto.descricao;
        document.getElementById('editar-unidade').value = produto.unidade;
        document.getElementById('editar-quantidade').value = produto.quantidade;
        document.getElementById('editar-lote').value = produto.lote;
        document.getElementById('editar-validade').value = produto.validade;
        
        new bootstrap.Modal(document.getElementById('modalEditarProduto')).show();
    }
}

// Atualizar produto
async function atualizarProduto() {
    const codigo = document.getElementById('editar-id').value;
    const index = produtos.findIndex(p => p.codigo === codigo);
    
    if (index !== -1) {
        produtos[index] = {
            codigo: document.getElementById('editar-codigo').value,
            descricao: document.getElementById('editar-descricao').value,
            unidade: document.getElementById('editar-unidade').value,
            quantidade: parseInt(document.getElementById('editar-quantidade').value),
            lote: document.getElementById('editar-lote').value,
            validade: document.getElementById('editar-validade').value
        };
        
        // Aqui você deve implementar a atualização no Google Sheets
        await atualizarNoGoogleSheets(produtos[index]);
        
        bootstrap.Modal.getInstance(document.getElementById('modalEditarProduto')).hide();
        atualizarInterface();
    }
}

// Excluir produto
async function excluirProduto(codigo) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        produtos = produtos.filter(p => p.codigo !== codigo);
        
        // Aqui você deve implementar a exclusão no Google Sheets
        await excluirNoGoogleSheets(codigo);
        
        atualizarInterface();
    }
}

// Dar baixa em produto
async function darBaixa(codigo, quantidade = 1) {
    const produto = produtos.find(p => p.codigo === codigo);
    if (produto) {
        if (produto.quantidade >= quantidade) {
            produto.quantidade -= quantidade;
            
            // Aqui você deve implementar a atualização no Google Sheets
            await atualizarNoGoogleSheets(produto);
            
            atualizarInterface();
            alert(`Baixa realizada com sucesso! Nova quantidade: ${produto.quantidade}`);
        } else {
            alert('Quantidade insuficiente em estoque!');
        }
    }
}

// Registrar recebimento
async function registrarRecebimento(event) {
    event.preventDefault();
    
    const recebimento = {
        data: document.getElementById('data-recebimento').value,
        codigo: document.getElementById('codigo-recebimento').value,
        quantidade: parseInt(document.getElementById('quantidade-recebimento').value)
    };
    
    // Encontrar produto e atualizar quantidade
    const produto = produtos.find(p => p.codigo === recebimento.codigo);
    if (produto) {
        recebimento.descricao = produto.descricao;
        produto.quantidade += recebimento.quantidade;
        
        // Adicionar ao histórico
        recebimentos.push(recebimento);
        
        // Aqui você deve implementar o salvamento no Google Sheets
        await salvarRecebimentoNoGoogleSheets(recebimento);
        await atualizarNoGoogleSheets(produto);
        
        document.getElementById('form-recebimento').reset();
        atualizarInterface();
        alert('Recebimento registrado com sucesso!');
    } else {
        alert('Produto não encontrado!');
    }
}

// Configurar leitor de QR Code
function setupQRCode() {
    const html5QrCode = new Html5Qrcode("qr-reader");
    
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        document.getElementById('qr-reader-results').innerHTML = `
            <div class="alert alert-success">
                Código lido: ${decodedText}<br>
                <button class="btn btn-primary btn-sm mt-2" onclick="darBaixa('${decodedText}')">
                    Dar Baixa
                </button>
            </div>
        `;
        
        // Adicionar às últimas baixas
        adicionarUltimaBaixa(decodedText);
    };
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback);
}

// Adicionar última baixa
function adicionarUltimaBaixa(codigo) {
    const container = document.getElementById('ultimas-baixas');
    const produto = produtos.find(p => p.codigo === codigo);
    
    if (produto) {
        const div = document.createElement('div');
        div.className = 'alert alert-info mt-2';
        div.innerHTML = `
            <strong>${new Date().toLocaleString()}</strong><br>
            Produto: ${produto.descricao}<br>
            Código: ${codigo}
        `;
        container.prepend(div);
    }
}

// Funções auxiliares
function formatarData(data) {
    if (!data) return '';
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
}

function verificarValidade(data) {
    const hoje = new Date();
    const validade = new Date(data);
    const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
    
    if (dias <= 0) return 'table-danger';
    if (dias <= 7) return 'table-warning';
    if (dias <= 30) return 'table-info';
    return '';
}

function gerarQRCode(codigo) {
    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${codigo}`, '_blank');
}

// Funções para integração com Google Sheets
async function salvarNoGoogleSheets(produto) {
    // Implementar chamada à API do Google Sheets
    console.log('Salvando no Google Sheets:', produto);
}

async function atualizarNoGoogleSheets(produto) {
    // Implementar chamada à API do Google Sheets
    console.log('Atualizando no Google Sheets:', produto);
}

async function excluirNoGoogleSheets(codigo) {
    // Implementar chamada à API do Google Sheets
    console.log('Excluindo do Google Sheets:', codigo);
}

async function salvarRecebimentoNoGoogleSheets(recebimento) {
    // Implementar chamada à API do Google Sheets
    console.log('Salvando recebimento no Google Sheets:', recebimento);
}