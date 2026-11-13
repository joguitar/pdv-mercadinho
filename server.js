const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    host: 'aws-1-us-east-1' + '.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.amkfzpkijyxhkuosvjeu',
    password: process.env.DB_PASSWORD || 'mercadinho2612',
    ssl: { rejectUnauthorized: false }
});

// ROTA: LISTAR PRODUTOS COM PAGINAÇÃO E BUSCA
app.get('/api/produtos', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const busca = req.query.busca ? `%${req.query.busca}%` : '%';
        const offset = (page - 1) * limit;

        const countRes = await pool.query(
            `SELECT COUNT(*) FROM produtos WHERE nome ILIKE $1 OR codigo_barras ILIKE $1`,
            [busca]
        );
        const totalRegistros = parseInt(countRes.rows[0].count);
        const totalPaginas = Math.ceil(totalRegistros / limit);

        const result = await pool.query(
            `SELECT * FROM produtos WHERE nome ILIKE $1 OR codigo_barras ILIKE $1 ORDER BY id DESC LIMIT $2 OFFSET $3`,
            [busca, limit, offset]
        );

        res.json({ produtos: result.rows, paginaAtual: page, totalPaginas });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA: CADASTRAR NOVO PRODUTO
app.post('/api/produtos', async (req, res) => {
    try {
        const { nome, preco_custo, quantidade, margem, codigo_barras, estoque_minimo } = req.body;
        const custoNum = parseFloat(preco_custo);
        const margemNum = parseFloat(margem) || 30;
        const precoVenda = custoNum + (custoNum * (margemNum / 100));
        const codBarrasFinal = codigo_barras && codigo_barras.trim() !== '' ? codigo_barras.trim() : null;

        const result = await pool.query(
            `INSERT INTO produtos (nome, preco_custo, preco, quantidade, codigo_barras, estoque_minimo) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [nome, custoNum, precoVenda.toFixed(2), parseInt(quantidade), codBarrasFinal, parseInt(estoque_minimo) || 5]
        );

        res.status(201).json({ id: result.rows[0].id, message: 'Produto cadastrado!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA: EDITAR PRODUTO
app.put('/api/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, preco_custo, quantidade, margem, codigo_barras, estoque_minimo } = req.body;
        const custoNum = parseFloat(preco_custo);
        const margemNum = parseFloat(margem) || 30;
        const precoVenda = custoNum + (custoNum * (margemNum / 100));
        const codBarrasFinal = codigo_barras && codigo_barras.trim() !== '' ? codigo_barras.trim() : null;

        await pool.query(
            `UPDATE produtos SET nome = $1, preco_custo = $2, preco = $3, quantidade = $4, codigo_barras = $5, estoque_minimo = $6 WHERE id = $7`,
            [nome, custoNum, precoVenda.toFixed(2), parseInt(quantidade), codBarrasFinal, parseInt(estoque_minimo) || 5, id]
        );

        res.json({ message: 'Produto atualizado!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA: EXCLUIR PRODUTO
app.delete('/api/produtos/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM produtos WHERE id = $1`, [req.params.id]);
        res.json({ message: 'Produto excluído!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA: FINALIZAR VENDA E DAR BAIXA NO ESTOQUE
app.post('/api/vendas', async (req, res) => {
    const client = await pool.connect();
    try {
        const { itens, total, forma_pagamento, valor_recebido } = req.body;
        await client.query('BEGIN');

        const vendaRes = await client.query(
            `INSERT INTO vendas (data_venda, total, forma_pagamento, valor_recebido) 
             VALUES (NOW() AT TIME ZONE 'America/Fortaleza', $1, $2, $3) RETURNING id`,
            [total, forma_pagamento, valor_recebido || 0]
        );
        const vendaId = vendaRes.rows[0].id;

        for (const item of itens) {
            const prodRes = await client.query(`SELECT preco_custo FROM produtos WHERE id = $1`, [item.id]);
            const custoUnit = prodRes.rows[0] ? prodRes.rows[0].preco_custo : 0;

            await client.query(
                `INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario, preco_custo_unitario) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [vendaId, item.id, item.quantidade, item.preco, custoUnit]
            );

            await client.query(
                `UPDATE produtos SET quantidade = quantidade - $1 WHERE id = $2`,
                [item.quantidade, item.id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Venda concluída!', vendaId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ROTA: BUSCAR VENDA ESPECÍFICA PARA IMPRESSÃO DO CUPOM
app.get('/api/vendas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const vendaRes = await pool.query(
            `SELECT id, TO_CHAR(data_venda, 'DD/MM/YYYY HH24:MI') as data, total, forma_pagamento, valor_recebido 
             FROM vendas WHERE id = $1`,
            [id]
        );

        if (vendaRes.rows.length === 0) return res.status(404).json({ error: 'Venda não encontrada.' });

        const itensRes = await pool.query(
            `SELECT p.nome, iv.quantidade, iv.preco_unitario 
             FROM itens_venda iv JOIN produtos p ON iv.produto_id = p.id WHERE iv.venda_id = $1`,
            [id]
        );

        res.json({ venda: vendaRes.rows[0], itens: itensRes.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA: RELATÓRIOS FINANCEIROS E HISTÓRICO PAGINADO
app.get('/api/relatorios', async (req, res) => {
    try {
        const { periodo } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        let filtroSql = "";
        if (periodo === 'hoje') filtroSql = "WHERE DATE(data_venda) = DATE(NOW() AT TIME ZONE 'America/Fortaleza')";

        else if (periodo === 'semana') filtroSql = "WHERE data_venda >= NOW() - INTERVAL '7 days'";
        else if (periodo === 'mes') filtroSql = "WHERE data_venda >= NOW() - INTERVAL '30 days'";

        const vendasRes = await pool.query(
            `SELECT COUNT(*) as total_vendas, COALESCE(SUM(total), 0) as faturamento_total FROM vendas ${filtroSql}`
        );

        const filtroCusto = filtroSql.replace('data_venda', 'v.data_venda');
        const custosRes = await pool.query(
            `SELECT COALESCE(SUM(iv.quantidade * iv.preco_custo_unitario), 0) as custo_total 
             FROM itens_venda iv JOIN vendas v ON iv.venda_id = v.id ${filtroCusto}`
        );

        const faturamento = parseFloat(vendasRes.rows[0].faturamento_total);
        const custo = parseFloat(custosRes.rows[0].custo_total);
        const totalRegistros = parseInt(vendasRes.rows[0].total_vendas);
        const totalPaginas = Math.ceil(totalRegistros / limit);

        const histRes = await pool.query(
            `SELECT id, TO_CHAR(data_venda, 'DD/MM/YYYY HH24:MI') as data, total, forma_pagamento 
             FROM vendas ${filtroSql} ORDER BY id DESC LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        res.json({
            resumo: {
                qtd_vendas: totalRegistros,
                faturamento_total: faturamento,
                lucro_liquido: faturamento - custo
            },
            historico: histRes.rows,
            paginaAtual: page,
            totalPaginas
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
// ROTA: EXPORTAR RELATÓRIO EM PLANILHA EXCEL (.CSV)
app.get('/api/relatorios/excel', async (req, res) => {
    try {
        const { periodo } = req.query;
        let filtroSql = "";
        let nomePeriodo = "Geral";

        if (periodo === 'hoje') {
            filtroSql = "WHERE DATE(data_venda) = DATE(NOW() AT TIME ZONE 'America/Fortaleza')";
            nomePeriodo = "Hoje";
        } else if (periodo === 'semana') {
            filtroSql = "WHERE data_venda >= NOW() - INTERVAL '7 days'";
            nomePeriodo = "Ultimos_7_Dias";
        } else if (periodo === 'mes') {
            filtroSql = "WHERE data_venda >= NOW() - INTERVAL '30 days'";
            nomePeriodo = "Ultimos_30_Dias";
        }

        const vendasRes = await pool.query(
            `SELECT COUNT(*) as total_vendas, COALESCE(SUM(total), 0) as faturamento_total FROM vendas ${filtroSql}`
        );

        const filtroCusto = filtroSql.replace('data_venda', 'v.data_venda');
        const custosRes = await pool.query(
            `SELECT COALESCE(SUM(iv.quantidade * iv.preco_custo_unitario), 0) as custo_total 
             FROM itens_venda iv JOIN vendas v ON iv.venda_id = v.id ${filtroCusto}`
        );

        const faturamento = parseFloat(vendasRes.rows[0].faturamento_total);
        const custo = parseFloat(custosRes.rows[0].custo_total);
        const lucro = faturamento - custo;

        const histRes = await pool.query(
            `SELECT id, TO_CHAR(data_venda, 'DD/MM/YYYY HH24:MI') as data, total, forma_pagamento 
             FROM vendas ${filtroSql} ORDER BY id DESC`
        );

        let linhas = [
            'RELATORIO FINANCEIRO - MERCADINHO PINHEIRO',
            `Periodo;${nomePeriodo.replace(/_/g, ' ')}`,
            `Emitido em;${new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`,
            '',
            'RESUMO FINANCEIRO',
            'Indicador;Valor',
            `Quantidade de Vendas;${vendasRes.rows[0].total_vendas}`,
            `Faturamento Bruto (R$);${faturamento.toFixed(2).replace('.', ',')}`,
            `Lucro Liquido Real (R$);${lucro.toFixed(2).replace('.', ',')}`,
            '',
            'HISTORICO DETALHADO DE VENDAS',
            'ID Venda;Data e Hora;Forma de Pagamento;Total (R$)'
        ];

        histRes.rows.forEach(v => {
            const valor = parseFloat(v.total).toFixed(2).replace('.', ',');
            linhas.push(`${v.id};${v.data};${v.forma_pagamento};${valor}`);
        });

        const csvFinal = '\uFEFF' + linhas.join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="Relatorio_Mercadinho_${nomePeriodo}.csv"`);
        res.status(200).send(csvFinal);
    } catch (err) {
        res.status(500).send('Erro ao gerar planilha: ' + err.message);
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na nuvem na porta ${PORT}`));
