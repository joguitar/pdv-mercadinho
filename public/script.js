const API_URL = window.location.hostname === 'localhost' || window.location.protocol === 'file:'
    ? 'https://onrender.com'
    : '/api';

let estoqueLocal = [], carrinho = [], periodoAtual = '', paginaAtualCaixa = 1, paginaAtualGestao = 1;
let paginaAtualVendas = 1;
let produtoDestaqueAtual = null;
let pagoGlobal = 0, totalGlobal = 0, vendaIdAtual = null;
const itensPorPagina = 5;

document.addEventListener('DOMContentLoaded', () => {
    buscarProdutos(); buscarRelatorios();
    document.getElementById('btn-caixa')?.addEventListener('click', (e) => mudarAba('aba-caixa', e.target));
    document.getElementById('btn-gestao')?.addEventListener('click', (e) => mudarAba('aba-gestao', e.target));
    document.getElementById('filtro-geral')?.addEventListener('click', () => filtrarRelatorio(''));
    document.getElementById('filtro-mes')?.addEventListener('click', () => filtrarRelatorio('mes'));
    document.getElementById('filtro-semana')?.addEventListener('click', () => filtrarRelatorio('semana'));
    document.getElementById('produto-form')?.addEventListener('submit', salvarProduto);
    document.getElementById('form-editar-modal')?.addEventListener('submit', enviarEdicaoModal);
    document.getElementById('btn-finalizar')?.addEventListener('click', finalizarVenda);
    document.getElementById('busca-produto')?.addEventListener('keydown', filtrarProdutos);
    document.getElementById('busca-produto-gestao')?.addEventListener('input', filtrarProdutosGestao);
    document.getElementById('desconto')?.addEventListener('input', atualizarInterfaceCarrinho);
    document.getElementById('pago')?.addEventListener('input', calcularTroco);
    document.getElementById('pago')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finalizarVenda();
        }
    });

    // Adicione estas duas linhas junto com os ouvintes de paginação existentes:
    document.getElementById('btn-anterior-vendas')?.addEventListener('click', () => { if (paginaAtualVendas > 1) { paginaAtualVendas--; buscarRelatorios(); } });
    document.getElementById('btn-proximo-vendas')?.addEventListener('click', () => { paginaAtualVendas++; buscarRelatorios(); });
    // Adicione estas linhas antes do fechamento do DOMContentLoaded:
    document.getElementById('destaque-qtd')?.addEventListener('input', calcularSubtotalDestaque);
    document.getElementById('btn-confirmar-add')?.addEventListener('click', confirmarAdicaoDestaque);
    // Adicione esta escuta de teclado dentro do seu DOMContentLoaded:
    document.getElementById('destaque-qtd')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmarAdicaoDestaque(); // Chama a função que salva o item no cupom
        }
    });
    document.getElementById('filtro-hoje')?.addEventListener('click', () => filtrarRelatorio('hoje'));




    // Ouvinte atualizado do Botão de Impressão via API do Banco
    // OUVINTE ATUALIZADO DO BOTÃO DE IMPRESSÃO VIA CUPOM MESTRE OCULTO



    document.getElementById('btn-anterior-caixa')?.addEventListener('click', () => { if (paginaAtualCaixa > 1) { paginaAtualCaixa--; buscarProdutos(); } });
    document.getElementById('btn-proximo-caixa')?.addEventListener('click', () => { paginaAtualCaixa++; buscarProdutos(); });
    document.getElementById('btn-anterior-gestao')?.addEventListener('click', () => { if (paginaAtualGestao > 1) { paginaAtualGestao--; buscarProdutos(); } });
    document.getElementById('btn-proximo-gestao')?.addEventListener('click', () => { paginaAtualGestao++; buscarProdutos(); });
    // Adicione o clique do botão cancelar e o atalho da tecla Escape (ESC):
    document.getElementById('btn-cancelar')?.addEventListener('click', cancelarVendaAtual);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'F8') finalizarVenda();
        if (e.key === 'Escape') cancelarVendaAtual();
    });

});
function mudarAba(idAba, botaoClicado) {
    // 1. Esconde todas as abas primeiro
    document.querySelectorAll('.aba-conteudo').forEach(aba => {
        aba.style.setProperty('display', 'none', 'important');
    });

    // 2. Remove o destaque visual de todos os botões do menu
    document.querySelectorAll('.aba-btn').forEach(btn => btn.classList.remove('ativa'));

    // 3. Mostra apenas a aba clicada no formato exato dela
    const abaAlvo = document.getElementById(idAba);
    if (abaAlvo) {
        const formatoDisplay = (idAba === 'aba-caixa') ? 'grid' : 'block';
        abaAlvo.style.setProperty('display', formatoDisplay, 'important');
    }

    if (botaoClicado) botaoClicado.classList.add('ativa');
}


async function buscarProdutos() {
    try {
        const termoCaixa = document.getElementById('busca-produto')?.value.trim() || '';
        const termoGestao = document.getElementById('busca-produto-gestao')?.value.trim() || '';
        const resCaixa = await fetch(`${API_URL}/produtos?page=${paginaAtualCaixa}&limit=${itensPorPagina}&busca=${termoCaixa}`);
        const dadosCaixa = await resCaixa.json();
        estoqueLocal = dadosCaixa.produtos; renderizarTabelaProdutosCaixa(dadosCaixa.produtos);
        atualizarControlesPaginacao('caixa', dadosCaixa.paginaAtual, dadosCaixa.totalPaginas);
        const resGestao = await fetch(`${API_URL}/produtos?page=${paginaAtualGestao}&limit=${itensPorPagina}&busca=${termoGestao}`);
        const dadosGestao = await resGestao.json();
        renderizarTabelaProdutosGestao(dadosGestao.produtos);
        atualizarControlesPaginacao('gestao', dadosGestao.paginaAtual, dadosGestao.totalPaginas);
    } catch (err) { console.error(err); }
}

// SUBSTITUA A FUNÇÃO renderizarTabelaProdutosCaixa POR ESTA NO SEU SCRIPT.JS:
function renderizarTabelaProdutosCaixa(lista) {
    const tbody = document.getElementById('produtos-lista'); if (!tbody) return; tbody.innerHTML = '';
    const termoBusca = document.getElementById('busca-produto')?.value.trim() || '';

    if (termoBusca === "") {
        document.getElementById('painel-produto-destaque').style.display = 'none';
        if (document.getElementById('info-paginas-caixa')) document.getElementById('info-paginas-caixa').parentElement.style.display = 'none';
        return;
    }

    if (document.getElementById('info-paginas-caixa')) document.getElementById('info-paginas-caixa').parentElement.style.display = 'flex';

    lista.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.nome}</strong></td>
            <td>R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</td>
            <td>${p.quantidade} un</td>
            <td><button class="btn-add" onclick="jogarParaDestaque(${p.id})">🔍 Selecionar</button></td>
        `;
        tbody.appendChild(tr);
    });

    // Se a lista trouxer exatamente 1 produto (ex: via código de barras), já joga ele direto no painel
    if (lista.length === 1) { jogarParaDestaque(lista[0].id); }
}



function renderizarTabelaProdutosGestao(lista) {
    const tbody = document.getElementById('produtos-gestao-lista'); if (!tbody) return; tbody.innerHTML = '';
    lista.forEach(p => {
        const margem = Math.round(((parseFloat(p.preco) / parseFloat(p.preco_custo)) - 1) * 100) || 0;
        const minimo = p.estoque_minimo || 5;
        const estoqueBaixo = p.quantidade <= minimo;

        // Estilo de alerta vermelho caso o estoque esteja no limite
        const estiloAlerta = estoqueBaixo ? 'color: #ef4444; font-weight: bold;' : '';
        const iconeAlerta = estoqueBaixo ? '⚠️ ' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${p.id}</td>
            <td><strong>${p.nome}</strong></td>
            <td>R$ ${parseFloat(p.preco_custo).toFixed(2).replace('.', ',')}</td>
            <td style="color:#10b981;font-weight:bold;">R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</td>
            <td style="${estiloAlerta}">${iconeAlerta}${p.quantidade} un</td>
            <td>
                <button onclick="editarProdutoCompleto(${p.id},'${p.nome}',${p.preco_custo},${p.quantidade},${margem},${minimo})" style="background:#f39c12;color:white;padding:4px 8px;font-size:0.8rem;border-radius:4px;border:none;cursor:pointer;">✏️</button>
                <button onclick="excluirProdutoGestao(${p.id})" style="background:#ef4444;color:white;padding:4px 8px;font-size:0.8rem;border-radius:4px;border:none;cursor:pointer;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}


function atualizarControlesPaginacao(tipo, atual, total) {
    const btnAnt = document.getElementById(`btn-anterior-${tipo}`), btnProx = document.getElementById(`btn-proximo-${tipo}`), txtInfo = document.getElementById(`info-paginas-${tipo}`);
    if (txtInfo) txtInfo.innerText = `Página ${atual} de ${total || 1}`;
    if (btnAnt) { btnAnt.disabled = (atual <= 1); btnAnt.style.opacity = (atual <= 1) ? "0.4" : "1"; }
    if (btnProx) { btnProx.disabled = (atual >= total || total === 0); btnProx.style.opacity = (atual >= total || total === 0) ? "0.4" : "1"; }
}

// SUBSTITUA A FUNÇÃO filtrarProdutos POR ESTA VERSÃO NO SEU SCRIPT.JS:
function filtrarProdutos(evento) {
    const campoBusca = document.getElementById('busca-produto');
    if (!campoBusca) return;

    const termo = campoBusca.value.trim();

    // INTERCEPTA O BIPE DO LEITOR OU DIGITAÇÃO COM ENTER
    if (evento && evento.key === 'Enter') {
        if (evento.preventDefault) evento.preventDefault();

        // Procura se existe um produto com esse código de barras exato no estoque
        const produtoEncontrado = estoqueLocal.find(p => p.codigo_barras === termo);

        if (produtoEncontrado) {
            // 1. CARREGA O ITEM DIRETAMENTE NO PAINEL DE DESTAQUE GIGANTE
            produtoDestaqueAtual = produtoEncontrado;

            if (document.getElementById('destaque-nome')) document.getElementById('destaque-nome').innerText = produtoEncontrado.nome;
            if (document.getElementById('destaque-preco-uni')) document.getElementById('destaque-preco-uni').innerText = `R$ ${parseFloat(produtoEncontrado.preco).toFixed(2).replace('.', ',')}`;
            if (document.getElementById('destaque-qtd')) document.getElementById('destaque-qtd').value = '1';
            if (document.getElementById('destaque-preco-total')) document.getElementById('destaque-preco-total').innerText = `R$ ${parseFloat(produtoEncontrado.preco).toFixed(2).replace('.', ',')}`;

            // Exibe o painel na tela
            const painelDestaque = document.getElementById('painel-produto-destaque');
            if (painelDestaque) painelDestaque.style.display = 'block';

            // 2. LIMPA O CAMPO DE BUSCA PARA O PRÓXIMO ITEM
            campoBusca.value = '';

            // 3. JOGA O CURSOR DO TECLADO DIRETO NO CAMPO DE QUANTIDADE
            const campoQtd = document.getElementById('destaque-qtd');
            if (campoQtd) {
                campoQtd.focus();
                campoQtd.select(); // Deixa o "1" selecionado para o operador digitar por cima direto
            }

            return;
        } else {
            // Se apertou Enter mas não era um código de barras válido, faz a busca comum por texto
            paginaAtualCaixa = 1;
            buscarProdutos();
            return;
        }
    }

    // Se estiver apenas digitando letras para busca manual por nome, atualiza a tabela normalmente
    paginaAtualCaixa = 1;
    buscarProdutos();
}


function filtrarProdutosGestao() { paginaAtualGestao = 1; buscarProdutos(); }

function adicionarAoCarrinho(id) {
    const produto = estoqueLocal.find(p => p.id === id); if (!produto) return;
    const item = carrinho.find(i => i.id === id); const qtd = item ? item.quantidade : 0;
    if (produto.quantidade <= qtd) return mostrarNotificacao('Estoque esgotado!', 'erro');
    if (item) { item.quantidade++; } else { carrinho.push({ id: produto.id, nome: produto.nome, preco: parseFloat(produto.preco), quantidade: 1 }); }
    atualizarInterfaceCarrinho();
}

function removerDoCarrinho(id) { carrinho = carrinho.filter(i => i.id !== id); atualizarInterfaceCarrinho(); }

function atualizarInterfaceCarrinho() {
    const containerLista = document.getElementById('carrinho-lista');
    if (!containerLista) return;
    containerLista.innerHTML = '';

    let subtotal = 0;

    carrinho.forEach(item => {
        const itemSub = item.preco * item.quantidade;
        subtotal += itemSub;

        const linha = document.createElement('div');
        linha.className = 'cupom-item-linha';
        linha.innerHTML = `
            <span class="nao-imprimir" style="color: #ef4444; font-weight: bold; cursor: pointer; margin-right: 5px;" onclick="removerDoCarrinho(${item.id})">✕</span>
            <span style="text-transform: uppercase;">${item.nome}</span>
            <span style="text-align: center;">${item.quantidade}x</span>
            <span style="text-align: right;">R$ ${itemSub.toFixed(2).replace('.', ',')}</span>
        `;
        containerLista.appendChild(linha);
    });

    const pct = parseFloat(document.getElementById('desconto')?.value) || 0;
    const totalComDesconto = subtotal - (subtotal * (pct / 100));

    totalGlobal = parseFloat(totalComDesconto.toFixed(2)) || 0;

    if (document.getElementById('subtotal-venda')) document.getElementById('subtotal-venda').innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    if (document.getElementById('total-venda')) document.getElementById('total-venda').innerText = `R$ ${totalGlobal.toFixed(2).replace('.', ',')}`;
    if (document.getElementById('recibo-subtotal')) document.getElementById('recibo-subtotal').innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    if (document.getElementById('recibo-desconto')) document.getElementById('recibo-desconto').innerText = `R$ ${(subtotal * (pct / 100)).toFixed(2).replace('.', ',')}`;
    if (document.getElementById('recibo-total')) document.getElementById('recibo-total').innerText = `R$ ${totalGlobal.toFixed(2).replace('.', ',')}`;
    calcularTroco();
}

function calcularTroco() {
    const campoPago = document.getElementById('pago');
    if (!campoPago) return;

    let apenasNumeros = campoPago.value.replace(/\D/g, "");
    if (apenasNumeros === "") {
        pagoGlobal = 0;
        if (document.getElementById('troco-valor')) document.getElementById('troco-valor').innerText = 'R$ 0.00';
        return;
    }

    let valorDecimal = (parseFloat(apenasNumeros) / 100).toFixed(2);
    let valorFormatado = valorDecimal.replace(".", ",");
    valorFormatado = valorFormatado.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    campoPago.value = valorFormatado;

    pagoGlobal = parseFloat(valorDecimal) || 0;

    const troco = pagoGlobal - totalGlobal;
    const formatado = troco > 0 ? `R$ ${troco.toFixed(2).replace('.', ',')}` : 'R$ 0.00';

    if (document.getElementById('troco-valor')) document.getElementById('troco-valor').innerText = formatado;
    if (document.getElementById('recibo-troco')) document.getElementById('recibo-troco').innerText = formatado;
}

async function salvarProduto(e) {
    e.preventDefault();
    const nome = document.getElementById('nome-cadastro').value, preco_custo = document.getElementById('preco_custo').value, quantidade = document.getElementById('quantidade').value, margem = document.getElementById('margem').value;
    try {
        const res = await fetch(`${API_URL}/produtos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, preco_custo, quantidade, margem }) });
        if (res.ok) { buscarProdutos(); document.getElementById('produto-form').reset(); document.getElementById('margem').value = '30'; mostrarNotificacao('Produto cadastrado!'); }
    } catch (err) { console.error(err); }
}

function editarProdutoCompleto(id, nome, custo, qtd, margem) {
    const pOrig = estoqueLocal.find(p => p.id === id) || {};
    document.getElementById('edit-id').value = id; document.getElementById('edit-nome').value = nome;
    document.getElementById('edit-codigo-barras').value = pOrig.codigo_barras || '';
    document.getElementById('edit-custo').value = custo; document.getElementById('edit-margem').value = margem; document.getElementById('edit-quantidade').value = qtd;
    document.getElementById('modal-editar').style.display = 'flex';
}

function fecharModalEditar() { document.getElementById('modal-editar').style.display = 'none'; }

async function enviarEdicaoModal(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value, nome = document.getElementById('edit-nome').value, codigo_barras = document.getElementById('edit-codigo-barras').value.trim(), preco_custo = parseFloat(document.getElementById('edit-custo').value), margem = parseFloat(document.getElementById('edit-margem').value), quantidade = parseInt(document.getElementById('edit-quantidade').value);
    try {
        const res = await fetch(`${API_URL}/produtos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, preco_custo, quantidade, margem, codigo_barras }) });
        if (res.ok) { mostrarNotificacao("Produto atualizado!"); fecharModalEditar(); buscarProdutos(); }
        else { mostrarNotificacao("Erro ao atualizar.", "erro"); }
    } catch (err) { console.error(err); }
}

async function excluirProdutoGestao(id) {
    if (!confirm("Deseja excluir?")) return;
    try {
        const res = await fetch(`${API_URL}/produtos/${id}`, { method: 'DELETE' });
        if (res.ok) { mostrarNotificacao("Removido!"); buscarProdutos(); buscarRelatorios(); }
    } catch (err) { console.error(err); }
}

async function finalizarVenda() {
    if (carrinho.length === 0) return mostrarNotificacao('Cupom vazio!', 'erro');

    const total = totalGlobal;
    const pago = pagoGlobal;
    const forma = document.getElementById('forma-pagamento').value;

    if (pago < total) return mostrarNotificacao('Valor pago insuficiente!', 'erro');

    try {
        const res = await fetch(`${API_URL}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                itens: carrinho,
                total,
                forma_pagamento: forma,
                valor_recebido: pagoGlobal
            })
        });

        if (res.ok) {
            const dadosResposta = await res.json();
            vendaIdAtual = dadosResposta.vendaId;

            mostrarNotificacao('Venda registrada! Preparando impressão...');

            // Limpa o estado visual do caixa imediatamente
            carrinho = [];
            pagoGlobal = 0;
            totalGlobal = 0;

            if (document.getElementById('pago')) document.getElementById('pago').value = '';
            if (document.getElementById('desconto')) document.getElementById('desconto').value = '0';
            if (document.getElementById('troco-valor')) document.getElementById('troco-valor').innerText = 'R$ 0.00';

            atualizarInterfaceCarrinho();
            buscarProdutos();
            buscarRelatorios();

            // Dispara a busca no banco e abre a janela de impressão automaticamente
            await reimprimirCupomHistorico(vendaIdAtual);
        } else {
            const erroReal = await res.json();
            alert("MOTIVO DO ERRO: " + (erroReal.error || JSON.stringify(erroReal)));
            mostrarNotificacao('Erro ao registrar venda.', 'erro');
        }

    } catch (err) {
        console.error('Erro ao finalizar venda:', err);
        mostrarNotificacao('Erro na comunicação com o sistema.', 'erro');
    }
}

function filtrarRelatorio(periodo) {
    periodoAtual = periodo;
    paginaAtualVendas = 1;
    document.querySelectorAll('.btn-filto-tempo').forEach(btn => btn.classList.remove('ativa'));
    if (periodo === '') document.getElementById('filtro-geral')?.classList.add('ativa');
    if (periodo === 'hoje') document.getElementById('filtro-hoje')?.classList.add('ativa');
    if (periodo === 'mes') document.getElementById('filtro-mes')?.classList.add('ativa');
    if (periodo === 'semana') document.getElementById('filtro-semana')?.classList.add('ativa');
    buscarRelatorios();
}

async function buscarRelatorios() {
    try {
        // Envia a página atual e o limite de 5 itens para a API
        const res = await fetch(`${API_URL}/relatorios?periodo=${periodoAtual}&page=${paginaAtualVendas}&limit=5`);
        const dados = await res.json();

        if (document.getElementById('rel-qtd-vendas')) document.getElementById('rel-qtd-vendas').innerText = dados.resumo.qtd_vendas;
        if (document.getElementById('rel-faturamento-total')) document.getElementById('rel-faturamento-total').innerText = `R$ ${parseFloat(dados.resumo.faturamento_total).toFixed(2).replace('.', ',')}`;
        if (document.getElementById('rel-lucro-liquido')) document.getElementById('rel-lucro-liquido').innerText = `R$ ${parseFloat(dados.resumo.lucro_liquido).toFixed(2).replace('.', ',')}`;

        const tbody = document.getElementById('rel-historico-lista');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Procure por este trecho dentro da função buscarRelatorios():
        dados.historico.forEach(v => {
            const tr = document.createElement('tr');
            // SUBSTITUA A LINHA DO TR.INNERHTML POR ESTA VERSÃO COM O BOTÃO:
            tr.innerHTML = `
        <td>#${v.id}</td>
        <td>${v.data}</td>
        <td>${v.forma_pagamento}</td>
        <td><strong>R$ ${parseFloat(v.total).toFixed(2).replace('.', ',')}</strong></td>
        <td>
            <button onclick="reimprimirCupomHistorico(${v.id})" style="background:#e67e22; color:white; padding:4px 8px; font-size:0.8rem; border-radius:4px; border:none; cursor:pointer;" title="Reimprimir Cupom">🖨️ Recibo</button>
        </td>
    `;
            tbody.appendChild(tr);
        });


        // Atualiza o texto e desativa os botões se chegar na primeira ou última página
        atualizarControlesPaginacao('vendas', dados.paginaAtual, dados.totalPaginas);
    } catch (err) { console.error(err); }
}


function mostrarNotificacao(mensagem, tipo = 'sucesso') {
    const container = document.getElementById('toast-container'); if (!container) return;
    const toast = document.createElement('div'); toast.className = `toast ${tipo}`;
    toast.innerHTML = `<span>${tipo === 'sucesso' ? '✅' : '❌'}</span> <div>${mensagem}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.3s ease forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

// ADICIONE ESTA FUNÇÃO NO FINAL DO SEU SCRIPT.JS:
// SUBSTITUA A FUNÇÃO reimprimirCupomHistorico POR ESTA NO SEU SCRIPT.JS:
async function reimprimirCupomHistorico(idVenda) {
    try {
        mostrarNotificacao('Carregando dados do cupom...');
        const res = await fetch(`${API_URL}/vendas/${idVenda}`);
        if (!res.ok) return mostrarNotificacao('Erro ao buscar dados no servidor.', 'erro');
        const dados = await res.json();

        if (!dados.venda || !dados.itens) return mostrarNotificacao('Cupom sem dados válidos.', 'erro');

        // INJETA OS VALORES DIRETAMENTE NO CUPOM MESTRE DE IMPRESSÃO
        if (document.getElementById('print-mestre-data')) document.getElementById('print-mestre-data').innerText = `Data: ${dados.venda.data}`;
        if (document.getElementById('print-mestre-forma')) document.getElementById('print-mestre-forma').innerText = dados.venda.forma_pagamento.toUpperCase();

        const totalVenda = parseFloat(dados.venda.total) || 0;
        const vRecebido = parseFloat(dados.venda.valor_recebido) || 0;
        const trocoCalculado = vRecebido - totalVenda;

        let subtotalItens = 0;
        dados.itens.forEach(i => subtotalItens += (parseFloat(i.quantidade) * parseFloat(i.preco_unitario)));

        if (document.getElementById('print-mestre-subtotal')) document.getElementById('print-mestre-subtotal').innerText = `R$ ${subtotalItens.toFixed(2).replace('.', ',')}`;
        if (document.getElementById('print-mestre-desconto')) {
            const descVal = subtotalItens - totalVenda;
            document.getElementById('print-mestre-desconto').innerText = `R$ ${(descVal > 0 ? descVal : 0).toFixed(2).replace('.', ',')}`;
        }
        if (document.getElementById('print-mestre-total')) document.getElementById('print-mestre-total').innerText = `R$ ${totalVenda.toFixed(2).replace('.', ',')}`;
        if (document.getElementById('print-mestre-pago')) document.getElementById('print-mestre-pago').innerText = `R$ ${vRecebido.toFixed(2).replace('.', ',')}`;
        if (document.getElementById('print-mestre-troco')) document.getElementById('print-mestre-troco').innerText = `R$ ${(trocoCalculado > 0 ? trocoCalculado : 0).toFixed(2).replace('.', ',')}`;

        const containerLista = document.getElementById('print-mestre-itens');
        if (containerLista) {
            containerLista.innerHTML = '';
            dados.itens.forEach(item => {
                const totalPorItem = parseFloat(item.quantidade) * parseFloat(item.preco_unitario);
                const linha = document.createElement('div');
                linha.className = 'cupom-item-linha';
                linha.innerHTML = `
                    <span style="text-transform: uppercase;">${item.nome}</span>
                    <span style="text-align: center;">${item.quantidade}x</span>
                    <span style="text-align: right;">R$ ${totalPorItem.toFixed(2).replace('.', ',')}</span>
                `;
                containerLista.appendChild(linha);
            });
        }

        // DISPARA A IMPRESSÃO COLETANDO O CONTEÚDO DO MESTRE OCULTO
        window.print();

    } catch (err) {
        console.error('Erro na reimpressão histórica:', err);
        mostrarNotificacao('Erro ao processar reimpressão.', 'erro');
    }
}

// ADICIONE ESTAS TRÊS FUNÇÕES NO FINAL DO SEU SCRIPT.JS:
function jogarParaDestaque(id) {
    const produto = estoqueLocal.find(p => p.id === id);
    if (!produto) return;

    produtoDestaqueAtual = produto;

    document.getElementById('destaque-nome').innerText = produto.nome;
    document.getElementById('destaque-preco-uni').innerText = `R$ ${parseFloat(produto.preco).toFixed(2).replace('.', ',')}`;
    document.getElementById('destaque-qtd').value = '1';

    document.getElementById('painel-produto-destaque').style.display = 'block';
    calcularSubtotalDestaque();
    document.getElementById('destaque-qtd').focus();
}

function calcularSubtotalDestaque() {
    if (!produtoDestaqueAtual) return;
    const qtd = parseInt(document.getElementById('destaque-qtd').value) || 1;
    const subtotal = parseFloat(produtoDestaqueAtual.preco) * qtd;
    document.getElementById('destaque-preco-total').innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
}

function confirmarAdicaoDestaque() {
    if (!produtoDestaqueAtual) return;
    const qtd = parseInt(document.getElementById('destaque-qtd').value) || 1;

    if (produtoDestaqueAtual.quantidade < qtd) {
        return mostrarNotificacao('Quantidade superior ao estoque disponível!', 'erro');
    }

    const itemExistente = carrinho.find(i => i.id === produtoDestaqueAtual.id);
    if (itemExistente) {
        itemExistente.quantidade += qtd;
    } else {
        carrinho.push({
            id: produtoDestaqueAtual.id,
            nome: produtoDestaqueAtual.nome,
            preco: parseFloat(produtoDestaqueAtual.preco),
            quantidade: qtd
        });
    }

    mostrarNotificacao('Item adicionado ao cupom!');
    document.getElementById('painel-produto-destaque').style.display = 'none';
    document.getElementById('busca-produto').value = '';
    produtoDestaqueAtual = null;

    atualizarInterfaceCarrinho();
    buscarProdutos();
    document.getElementById('busca-produto').focus();
}

function cancelarVendaAtual() {
    // Se não houver nada no carrinho e nenhum produto em destaque, avisa o operador
    if (carrinho.length === 0 && !produtoDestaqueAtual) {
        return mostrarNotificacao('O caixa já está livre.', 'erro');
    }

    // Pede confirmação para evitar cancelamento acidental ao esbarrar no teclado
    if (!confirm('Deseja realmente cancelar a venda atual e limpar todos os itens?')) {
        return;
    }

    // Reseta todas as variáveis de memória da venda
    carrinho = [];
    pagoGlobal = 0;
    totalGlobal = 0;
    produtoDestaqueAtual = null;

    // Limpa os campos visuais e painéis abertos
    if (document.getElementById('pago')) document.getElementById('pago').value = '';
    if (document.getElementById('desconto')) document.getElementById('desconto').value = '0';
    if (document.getElementById('troco-valor')) document.getElementById('troco-valor').innerText = 'R$ 0,00';
    if (document.getElementById('painel-produto-destaque')) document.getElementById('painel-produto-destaque').style.display = 'none';
    
    const campoBusca = document.getElementById('busca-produto');
    if (campoBusca) {
        campoBusca.value = '';
        campoBusca.focus();
    }

    // Atualiza o cupom visual e a tabela
    atualizarInterfaceCarrinho();
    buscarProdutos();
    
    mostrarNotificacao('Venda cancelada! Caixa livre para o próximo cliente.');
}

