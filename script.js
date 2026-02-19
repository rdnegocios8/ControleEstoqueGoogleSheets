// Configurações do Google Sheets
const SHEET_ID = '1We0xDOamU_iIGNcm_YxZ8jbBGNWK1PIyljgDb9xWf84';
const API_KEY = 'AIzaSyCShYO-EV8ZcjuOFuYedULIrfcwOgbcwsU';

// URLs da API do Google Sheets
const PRODUTOS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Produtos?key=${API_KEY}`;
const RECEBIMENTOS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Recebimentos?key=${API_KEY}`;

// URLs para escrita (append)
const PRODUTOS_APPEND_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Produtos:append?valueInputOption=USER_ENTERED&key=${API_KEY}`;
const RECEBIMENTOS_APPEND_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Recebimentos:append?valueInputOption=USER_ENTERED&key=${API_KEY}`;

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
        // Mostrar indicador de carregamento
        mostrarCarregando(true);
        
        // Carregar produtos
        const produtosResponse = await fetch(PRODUTOS_URL);
        const produtosData = await produtosResponse.json();
        
        if (produtosData.values && produtosData.values.length > 1) {
            produtos = produtosData.values.slice(1).map(row => ({
                codigo: row[0] || '',
                descricao: row[1] || '',
                unidade: row[2] || '',
                quantidade: parseInt(row[3]) || 0,
                lote: row[4] || '',
                validade: row[5] || ''
            })).filter(p => p.codigo); // Remove linhas vazias
        } else {
            produtos = [];
        }
        
        // Carregar recebimentos
        const recebimentosResponse = await fetch(RECEBIMENTOS_URL);
        const recebimentosData = await recebimentosResponse.json();
        
        if (recebimentosData.values && recebimentosData.values.length > 1) {
            recebimentos = recebimentosData.values.slice(1).map(row => ({
                data: row[0] || '',
                codigo: row[1] || '',
                descricao: row[2] || '',
                quantidade: parseInt(row[3]) || 0
            })).filter(r => r.data);
        } else {
            recebimentos = [];
        }
        
        atualizarInterface();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarMensagem('Erro ao conectar com Google Sheets. Usando dados locais.', 'warning');
        carregarDadosExemplo();
    } finally {
        mostrarCarregando(false);
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
        if (!p.validade) return false;
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
    
    if (produtos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum produto encontrado</td></tr>';
        return;
    }
    
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
    
    if (recebimentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum recebimento registrado</td></tr>';
        return;
    }
    
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
    const produtosOrdenados = [...produtos]
        .filter(p => p.validade)
        .sort((a, b) => new Date(a.validade) - new Date(b.validade));
    
    if (produtosOrdenados.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhum produto com validade cadastrada</p>';
        return;
    }
    
    produtosOrdenados.slice(0, 5).forEach(produto => {
        const validade = new Date(produto.validade);
        const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
        
        const div = document.createElement('div');
        div.className = dias <= 0 ? 'alerta-vencido' : 'alerta-vencimento';
        
        if (dias <= 0) {
            div.innerHTML = `<strong>VENCIDO:</strong> ${produto.descricao} - Venceu em ${formatarData(produto.validade)}`;
        } else if (dias <= 7) {
            div.innerHTML = `<strong>URGENTE:</strong> ${produto.descricao} - Vence em ${dias} dias (${formatarData(produto.validade)})`;
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
    
    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum produto encontrado</td></tr>';
        return;
    }
    
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
    
    // Validar campos obrigatórios
    if (!produto.codigo || !produto.descricao) {
        alert('Código e descrição são obrigatórios!');
        return;
    }
    
    try {
        mostrarCarregando(true);
        
        // Salvar no Google Sheets
        await salvarNoGoogleSheets(produto);
        
        // Adicionar ao array local
        produtos.push(produto);
        
        // Fechar modal e atualizar interface
        bootstrap.Modal.getInstance(document.getElementById('modalProduto')).hide();
        document.getElementById('form-produto').reset();
        atualizarInterface();
        
        mostrarMensagem('Produto salvo com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('Erro ao salvar produto. Tente novamente.');
    } finally {
        mostrarCarregando(false);
    }
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
        const produtoAtualizado = {
            codigo: document.getElementById('editar-codigo').value,
            descricao: document.getElementById('editar-descricao').value,
            unidade: document.getElementById('editar-unidade').value,
            quantidade: parseInt(document.getElementById('editar-quantidade').value),
            lote: document.getElementById('editar-lote').value,
            validade: document.getElementById('editar-validade').value
        };
        
        try {
            mostrarCarregando(true);
            
            // Atualizar no Google Sheets
            await atualizarNoGoogleSheets(produtoAtualizado);
            
            // Atualizar no array local
            produtos[index] = produtoAtualizado;
            
            bootstrap.Modal.getInstance(document.getElementById('modalEditarProduto')).hide();
            atualizarInterface();
            
            mostrarMensagem('Produto atualizado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao atualizar:', error);
            alert('Erro ao atualizar produto. Tente novamente.');
        } finally {
            mostrarCarregando(false);
        }
    }
}

// Excluir produto
async function excluirProduto(codigo) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    
    try {
        mostrarCarregando(true);
        
        // Excluir do Google Sheets
        await excluirNoGoogleSheets(codigo);
        
        // Remover do array local
        produtos = produtos.filter(p => p.codigo !== codigo);
        
        atualizarInterface();
        mostrarMensagem('Produto excluído com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao excluir:', error);
        alert('Erro ao excluir produto. Tente novamente.');
    } finally {
        mostrarCarregando(false);
    }
}

// Dar baixa em produto
async function darBaixa(codigo, quantidade = 1) {
    const produto = produtos.find(p => p.codigo === codigo);
    if (!produto) {
        alert('Produto não encontrado!');
        return;
    }
    
    if (produto.quantidade < quantidade) {
        alert(`Quantidade insuficiente! Estoque atual: ${produto.quantidade}`);
        return;
    }
    
    // Perguntar quantidade se não foi especificada
    if (quantidade === 1) {
        const qtd = prompt('Quantidade para dar baixa:', '1');
        if (qtd === null) return;
        quantidade = parseInt(qtd);
        if (isNaN(quantidade) || quantidade <= 0) {
            alert('Quantidade inválida!');
            return;
        }
    }
    
    try {
        mostrarCarregando(true);
        
        produto.quantidade -= quantidade;
        
        // Atualizar no Google Sheets
        await atualizarNoGoogleSheets(produto);
        
        // Registrar a baixa como um recebimento negativo? (opcional)
        // await registrarBaixa(codigo, produto.descricao, quantidade);
        
        atualizarInterface();
        alert(`Baixa realizada com sucesso! Nova quantidade: ${produto.quantidade}`);
    } catch (error) {
        console.error('Erro ao dar baixa:', error);
        alert('Erro ao dar baixa. Tente novamente.');
    } finally {
        mostrarCarregando(false);
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
    
    if (!recebimento.data || !recebimento.codigo || !recebimento.quantidade) {
        alert('Todos os campos são obrigatórios!');
        return;
    }
    
    try {
        mostrarCarregando(true);
        
        // Encontrar produto e atualizar quantidade
        const produto = produtos.find(p => p.codigo === recebimento.codigo);
        if (!produto) {
            alert('Produto não encontrado!');
            return;
        }
        
        recebimento.descricao = produto.descricao;
        produto.quantidade += recebimento.quantidade;
        
        // Salvar recebimento no Google Sheets
        await salvarRecebimentoNoGoogleSheets(recebimento);
        
        // Atualizar produto no Google Sheets
        await atualizarNoGoogleSheets(produto);
        
        // Adicionar ao array local
        recebimentos.push(recebimento);
        
        document.getElementById('form-recebimento').reset();
        atualizarInterface();
        
        mostrarMensagem('Recebimento registrado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao registrar recebimento:', error);
        alert('Erro ao registrar recebimento. Tente novamente.');
    } finally {
        mostrarCarregando(false);
    }
}

// Configurar leitor de QR Code
function setupQRCode() {
    const html5QrCode = new Html5Qrcode("qr-reader");
    
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        document.getElementById('qr-reader-results').innerHTML = `
            <div class="alert alert-success">
                <strong>Código lido:</strong> ${decodedText}<br>
                <button class="btn btn-primary btn-sm mt-2" onclick="darBaixa('${decodedText}')">
                    Dar Baixa
                </button>
            </div>
        `;
        
        adicionarUltimaBaixa(decodedText);
    };
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    // Parar leitor anterior se existir
    try {
        html5QrCode.stop();
    } catch (e) {
        // Ignorar erro se não estiver rodando
    }
    
    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch(err => console.error('Erro ao iniciar QR Code:', err));
}

// Adicionar última baixa
function adicionarUltimaBaixa(codigo) {
    const container = document.getElementById('ultimas-baixas');
    const produto = produtos.find(p => p.codigo === codigo);
    
    const div = document.createElement('div');
    div.className = 'alert alert-info mt-2';
    div.innerHTML = `
        <strong>${new Date().toLocaleString('pt-BR')}</strong><br>
        Produto: ${produto ? produto.descricao : 'Desconhecido'}<br>
        Código: ${codigo}
    `;
    
    container.prepend(div);
    
    // Manter apenas as 5 últimas
    while (container.children.length > 5) {
        container.removeChild(container.lastChild);
    }
}

// Funções auxiliares
function formatarData(data) {
    if (!data) return '';
    const d = new Date(data);
    if (isNaN(d.getTime())) return data;
    return d.toLocaleDateString('pt-BR');
}

function verificarValidade(data) {
    if (!data) return '';
    const hoje = new Date();
    const validade = new Date(data);
    if (isNaN(validade.getTime())) return '';
    
    const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
    
    if (dias <= 0) return 'table-danger';
    if (dias <= 7) return 'table-warning';
    if (dias <= 30) return 'table-info';
    return '';
}

function gerarQRCode(codigo) {
    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${codigo}`, '_blank');
}

function mostrarCarregando(show) {
    // Implementar se desejar um indicador visual de carregamento
    console.log(show ? 'Carregando...' : 'Carregamento concluído');
}

function mostrarMensagem(texto, tipo) {
    // Implementar se desejar notificações toast
    console.log(`[${tipo}] ${texto}`);
}

// ============================================
// FUNÇÕES DE INTEGRAÇÃO COM GOOGLE SHEETS
// ============================================

// Salvar novo produto
async function salvarNoGoogleSheets(produto) {
    const body = {
        values: [[
            produto.codigo,
            produto.descricao,
            produto.unidade,
            produto.quantidade,
            produto.lote,
            produto.validade
        ]]
    };
    
    const response = await fetch(PRODUTOS_APPEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    return await response.json();
}

// Atualizar produto existente
async function atualizarNoGoogleSheets(produto) {
    // Primeiro precisamos encontrar a linha do produto
    const response = await fetch(PRODUTOS_URL);
    const data = await response.json();
    
    if (!data.values) {
        throw new Error('Não foi possível ler os produtos');
    }
    
    // Encontrar a linha do produto pelo código (ignorando cabeçalho)
    const linhaIndex = data.values.findIndex((row, index) => 
        index > 0 && row[0] === produto.codigo
    );
    
    if (linhaIndex === -1) {
        throw new Error('Produto não encontrado na planilha');
    }
    
    // Atualizar a linha (linhaIndex + 1 porque o array é 0-based e a planilha é 1-based)
    const linha = linhaIndex + 1;
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Produtos!A${linha}:F${linha}?valueInputOption=USER_ENTERED&key=${API_KEY}`;
    
    const body = {
        values: [[
            produto.codigo,
            produto.descricao,
            produto.unidade,
            produto.quantidade,
            produto.lote,
            produto.validade
        ]]
    };
    
    const updateResponse = await fetch(updateUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
    if (!updateResponse.ok) {
        throw new Error(`Erro HTTP ao atualizar: ${updateResponse.status}`);
    }
    
    return await updateResponse.json();
}

// Excluir produto (limpa a linha mas mantém a estrutura)
async function excluirNoGoogleSheets(codigo) {
    // Primeiro encontrar a linha
    const response = await fetch(PRODUTOS_URL);
    const data = await response.json();
    
    if (!data.values) return;
    
    const linhaIndex = data.values.findIndex((row, index) => 
        index > 0 && row[0] === codigo
    );
    
    if (linhaIndex === -1) return;
    
    // Limpar o conteúdo da linha (não é possível excluir via API gratuita)
    const linha = linhaIndex + 1;
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Produtos!A${linha}:F${linha}:clear?key=${API_KEY}`;
    
    const clearResponse = await fetch(clearUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    
    if (!clearResponse.ok) {
        throw new Error(`Erro HTTP ao limpar: ${clearResponse.status}`);
    }
}

// Salvar recebimento
async function salvarRecebimentoNoGoogleSheets(recebimento) {
    const body = {
        values: [[
            recebimento.data,
            recebimento.codigo,
            recebimento.descricao,
            recebimento.quantidade
        ]]
    };
    
    const response = await fetch(RECEBIMENTOS_APPEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    return await response.json();
}
