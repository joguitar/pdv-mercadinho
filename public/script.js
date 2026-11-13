const API_URL = '/api';


let paginaPDV = 1;
let totalPaginasPDV = 1;
let paginaGestor = 1;
let totalPaginasGestor = 1;
let carrinho = [];

// Inicialização automática ao abrir o aplicativo
window.addEventListener('DOMContentLoaded', () => {
    carregarProdutosPDV(1);
    carregarProdutosGestor(1);
    carregarRelatorios('');
});

// Troca de telas pelo menu inferior estilo App Android
function trocarAba(aba) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('ativo'));

    document.getElementById(`tela-${aba}`).classList.add('ativa');
    document.getElementById(`nav-${aba}`).classList.add('ativo');

    if (aba === 'caixa') carregarProdutosPDV(paginaPDV);
    if (aba === 'gestor') {
        carregarProdutosGestor(paginaGestor);
        carregarRelatorios('');
    }
}

// Indicador de conexão no topo da tela
function setStatus(online, texto) {
    const badge = document.getElementById('status-conexao');
    badge.innerText = texto;
    badge.className = online ? 'badge-status online' : 'badge-status';
}

// ================= FRENTE DE CAIXA (PDV) =================
async function carregarProdutosPDV(pagina = 1) {
    paginaPDV = pagina;
    const busca = document.getElementById('busca-pdv').value.trim();
    const container = document.getElementById('lista-produtos-pdv');

    try {
        setStatus(false, 'Carregando...');
        const res = await fetch(`${API_URL}/produtos?page=${paginaPDV}&limit=8&busca=${encodeURIComponent(busca)}`);
        if (!res.ok) throw new Error('Falha no servidor');

        const data = await res.json();
        setStatus(true, '🟢 Nuvem OK');

        totalPaginasPDV = data.totalPaginas || 1;
        document.getElementById('info-pagina-pdv').innerText = `Página ${data.paginaAtual} de ${totalPaginasPDV}`;

        if (!data.produtos || data.produtos.length === 0) {
            container.innerHTML = '<p class="msg-vazia">Nenhum produto encontrado.</p>';
            return;
        }

        container.innerHTML = data.produtos.map(p => `
            <div class="item-card">
                <div class="item-info">
                    <strong>${p.nome}</strong>
                    <small>Estoque: ${p.quantidade} un. ${p.codigo_barras ? '| Cód: ' + p.codigo_barras : ''}</small>
                    <div class="item-preco">R$ ${parseFloat(p.preco).toFixed(2)}</div>
                </div>
                <button class="btn-add" onclick='adicionarAoCarrinho(${JSON.stringify(p)})'>+ Add</button>
            </div>
        `).join('');
    } catch (err) {
        setStatus(false, '🔴 Sem conexão');
        container.innerHTML = `<p class="msg-vazia">Erro ao conectar: ${err.message}.<br>Se o servidor estava dormindo, aguarde 30s e toque na aba Produtos.</p>`;
    }
}

function buscarProdutosPDV() {
    carregarProdutosPDV(1);
}

function mudarPaginaPDV(delta) {
    const nova = paginaPDV + delta;
    if (nova >= 1 && nova <= totalPaginasPDV) carregarProdutosPDV(nova);
}

// ================= CARRINHO DE COMPRAS =================
function adicionarAoCarrinho(produto) {
    if (produto.quantidade <= 0) {
        alert('Produto sem estoque!');
        return;
    }
    const existente = carrinho.find(i => i.id === produto.id);
    if (existente) {
        if (existente.quantidade + 1 > produto.quantidade) {
            alert('Quantidade máxima do estoque atingida!');
            return;
        }
        existente.quantidade++;
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            preco: parseFloat(produto.preco),
            quantidade: 1,
            estoqueMax: produto.quantidade
        });
    }
    renderizarCarrinho();
}

function alterarQtdCarrinho(index, delta) {
    const item = carrinho[index];
    const novaQtd = item.quantidade + delta;
    if (novaQtd <= 0) {
        carrinho.splice(index, 1);
    } else if (novaQtd <= item.estoqueMax) {
        item.quantidade = novaQtd;
    }
    renderizarCarrinho();
}
function renderizarCarrinho() {
    const container = document.getElementById('lista-carrinho');
    const totalItens = carrinho.reduce((acc, i) => acc + i.quantidade, 0);
    document.getElementById('badge-carrinho').innerText = totalItens;

    if (carrinho.length === 0) {
        container.innerHTML = '<p class="msg-vazia">Nenhum item adicionado.</p>';
        atualizarTotaisCarrinho();
        return;
    }

    container.innerHTML = carrinho.map((item, idx) => `
        <div class="item-card">
            <div class="item-info">
                <strong>${item.nome}</strong>
                <small>${item.quantidade}x R$ ${item.preco.toFixed(2)}</small>
                <div class="item-preco">R$ ${(item.quantidade * item.preco).toFixed(2)}</div>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn-add" style="background:#475569" onclick="alterarQtdCarrinho(${idx}, -1)">-</button>
                <button class="btn-add" onclick="alterarQtdCarrinho(${idx}, 1)">+</button>
            </div>
        </div>
    `).join('');

    atualizarTotaisCarrinho();
}

function alternarCampoDinheiro() {
    const forma = document.getElementById('forma-pagamento').value;
    document.getElementById('box-valor-recebido').style.display = forma === 'Dinheiro' ? 'block' : 'none';
    atualizarTotaisCarrinho();
}

function atualizarTotaisCarrinho() {
    const subtotal = carrinho.reduce((acc, i) => acc + (i.preco * i.quantidade), 0);
    const desconto = parseFloat(document.getElementById('desconto-venda').value) || 0;
    const totalFinal = Math.max(0, subtotal - desconto);

    document.getElementById('subtotal-venda').innerText = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('total-final-venda').innerText = `R$ ${totalFinal.toFixed(2)}`;

    const recebido = parseFloat(document.getElementById('valor-recebido').value) || 0;
    const troco = Math.max(0, recebido - totalFinal);
    document.getElementById('troco-venda').innerText = `R$ ${troco.toFixed(2)}`;
}

function limparCarrinho() {
    carrinho = [];
    document.getElementById('desconto-venda').value = 0;
    document.getElementById('valor-recebido').value = '';
    renderizarCarrinho();
}

let ultimoCupomTexto = '';

async function finalizarVenda() {
    if (carrinho.length === 0) {
        alert('Adicione produtos ao carrinho primeiro!');
        return;
    }

    const subtotal = carrinho.reduce((acc, i) => acc + (i.preco * i.quantidade), 0);
    const desconto = parseFloat(document.getElementById('desconto-venda').value) || 0;
    const total = Math.max(0, subtotal - desconto);
    const forma_pagamento = document.getElementById('forma-pagamento').value;
    const valor_recebido = parseFloat(document.getElementById('valor-recebido').value) || total;
    const troco = Math.max(0, valor_recebido - total);

    try {
        const res = await fetch(`${API_URL}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itens: carrinho, total, forma_pagamento, valor_recebido })
        });

        if (!res.ok) throw new Error('Erro ao registrar venda');
        const dadosVenda = await res.json();

        const dataHora = new Date().toLocaleString('pt-BR');
        let linhasItens = carrinho.map(i =>
            `${i.quantidade}x ${i.nome}\n   R$ ${i.preco.toFixed(2)} un. = R$ ${(i.quantidade * i.preco).toFixed(2)}`
        ).join('\n');

        ultimoCupomTexto =
            `🏪 *MERCADINHO PINHEIRO*
Comprovante Não Fiscal #${dadosVenda.vendaId || ''}
Data: ${dataHora}
--------------------------------
${linhasItens}
--------------------------------
Subtotal: R$ ${subtotal.toFixed(2)}
Desconto: R$ ${desconto.toFixed(2)}
*TOTAL PAGO: R$ ${total.toFixed(2)}*
Pagamento: ${forma_pagamento}
${forma_pagamento === 'Dinheiro' ? `Recebido: R$ ${valor_recebido.toFixed(2)}\nTroco: R$ ${troco.toFixed(2)}\n` : ''}--------------------------------
Obrigado pela preferência!`;

        document.getElementById('texto-cupom').innerText = ultimoCupomTexto;
        document.getElementById('modal-cupom').style.display = 'flex';

        limparCarrinho();
        trocarAba('caixa');
    } catch (err) {
        alert('Erro ao finalizar venda: ' + err.message);
    }
}

function compartilharWhatsApp() {
    const textoCodificado = encodeURIComponent(ultimoCupomTexto);
    window.location.href = `whatsapp://send?text=${textoCodificado}`;
}

function fecharCupom() {
    document.getElementById('modal-cupom').style.display = 'none';
}


function fecharCupom() {
    document.getElementById('modal-cupom').style.display = 'none';
}


// ================= PAINEL DO GESTOR =================
async function carregarProdutosGestor(pagina = 1) {
    paginaGestor = pagina;
    const busca = document.getElementById('busca-gestor').value.trim();
    const container = document.getElementById('lista-produtos-gestor');

    try {
        const res = await fetch(`${API_URL}/produtos?page=${paginaGestor}&limit=5&busca=${encodeURIComponent(busca)}`);
        const data = await res.json();

        totalPaginasGestor = data.totalPaginas || 1;
        document.getElementById('info-pagina-gestor').innerText = `Página ${data.paginaAtual} de ${totalPaginasGestor}`;

        container.innerHTML = data.produtos.map(p => `
            <div class="item-card">
                <div class="item-info">
                    <strong>${p.nome}</strong>
                    <small>Custo: R$ ${parseFloat(p.preco_custo).toFixed(2)} | Venda: R$ ${parseFloat(p.preco).toFixed(2)} | Qtd: ${p.quantidade}</small>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-add" style="background:#f59e0b" onclick='editarProduto(${JSON.stringify(p)})'>✏️</button>
                    <button class="btn-add" style="background:#ef4444" onclick="excluirProduto(${p.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<p class="msg-vazia">Erro ao carregar lista.</p>';
    }
}

function mudarPaginaGestor(delta) {
    const nova = paginaGestor + delta;
    if (nova >= 1 && nova <= totalPaginasGestor) carregarProdutosGestor(nova);
}

async function salvarProduto() {
    const id = document.getElementById('prod-id').value;
    const nome = document.getElementById('prod-nome').value.trim();
    const codigo_barras = document.getElementById('prod-codigo').value.trim();
    const preco_custo = document.getElementById('prod-custo').value;
    const margem = document.getElementById('prod-margem').value;
    const quantidade = document.getElementById('prod-qtd').value;
    const estoque_minimo = document.getElementById('prod-min').value;

    if (!nome || !preco_custo || !quantidade) {
        alert('Preencha Nome, Custo e Quantidade!');
        return;
    }

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/produtos/${id}` : `${API_URL}/produtos`;

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, codigo_barras, preco_custo, margem, quantidade, estoque_minimo })
        });

        if (!res.ok) throw new Error('Falha ao salvar produto');

        alert(id ? '✅ Produto atualizado!' : '✅ Produto cadastrado!');
        limparFormProduto();
        carregarProdutosGestor(1);
        carregarProdutosPDV(1);
    } catch (err) {
        alert('Erro ao salvar: ' + err.message);
    }
}

function editarProduto(p) {
    document.getElementById('titulo-form-produto').innerText = '✏️ Editar Produto';
    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-nome').value = p.nome;
    document.getElementById('prod-codigo').value = p.codigo_barras || '';
    document.getElementById('prod-custo').value = p.preco_custo;
    document.getElementById('prod-qtd').value = p.quantidade;
    document.getElementById('prod-min').value = p.estoque_minimo || 5;
    document.getElementById('btn-cancelar-edicao').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limparFormProduto() {
    document.getElementById('titulo-form-produto').innerText = '➕ Cadastrar Produto';
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-nome').value = '';
    document.getElementById('prod-codigo').value = '';
    document.getElementById('prod-custo').value = '';
    document.getElementById('prod-qtd').value = '';
    document.getElementById('btn-cancelar-edicao').style.display = 'none';
}

async function excluirProduto(id) {
    if (!confirm('Deseja realmente excluir este produto?')) return;
    try {
        await fetch(`${API_URL}/produtos/${id}`, { method: 'DELETE' });
        carregarProdutosGestor(paginaGestor);
        carregarProdutosPDV(1);
    } catch (err) {
        alert('Erro ao excluir: ' + err.message);
    }
}

let periodoAtualRelatorio = '';

async function carregarRelatorios(periodo) {
    periodoAtualRelatorio = periodo;
    try {
        const res = await fetch(`${API_URL}/relatorios?periodo=${periodo}&limit=100`);
        const data = await res.json();
        document.getElementById('rel-qtd').innerText = data.resumo.qtd_vendas;
        document.getElementById('rel-faturamento').innerText = `R$ ${data.resumo.faturamento_total.toFixed(2)}`;
        document.getElementById('rel-lucro').innerText = `R$ ${data.resumo.lucro_liquido.toFixed(2)}`;
    } catch (err) {
        console.error(err);
    }
}

// ================= LEITOR DE CÓDIGO DE BARRAS (CÂMERA) =================
let html5QrCode = null;
let modoLeitor = 'pdv';


async function abrirLeitor(modo) {
    modoLeitor = modo;

    try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BarcodeScanner) {
            const { BarcodeScanner } = window.Capacitor.Plugins;

            // 1. Verifica e instala o módulo do Google se necessário
            const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
            if (!available) {
                alert('Baixando componente da câmera do Google. Aguarde 10 segundos e toque na câmera novamente.');
                await BarcodeScanner.installGoogleBarcodeScannerModule();
                return;
            }

            // 2. Pede permissão da câmera
            const status = await BarcodeScanner.requestPermissions();
            if (status.camera !== 'granted') {
                alert('Permissão de câmera negada. Ative nas configurações do app.');
                return;
            }

            // 3. Abre o leitor nativo em tela cheia
            // Dentro de abrirLeitor(modo):
            const resultado = await BarcodeScanner.scan();
            if (resultado.barcodes && resultado.barcodes.length > 0) {
                const codigoLido = resultado.barcodes[0].rawValue;
                processarCodigoLido(codigoLido);
            }

        } else {
            const codigoDigitado = prompt('Digite o código de barras:');
            if (codigoDigitado) processarCodigoLido(codigoDigitado.trim());
        }
    } catch (err) {
        alert('Aviso do leitor: ' + (err.message || JSON.stringify(err)));
    }
}

async function processarCodigoLido(codigoLido) {
    if (modoLeitor === 'cadastro') {
        document.getElementById('prod-codigo').value = codigoLido;
        alert('✅ Código capturado: ' + codigoLido);
    } else {
        document.getElementById('busca-pdv').value = codigoLido;
        const res = await fetch(`${API_URL}/produtos?page=1&limit=1&busca=${encodeURIComponent(codigoLido)}`);
        const data = await res.json();
        if (data.produtos && data.produtos.length > 0) {
            adicionarAoCarrinho(data.produtos[0]);
            document.getElementById('busca-pdv').value = '';
            carregarProdutosPDV(1);
            alert(`✅ Adicionado: ${data.produtos[0].nome}`);
        } else {
            alert('Produto não encontrado para o código: ' + codigoLido);
            carregarProdutosPDV(1);
        }
    }
}
// ================= EXPORTAR RELATÓRIO EM EXCEL (.XLSX) =================
async function baixarRelatorioExcel() {
    try {
        // Garante que a biblioteca XLSX seja carregada automaticamente se faltar no HTML
        if (typeof XLSX === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cloudflare.com';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Falha ao baixar biblioteca do Excel. Verifique sua internet.'));
                document.head.appendChild(script);
            });
        }

        const res = await fetch(`${API_URL}/relatorios?periodo=${periodoAtualRelatorio}&limit=1000`);
        const data = await res.json();

        const nomesPeriodo = {
            'hoje': 'Hoje',
            'semana': 'Ultimos_7_Dias',
            'mes': 'Ultimos_30_Dias',
            '': 'Geral'
        };
        const nomeFiltro = nomesPeriodo[periodoAtualRelatorio] || 'Geral';

        // Aba 1: Resumo Financeiro
        const dadosResumo = [
            { Indicador: 'Estabelecimento', Valor: 'Mercadinho Pinheiro' },
            { Indicador: 'Período Filtrado', Valor: nomeFiltro.replace(/_/g, ' ') },
            { Indicador: 'Data de Emissão', Valor: new Date().toLocaleString('pt-BR') },
            { Indicador: 'Quantidade de Vendas', Valor: data.resumo.qtd_vendas },
            { Indicador: 'Faturamento Bruto (R$)', Valor: parseFloat(data.resumo.faturamento_total.toFixed(2)) },
            { Indicador: 'Lucro Líquido Real (R$)', Valor: parseFloat(data.resumo.lucro_liquido.toFixed(2)) }
        ];

        // Aba 2: Lista Detalhada de Vendas
        const dadosVendas = data.historico.map(v => ({
            'ID Venda': v.id,
            'Data e Hora': v.data,
            'Forma de Pagamento': v.forma_pagamento,
            'Total da Venda (R$)': parseFloat(parseFloat(v.total).toFixed(2))
        }));

        const wb = XLSX.utils.book_new();
        const wsResumo = XLSX.utils.json_to_sheet(dadosResumo);
        const wsVendas = XLSX.utils.json_to_sheet(dadosVendas.length > 0 ? dadosVendas : [{ Aviso: 'Nenhuma venda neste período' }]);

        wsResumo['!cols'] = [{ wch: 28 }, { wch: 25 }];
        wsVendas['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Financeiro');
        XLSX.utils.book_append_sheet(wb, wsVendas, 'Vendas Detalhadas');

        const nomeArquivo = `Relatorio_Mercadinho_${nomeFiltro}.xlsx`;
        XLSX.writeFile(wb, nomeArquivo);
    } catch (err) {
        alert('Erro ao gerar planilha Excel: ' + err.message);
    }
}







